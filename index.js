var spawn = require('child_process').spawn;
var EventEmitter = require('events').EventEmitter;
var path = require('path');
var targetpractice = null;
var electron = require('electron');
var endOfLine = require('os').EOL;

module.exports.start = function start()
{
	var emitter = new EventEmitter();

	targetpractice = spawn(electron, [__dirname],
	{
		detached: true
	});

	targetpractice.stdout.on('data', function(data)
	{
		// We could have multiple messages, split on newline and remove empty strings.
		var messages = data.toString('utf8').split(endOfLine).filter(function(x) { return x.length !== 0; });
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
				console.log(messages.toString('utf8'));
			}
		}
	});

	return emitter;
};

module.exports.stop = function stop()
{
	if (targetpractice !== null)
	{
		targetpractice.stdin.pause();
		targetpractice.kill();
		targetpractice = null;
	}
    else
    {
        console.log("No process.");
    }
};
