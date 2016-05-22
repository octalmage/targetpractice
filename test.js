/* jshint esversion: 6 */
var test = require('tape');
var robot = require('robotjs');
var targetpractice = require('./index.js');

robot.setMouseDelay(100);

var elements;


test('Test clicking.',{timeout: 2000}, function(t)
{
	t.plan(1);

	var target = targetpractice.start();

	target.on('elements', function(elements)
	{
		var button_1 = elements.button_1;
		robot.moveMouse(button_1.x, button_1.y);
		robot.mouseClick();
	});

	target.on('click', function(element)
	{
		t.equal(element.id, "button_1", 'Confirm button_1 was clicked.');
	});

	t.on("end", function()
	{
		targetpractice.stop();
	});
});

test('Test typing.',{timeout: 5000}, function(t)
{
	t.plan(2);

	var target = targetpractice.start();
	var stringToType = "hello world";

	target.on('elements', function(elements)
	{
		var input_1 = elements.input_1;
		robot.moveMouse(input_1.x, input_1.y);
		robot.mouseClick();
		robot.typeString(stringToType);
	});

	target.on('type', function(element)
	{
		t.equal(element.id, "input_1", 'Confirm input_1 was used.');
		t.equal(element.text, stringToType, `Confirm that ${stringToType} was typed.`);
	});

	t.on("end", function()
	{
		targetpractice.stop();
	});
});

