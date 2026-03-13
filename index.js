var spawn = require('child_process').spawn;
var EventEmitter = require('events').EventEmitter;
var targetpractice = null;
var electron = require('electron');

module.exports.start = function start()
{
	var emitter = new EventEmitter();
	var stdoutBuffer = '';

	targetpractice = spawn(electron, [__dirname],
	{
		detached: false,
		stdio: ['ignore', 'pipe', 'pipe']
	});

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

	return emitter;
};

module.exports.stop = function stop()
{
	if (targetpractice !== null)
	{
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
