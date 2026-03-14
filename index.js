var spawn = require('child_process').spawn;
var EventEmitter = require('events').EventEmitter;
var os = require('os');
var targetpractice = null;
var electron = require('electron');

function makeLaunchError(message, stderr, code, signal)
{
	var details = [];

	if (code !== undefined && code !== null)
	{
		details.push('exit code: ' + code);
	}

	if (signal)
	{
		details.push('signal: ' + signal);
	}

	if (stderr)
	{
		details.push('stderr:\n' + stderr.trim());
	}

	return new Error(message + (details.length ? '\n' + details.join('\n') : ''));
}

module.exports.start = function start()
{
	var emitter = new EventEmitter();
	var stdoutBuffer = '';
	var stderrBuffer = '';
	var args = [];

	if (os.platform() === 'linux')
	{
		args.push('--no-sandbox', '--disable-setuid-sandbox');
	}

	args.push(__dirname);

	targetpractice = spawn(electron, args,
	{
		detached: false,
		stdio: ['ignore', 'pipe', 'pipe']
	});

	emitter.stopped = false;
	targetpractice.emitter = emitter;

	targetpractice.stdout.on('data', function(data)
	{
		stdoutBuffer += data.toString('utf8');
		var messages = stdoutBuffer.split(/\r?\n/);
		stdoutBuffer = messages.pop();

		for (var x in messages)
		{
			try
			{
				var msg = JSON.parse(messages[x]);
				emitter.emit(msg.event, msg.message);
			}
			catch (e)
			{
				console.log("Couldn't decode JSON:");
				console.log(messages[x]);
			}
		}
	});

	targetpractice.stderr.on('data', function(data)
	{
		var chunk = data.toString('utf8');
		stderrBuffer += chunk;
		process.stderr.write(chunk);
	});

	targetpractice.on('error', function(err)
	{
		if (!emitter.stopped)
		{
			emitter.emit('error', err);
		}
	});

	targetpractice.on('exit', function(code, signal)
	{
		if (!emitter.stopped && code !== 0)
		{
			emitter.emit('error', makeLaunchError('Target Practice exited before the fixture loaded.', stderrBuffer, code, signal));
		}
	});

	return emitter;
};

module.exports.stop = function stop()
{
	if (targetpractice !== null)
	{
		if (targetpractice.emitter)
		{
			targetpractice.emitter.stopped = true;
		}
		if (targetpractice.stdin)
		{
			targetpractice.stdin.pause();
		}
		targetpractice.kill();
		targetpractice = null;
	}
	else
	{
		console.log("No process.");
	}
};
