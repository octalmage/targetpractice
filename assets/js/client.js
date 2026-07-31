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
		window.targetPractice.sendEvent({
			id: event.currentTarget.id,
			text: event.currentTarget.value,
			type: 'type'
		});
	});
}

for (const textarea of fixture.querySelectorAll('textarea'))
{
	textarea.addEventListener('scroll', (event) =>
	{
		window.targetPractice.sendEvent({
			id: event.currentTarget.id,
			type: 'scroll',
			scroll_y: event.currentTarget.scrollTop,
			scroll_x: event.currentTarget.scrollLeft
		});
	});
}

window.targetPractice.onElements(() =>
{
	requestAnimationFrame(() =>
	{
		requestAnimationFrame(() =>
		{
			const elements = {};
			for (const child of fixture.children)
			{
				elements[child.id] = getInfo(child);
			}
			window.targetPractice.sendElements(elements);
		});
	});
});

function getInfo(el)
{
	const bounds = el.getBoundingClientRect();
	return {
		x: Math.round(bounds.left + (bounds.width / 2)),
		y: Math.round(bounds.top + (bounds.height / 2))
	};
}
