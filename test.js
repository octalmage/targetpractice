/* jshint esversion: 8 */
'use strict';

var EventEmitter = require('events').EventEmitter;
var PassThrough = require('stream').PassThrough;
var inherits = require('util').inherits;
var childProcess = require('child_process');
var test = require('tape');
var robot = require('robotjs');
var targetpractice = require('./index.js');

robot.setMouseDelay(100);

function FakeChild(onKill)
{
	EventEmitter.call(this);
	this.stdout = new PassThrough();
	this.stderr = new PassThrough();
	this.signals = [];
	this.stdioClosed = false;
	this._closed = false;
	this._onKill = onKill;
}

inherits(FakeChild, EventEmitter);

FakeChild.prototype.kill = function kill(signal)
{
	this.signals.push(signal);
	if (this._onKill)
	{
		return this._onKill(signal, this);
	}

	this.close(null, signal);
	return true;
};

FakeChild.prototype.close = function close(code, signal)
{
	if (this._closed)
	{
		return;
	}

	this._closed = true;
	this.stdout.end();
	this.stderr.end();
	this.stdout.destroy();
	this.stderr.destroy();
	this.stdioClosed = true;
	this.emit('close', code, signal);
};

function launcherWithSpawn(spawnImplementation)
{
	var modulePath = require.resolve('./index.js');
	var originalSpawn = childProcess.spawn;
	var launcher;

	childProcess.spawn = spawnImplementation;
	delete require.cache[modulePath];
	try
	{
		launcher = require(modulePath);
	}
	finally
	{
		childProcess.spawn = originalSpawn;
		delete require.cache[modulePath];
	}

	return launcher;
}

function emitReady(child)
{
	process.nextTick(function()
	{
		child.stdout.write(JSON.stringify({
			event: 'elements',
			message: {
				button_1: { x: 10, y: 20 }
			}
		}) + '\n');
	});
}

function startWithShortReadinessTimer(launcher)
{
	var originalSetTimeout = global.setTimeout;
	var promise;

	global.setTimeout = function(callback)
	{
		return originalSetTimeout(callback, 20);
	};
	try
	{
		promise = launcher.start();
	}
	finally
	{
		global.setTimeout = originalSetTimeout;
	}

	return promise;
}

function stopWithShortGracePeriod(session)
{
	var originalSetTimeout = global.setTimeout;
	var first;
	var second;

	global.setTimeout = function(callback)
	{
		return originalSetTimeout(callback, 20);
	};
	try
	{
		first = session.stop();
		second = session.stop();
	}
	finally
	{
		global.setTimeout = originalSetTimeout;
	}

	return { first: first, second: second };
}

async function rejectionOf(promise)
{
	try
	{
		await promise;
	}
	catch (error)
	{
		return error;
	}

	throw new Error('Expected the promise to reject.');
}

function waitForState(session, eventName, predicate, timeout)
{
	return new Promise(function(resolve, reject)
	{
		var timer = setTimeout(function()
		{
			cleanup();
			reject(new Error('Timed out waiting for Target Practice "' + eventName + '" state.'));
		}, timeout);

		function cleanup()
		{
			clearTimeout(timer);
			session.removeListener(eventName, handleEvent);
			session.removeListener('error', handleError);
		}

		function handleEvent(message)
		{
			if (!predicate(message))
			{
				return;
			}

			cleanup();
			resolve(message);
		}

		function handleError(error)
		{
			cleanup();
			reject(error);
		}

		session.on(eventName, handleEvent);
		session.once('error', handleError);
	});
}

async function useSession(callback)
{
	var session = await targetpractice.start();
	try
	{
		return await callback(session);
	}
	finally
	{
		await session.stop();
	}
}

async function clickButton(session)
{
	var clicked = waitForState(session, 'click', function(event)
	{
		return event.id === 'button_1';
	}, 3000);
	var button = session.elements.button_1;
	robot.moveMouse(button.x, button.y);
	robot.mouseClick();
	return clicked;
}

test('Spawn failures reject with launch context.', { timeout: 2000 }, async function(t)
{
	var child;
	var launcher = launcherWithSpawn(function()
	{
		child = new FakeChild();
		process.nextTick(function()
		{
			child.emit('error', new Error('spawn ENOENT: fake Electron'));
		});
		return child;
	});

	var error = await rejectionOf(launcher.start());
	t.match(error.message, /Failed to launch Target Practice/);
	t.match(error.message, /cause: spawn ENOENT: fake Electron/);
	t.deepEqual(child.signals, ['SIGTERM'], 'A failed launch is cleaned up.');
	t.ok(child.stdioClosed, 'Failed-launch stdio is closed.');
});

test('Readiness timeout rejects and cleans up.', { timeout: 2000 }, async function(t)
{
	var child;
	var launcher = launcherWithSpawn(function()
	{
		child = new FakeChild();
		return child;
	});

	var error = await rejectionOf(startWithShortReadinessTimer(launcher));
	t.match(error.message, /readiness timed out/);
	t.match(error.message, /focused post-show frame and absolute element coordinates/);
	t.deepEqual(child.signals, ['SIGTERM'], 'A timed-out launch is stopped.');
	t.ok(child.stdioClosed, 'Timed-out launch stdio is closed.');
});

test('Premature clean exit rejects with stderr context.', { timeout: 2000 }, async function(t)
{
	var launcher = launcherWithSpawn(function()
	{
		var child = new FakeChild();
		process.nextTick(function()
		{
			child.stderr.write('fixture failed before readiness\n');
			child.close(0, null);
		});
		return child;
	});

	var error = await rejectionOf(launcher.start());
	t.match(error.message, /exited before reporting readiness/);
	t.match(error.message, /exit code: 0/);
	t.match(error.message, /stderr:\nfixture failed before readiness/);
});

test('Session stop is idempotent and force-kills after its grace period.', { timeout: 2000 }, async function(t)
{
	var child;
	var launcher = launcherWithSpawn(function()
	{
		child = new FakeChild(function(signal, currentChild)
		{
			if (signal === 'SIGKILL')
			{
				process.nextTick(function()
				{
					currentChild.close(null, signal);
				});
			}
			return true;
		});
		emitReady(child);
		return child;
	});

	var session = await launcher.start();
	var runtimeErrors = 0;
	session.on('error', function()
	{
		runtimeErrors++;
	});

	var stops = stopWithShortGracePeriod(session);
	t.equal(stops.first, stops.second, 'Repeated stop calls return the same promise.');
	await stops.first;
	t.deepEqual(child.signals, ['SIGTERM', 'SIGKILL'], 'Stop uses the force-kill fallback.');
	t.ok(child.stdioClosed, 'Stop waits for closed stdio.');
	t.equal(runtimeErrors, 0, 'Expected shutdown emits no runtime error.');
});

test('Start resolves with rendered absolute element coordinates.', { timeout: 10000 }, async function(t)
{
	await useSession(async function(session)
	{
		t.ok(session.elements.button_1, 'Button coordinates are available at resolution.');
		t.ok(session.elements.input_1, 'Input coordinates are available at resolution.');
		var color = session.elements.color_1;
		var targetColor = robot.getPixelColor(color.x, color.y);
		var backgroundColor = robot.getPixelColor(color.x, color.y + 100);
		t.notEqual(targetColor, backgroundColor, 'The post-show target frame is visible immediately.');
	});
});

test('Clicking remains observable through the session.', { timeout: 10000 }, async function(t)
{
	await useSession(async function(session)
	{
		var event = await clickButton(session);
		t.equal(event.id, 'button_1', 'button_1 was clicked.');
		t.equal(event.type, 'click', 'The event type is click.');
	});
});

test('Every intermediate typing state is observable.', { timeout: 10000 }, async function(t)
{
	var stringToType = 'hello world';
	await useSession(async function(session)
	{
		var states = [];
		function collectState(event)
		{
			if (event.id === 'input_1')
			{
				states.push(event.text);
			}
		}

		session.on('type', collectState);
		var typed = waitForState(session, 'type', function(event)
		{
			return event.id === 'input_1' && event.text === stringToType;
		}, 5000);
		var input = session.elements.input_1;
		robot.moveMouse(input.x, input.y);
		robot.mouseClick();
		robot.typeString(stringToType);

		var event = await typed;
		session.removeListener('type', collectState);
		var expectedStates = [];
		for (var length = 1; length <= stringToType.length; length++)
		{
			expectedStates.push(stringToType.slice(0, length));
		}
		t.equal(event.id, 'input_1', 'input_1 was used.');
		t.deepEqual(states, expectedStates, 'Every input state was emitted without debounce.');
	});
});

test('Every intermediate scroll state is observable.', { timeout: 10000 }, async function(t)
{
	await useSession(async function(session)
	{
		var states = [];
		function collectState(event)
		{
			if (event.id === 'textarea_1')
			{
				states.push(event.scroll_y);
			}
		}

		session.on('scroll', collectState);
		var scrolled = waitForState(session, 'scroll', function(event)
		{
			return event.id === 'textarea_1' && event.scroll_y === 10;
		}, 5000);
		var textarea = session.elements.textarea_1;
		robot.moveMouse(textarea.x, textarea.y);
		robot.mouseClick();
		robot.scrollMouse(0, -5);
		robot.scrollMouse(0, -5);

		var event = await scrolled;
		session.removeListener('scroll', collectState);
		t.equal(event.id, 'textarea_1', 'textarea_1 was used.');
		t.deepEqual(states, [5, 10], 'Every scroll state was emitted without debounce.');
	});
});

test('Ten consecutive start, interact, and awaited stop cycles pass.', { timeout: 60000 }, async function(t)
{
	for (var cycle = 1; cycle <= 10; cycle++)
	{
		await useSession(async function(session)
		{
			var event = await clickButton(session);
			t.equal(event.id, 'button_1', 'Cycle ' + cycle + ' interacted before stopping.');
		});
	}
});
