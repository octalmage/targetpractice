Target Practice
========

> Test UI automation tools using Node.js.

Target Practice is a tool that will allow you to test UI automation tools. It's a cross platform GUI that will send detected events like clicking/typing back to your tests over stdout.

See [test.js](test.js) as an example.

## Story

I've been working on [RobotJS](https://github.com/octalmage/robotjs) which allows you to control the mouse and keyboard.
For a while now I've been trying to find a way to test this. How do you confirm
that the mouse was clicked, or that a string was typed? I've been looking for an
independent tool to help me do this. It doesn't exist, so I created Target Practice.