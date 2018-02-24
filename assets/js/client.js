/*jshint esversion: 6 */
var ipc = require('electron').ipcRenderer;

var typingTimer;
// The amount of time to wait before sending the contents of an input.
var doneTypingInterval = 500;

$('#fixture button').on('click', (event) =>
{
	ipc.send('event',
	{
		id: event.target.id,
		type: 'click'
	});
});

$('#fixture button').on('mousedown', (event) =>
{
	ipc.send('event',
	{
		id: event.target.id,
		type: 'mousedown'
	});
});

$('#fixture button').on('mouseup', (event) =>
{
	ipc.send('event',
	{
		id: event.target.id,
		type: 'mouseup'
	});
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
			ipc.send('event',
			{
				id: event.target.id,
				text: $(event.target).val(),
				type: 'type'
			});
		}
	}, doneTypingInterval);

});

$('#fixture textarea').on('scroll', (event) => {
	ipc.send('event',
	{
		id: event.target.id,
		type: 'scroll',
		scroll_y: event.target.scrollTop,
		scroll_x: event.target.scrollLeft,
	});
});

ipc.on('elements', () =>
{
	var elements = {};
	$("#fixture").children().each(function()
	{
		elements[$(this).attr('id')] = getInfo($(this)[0]);

	});
	ipc.send('elements', elements);
});

function getInfo(el)
{
	return {
		x: el.offsetLeft + (el.offsetWidth / 2),
		y: el.offsetTop + (el.offsetHeight / 2)
	};
}
