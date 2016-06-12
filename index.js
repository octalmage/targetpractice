var spawn = require('child_process').spawn;
var EventEmitter = require('events').EventEmitter;

var targetpractice = null;

module.exports.start = function start()
{
	var emitter = new EventEmitter();

	targetpractice = spawn('electron', ['.'],
	{
		detached: true
	});

	targetpractice.stdout.on('data', function(data)
	{
		// We could have multiple messages, split on newline and remove empty strings.
		var messages = data.toString('utf8').split("\n").filter(function(x) { return x.length !== 0; });
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
		/**
		 * Kill the process, technique described below:
		 * http://azimi.me/2014/12/31/kill-child_process-node-js.html
		 */
		process.kill(-targetpractice.pid);
		targetpractice = null;
	}
    else
    {
        console.log("No process.");
    }
};