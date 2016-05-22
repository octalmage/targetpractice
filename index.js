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
		var msg = JSON.parse(data.toString('utf8'));

		emitter.emit(msg.event, msg.message);

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