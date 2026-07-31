'use strict';

var spawn = require('child_process').spawn;
var EventEmitter = require('events').EventEmitter;
var os = require('os');
var path = require('path');
var electron = require('electron');

var READINESS_TIMEOUT_MS = 15000;
var GRACEFUL_SHUTDOWN_TIMEOUT_MS = 2000;
var FORCE_KILL_TIMEOUT_MS = 2000;
var MAX_CONTEXT_LENGTH = 65536;

function appendContext(current, chunk)
{
	var combined = current + chunk;
	return combined.length > MAX_CONTEXT_LENGTH
		? combined.slice(-MAX_CONTEXT_LENGTH)
		: combined;
}

function describeCommand(executable, args)
{
	return [executable].concat(args).map(function(part)
	{
		return JSON.stringify(part);
	}).join(' ');
}

function makeLaunchError(message, command, stderr, stdout, code, signal, cause)
{
	var details = [];

	if (command)
	{
		details.push('command: ' + command);
	}

	if (code !== undefined && code !== null)
	{
		details.push('exit code: ' + code);
	}

	if (signal)
	{
		details.push('signal: ' + signal);
	}

	if (cause)
	{
		details.push('cause: ' + cause.message);
	}

	if (stderr && stderr.trim())
	{
		details.push('stderr:\n' + stderr.trim());
	}

	if (stdout && stdout.trim())
	{
		details.push('stdout:\n' + stdout.trim());
	}

	var error = new Error(message + (details.length ? '\n' + details.join('\n') : ''));
	if (cause)
	{
		error.cause = cause;
	}
	return error;
}

class Session extends EventEmitter
{
	constructor(child, command)
	{
		super();

		var self = this;
		this.elements = null;
		this._child = child;
		this._command = command;
		this._stdoutBuffer = '';
		this._stdoutContext = '';
		this._stderr = '';
		this._ready = false;
		this._readySettled = false;
		this._closed = false;
		this._stopping = false;
		this._stopPromise = null;
		this._runtimeErrorEmitted = false;
		this._exitCode = undefined;
		this._exitSignal = undefined;
		this._lastKillError = null;

		this._readyPromise = new Promise(function(resolve, reject)
		{
			self._resolveReady = resolve;
			self._rejectReadyPromise = reject;
		});

		this._closedPromise = new Promise(function(resolve)
		{
			self._resolveClosed = resolve;
		});

		this._readinessTimer = setTimeout(function()
		{
			self._rejectReady(self._makeError(
				'Target Practice readiness timed out after ' + READINESS_TIMEOUT_MS +
				' ms while waiting for a focused post-show frame and absolute element coordinates.'
			));
		}, READINESS_TIMEOUT_MS);

		child.stdout.on('data', function(data)
		{
			self._handleStdout(data);
		});

		child.stderr.on('data', function(data)
		{
			self._handleStderr(data);
		});

		child.on('error', function(error)
		{
			self._handleProcessError(error);
		});

		child.on('close', function(code, signal)
		{
			self._handleClose(code, signal);
		});
	}

	waitUntilReady()
	{
		return this._readyPromise;
	}

	stop()
	{
		if (this._stopPromise)
		{
			return this._stopPromise;
		}

		this._stopping = true;
		this._stopPromise = this._stopChild();
		return this._stopPromise;
	}

	_handleStdout(data)
	{
		var chunk = data.toString('utf8');
		this._stdoutContext = appendContext(this._stdoutContext, chunk);
		this._stdoutBuffer += chunk;

		var messages = this._stdoutBuffer.split(/\r?\n/);
		this._stdoutBuffer = messages.pop();

		for (var index = 0; index < messages.length; index++)
		{
			this._handleLine(messages[index]);
		}
	}

	_handleLine(line)
	{
		if (!line)
		{
			return;
		}

		var message;
		try
		{
			message = JSON.parse(line);
		}
		catch (error)
		{
			return;
		}

		if (!message || typeof message.event !== 'string')
		{
			return;
		}

		if (message.event === 'elements')
		{
			if (!message.message || typeof message.message !== 'object' || Array.isArray(message.message))
			{
				this._rejectReady(this._makeError(
					'Target Practice reported invalid element coordinates.'
				));
				return;
			}

			this._markReady(message.message);
			return;
		}

		if (!this._stopping)
		{
			this.emit(message.event, message.message);
		}
	}

	_handleStderr(data)
	{
		var chunk = data.toString('utf8');
		this._stderr = appendContext(this._stderr, chunk);
		process.stderr.write(chunk);
	}

	_handleProcessError(error)
	{
		if (this._stopping)
		{
			return;
		}

		if (!this._ready)
		{
			this._rejectReady(this._makeError(
				'Failed to launch Target Practice.',
				undefined,
				undefined,
				error
			));
			return;
		}

		this._emitRuntimeError(this._makeError(
			'Target Practice encountered a process error.',
			undefined,
			undefined,
			error
		));
	}

	_handleClose(code, signal)
	{
		if (this._closed)
		{
			return;
		}

		this._closed = true;
		this._exitCode = code;
		this._exitSignal = signal;
		clearTimeout(this._readinessTimer);
		this._resolveClosed();

		if (this._stopping)
		{
			return;
		}

		if (!this._ready)
		{
			this._rejectReady(this._makeError(
				'Target Practice exited before reporting readiness.',
				code,
				signal
			));
			return;
		}

		this._emitRuntimeError(this._makeError(
			'Target Practice exited unexpectedly.',
			code,
			signal
		));
	}

	_markReady(elements)
	{
		if (this._readySettled || this._closed)
		{
			return;
		}

		this.elements = elements;
		this._ready = true;
		this._readySettled = true;
		clearTimeout(this._readinessTimer);
		this._resolveReady(this);
	}

	_rejectReady(error)
	{
		if (this._readySettled)
		{
			return;
		}

		this._readySettled = true;
		clearTimeout(this._readinessTimer);
		this._rejectReadyPromise(error);
	}

	_emitRuntimeError(error)
	{
		if (this._runtimeErrorEmitted || this._stopping)
		{
			return;
		}

		this._runtimeErrorEmitted = true;
		this.emit('error', error);
	}

	_makeError(message, code, signal, cause)
	{
		return makeLaunchError(
			message,
			this._command,
			this._stderr,
			this._stdoutContext,
			code,
			signal,
			cause
		);
	}

	_stopChild()
	{
		var self = this;

		return new Promise(function(resolve, reject)
		{
			if (self._closed)
			{
				resolve();
				return;
			}

			var settled = false;
			var gracefulTimer;
			var forceTimer;

			function finish()
			{
				if (settled)
				{
					return;
				}

				settled = true;
				clearTimeout(gracefulTimer);
				clearTimeout(forceTimer);
				resolve();
			}

			self._closedPromise.then(finish);
			self._sendSignal('SIGTERM');

			gracefulTimer = setTimeout(function()
			{
				if (self._closed || settled)
				{
					return;
				}

				self._sendSignal('SIGKILL');
				forceTimer = setTimeout(function()
				{
					if (self._closed || settled)
					{
						return;
					}

					settled = true;
					reject(self._makeError(
						'Target Practice did not exit and close its stdio within ' +
						FORCE_KILL_TIMEOUT_MS + ' ms after SIGKILL.',
						self._exitCode,
						self._exitSignal,
						self._lastKillError
					));
				}, FORCE_KILL_TIMEOUT_MS);
			}, GRACEFUL_SHUTDOWN_TIMEOUT_MS);
		});
	}

	_sendSignal(signal)
	{
		try
		{
			if (!this._child.kill(signal))
			{
				this._lastKillError = new Error('child.kill(' + signal + ') returned false');
			}
		}
		catch (error)
		{
			this._lastKillError = error;
		}
	}
}

module.exports.start = function start()
{
	var args = [];

	if (os.platform() === 'linux')
	{
		args.push('--no-sandbox', '--disable-setuid-sandbox');
	}

	args.push(path.join(__dirname, 'electron-app'));
	var command = describeCommand(electron, args);
	var child;

	try
	{
		child = spawn(electron, args,
		{
			detached: false,
			stdio: ['ignore', 'pipe', 'pipe']
		});
	}
	catch (error)
	{
		return Promise.reject(makeLaunchError(
			'Failed to spawn Target Practice.',
			command,
			'',
			'',
			undefined,
			undefined,
			error
		));
	}

	var session = new Session(child, command);
	return session.waitUntilReady().catch(function(error)
	{
		return session.stop().then(function()
		{
			throw error;
		}, function(stopError)
		{
			error.message += '\nshutdown error: ' + stopError.message;
			throw error;
		});
	});
};
