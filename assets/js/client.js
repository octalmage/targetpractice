/*jshint esversion: 6 */
var ipc = require('electron').ipcRenderer;

var typingTimer;
// The amount of time to wait before sending the contents of an input.
var doneTypingInterval = 500;

$('#fixture button').on('click', (event) =>
{
	ipc.send('click', {id: event.target.id});
});

// Logic to send text when the "user" is finished typing.
$('#fixture input').on('keydown', (event) =>
{
	 clearTimeout(typingTimer);
});

$('#fixture input').on('keyup', (event) =>
{
	// They started typing again, clear the timer.
	clearTimeout(typingTimer);
	// Restart the timer!
	typingTimer = setTimeout(() =>
	{
		// It's been enough time they're probably finished.
		if ($(event.target).val())
		{
			ipc.send('type', {
				id: event.target.id,
				text: $(event.target).val()
			});
		}
	}, doneTypingInterval);

});

ipc.on('elements', () =>
{
	var elements = {};
	$( "#fixture" ).children().each(function ()
	{
		elements[$(this).attr('id')] = getInfo($(this)[0]);

	});
	ipc.send('elements', elements);
});

function getInfo( el ) {
	return {
		x: el.offsetLeft + (el.offsetWidth / 2),
		y: el.offsetTop + (el.offsetHeight / 2)
	};
}