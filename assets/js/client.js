let typingTimer;
let scrollingTimer;
// The amount of time to wait before sending the contents of an input.
const doneTypingInterval = 500;
const doneScrollingInterval = 500;
const fixture = document.getElementById('fixture');

for (const button of fixture.querySelectorAll('button'))
{
	button.addEventListener('click', (event) =>
	{
		window.targetPractice.sendEvent({
			id: event.target.id,
			type: 'click'
		});
	});

	button.addEventListener('mousedown', (event) =>
	{
		window.targetPractice.sendEvent({
			id: event.target.id,
			type: 'mousedown'
		});
	});

	button.addEventListener('mouseup', (event) =>
	{
		window.targetPractice.sendEvent({
			id: event.target.id,
			type: 'mouseup'
		});
	});
}

for (const input of fixture.querySelectorAll('input'))
{
	input.addEventListener('input', (event) =>
	{
		clearTimeout(typingTimer);
		typingTimer = setTimeout(() =>
		{
			if (event.target.value)
			{
				window.targetPractice.sendEvent({
					id: event.target.id,
					text: event.target.value,
					type: 'type'
				});
			}
		}, doneTypingInterval);
	});
}

for (const textarea of fixture.querySelectorAll('textarea'))
{
	textarea.addEventListener('scroll', (event) =>
	{
		clearTimeout(scrollingTimer);
		scrollingTimer = setTimeout(() =>
		{
			window.targetPractice.sendEvent({
				id: event.target.id,
				type: 'scroll',
				scroll_y: event.target.scrollTop,
				scroll_x: event.target.scrollLeft
			});
		}, doneScrollingInterval);
	});
}

window.targetPractice.onElements(() =>
{
	const elements = {};
	for (const child of fixture.children)
	{
		elements[child.id] = getInfo(child);
	}
	window.targetPractice.sendElements(elements);
});

function getInfo(el)
{
	return {
		x: el.offsetLeft + (el.offsetWidth / 2),
		y: el.offsetTop + (el.offsetHeight / 2)
	};
}
