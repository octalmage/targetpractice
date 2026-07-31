const path = require('path');
const { app, BrowserWindow, ipcMain, screen } = require('electron');

let window = null;
let applicationActive = process.platform !== 'darwin';

if (process.platform === 'darwin')
{
	app.on('did-become-active', () =>
	{
		applicationActive = true;
	});
	app.on('did-resign-active', () =>
	{
		applicationActive = false;
	});
}

app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('force-raster-color-profile', 'srgb');

ipcMain.on('event', (event, message) =>
{
	send(message.type, message);
});

ipcMain.on('elements', (event, message) =>
{
	if (!window || window.isDestroyed() || event.sender !== window.webContents)
	{
		return;
	}

	// macOS needs native presentation before system input is accepted. Elsewhere,
	// the renderer's two frames avoid a GPU-dependent subscription under Xvfb.
	if (process.platform === 'darwin')
	{
		reportAfterPresentedFrame(window, message);
	}
	else if (
		applicationActive &&
		window.isVisible() &&
		window.isFocused() &&
		window.webContents.isFocused()
	)
	{
		send('elements', addToElements(message, window));
	}
});

async function createWindow()
{
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;
	const targetWindow = new BrowserWindow({
		x: 0,
		y: 0,
		width,
		height,
		show: false,
		frame: false,
		alwaysOnTop: true,
		acceptFirstMouse: true,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, 'preload.js')
		}
	});

	window = targetWindow;
	targetWindow.on('closed', () =>
	{
		if (window === targetWindow)
		{
			window = null;
		}
		app.quit();
	});

	const readyToShow = new Promise(resolve =>
	{
		targetWindow.once('ready-to-show', resolve);
	});

	await Promise.all([
		targetWindow.loadFile(path.join(__dirname, 'index.html')),
		readyToShow
	]);

	await showAndFocus(targetWindow);
	targetWindow.webContents.send('elements');
}

async function showAndFocus(targetWindow)
{
	const shown = new Promise(resolve =>
	{
		targetWindow.once('show', resolve);
	});
	const focused = new Promise(resolve =>
	{
		targetWindow.once('focus', resolve);
	});
	const active = waitForApplicationActivation();

	app.focus({ steal: true });
	targetWindow.showInactive();
	await shown;
	targetWindow.moveTop();
	targetWindow.focus();
	await Promise.all([focused, active]);
	targetWindow.focusOnWebView();
	targetWindow.webContents.focus();
}

function waitForApplicationActivation()
{
	if (applicationActive)
	{
		return Promise.resolve();
	}

	return new Promise(resolve =>
	{
		app.once('did-become-active', resolve);
	});
}

function reportAfterPresentedFrame(targetWindow, elements)
{
	const contents = targetWindow.webContents;
	let reported = false;

	contents.beginFrameSubscription(() =>
	{
		if (
			reported ||
			contents.isDestroyed() ||
			!contents.isFocused() ||
			!applicationActive ||
			!targetWindow.isVisible() ||
			!targetWindow.isFocused()
		)
		{
			return;
		}

		reported = true;
		contents.endFrameSubscription();
		send('elements', addToElements(elements, targetWindow));
	});
	contents.invalidate();
}

app.whenReady().then(createWindow).catch(error =>
{
	console.error('Target Practice failed to create the fixture window:', error);
	app.exit(1);
});

app.on('window-all-closed', () =>
{
	app.quit();
});

/**
 * Log an event to stdout as JSON.
 * @param  {string} event The name of the event.
 * @param  {string} msg   The event contents.
 */
function send(event, msg)
{
	let toSend;
	if (!msg)
	{
		toSend = {"event" : event};
	}
	else
	{
		toSend = {
			"event" : event,
			"message": msg
		};
	}

	console.log(JSON.stringify(toSend));
}

/**
 * Pad element positions using the Window's absolute position as an offset.
 * @param object elements An object containing the elements and their positions.
 * @param BrowserWindow targetWindow The window containing the elements.
 */
function addToElements(elements, targetWindow)
{
	const winPos = targetWindow.getPosition();
	for (const x in elements)
	{
		elements[x].x += winPos[0];
		elements[x].y += winPos[1];
	}
	return elements;
}
