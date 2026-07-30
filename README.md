Target Practice
========

> Test UI automation tools using Node.js.

Target Practice is a cross-platform GUI fixture that reports clicking, typing, and scrolling events to Node.js tests.

## Usage

```js
const targetpractice = require('targetpractice/index.js');

const target = await targetpractice.start();

target.elements;
target.on('click', handler);
target.on('type', handler);
target.on('scroll', handler);

await target.stop();
```

`start()` resolves after the fixture is shown, focused, has rendered a post-show frame, and has reported absolute coordinates through `target.elements`. Type and scroll events are emitted for every state change, so consumers should wait for the state they expect. `target.stop()` is idempotent and resolves only after the owned Electron process and its stdio have closed.

See [test.js](test.js) for complete interaction and teardown examples.

## Story

Target Practice was created to test [RobotJS](https://github.com/octalmage/robotjs) mouse, keyboard, and screen automation against an independent GUI fixture.