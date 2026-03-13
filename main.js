const path = require('path');
const { app, BrowserWindow, ipcMain, screen } = require('electron');

let window = null;

app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('force-raster-color-profile', 'srgb');

ipcMain.on('event', (event, message) =>
{
	send(message.type, message);
});

ipcMain.on('elements', (event, message) =>
{
	send('elements', addToElements(message));
});

function createWindow()
{
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;

	window = new BrowserWindow({
		x: 0,
		y: 0,
		width,
		height,
		frame: false,
		alwaysOnTop: true,
		acceptFirstMouse: true,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, 'preload.js')
		}
	});

	window.webContents.on('did-finish-load', () =>
	{
		app.focus({ steal: true });
		window.moveTop();
		window.focus();

		// TODO: There has to be a better way to prevent the visual flash. It
		// breaks the screen related tests.
		setTimeout(() => window.webContents.send('elements'), 100);
	});

	window.on('closed', () =>
	{
		window = null;
		app.quit();
	});

	window.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

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
 */
function addToElements(elements)
{
	const winPos = window.getPosition();
	for (const x in elements)
	{
		elements[x].x += winPos[0];
		elements[x].y += winPos[1];
	}
	return elements;
}
