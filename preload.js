const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('targetPractice', {
	onElements(listener)
	{
		ipcRenderer.on('elements', () => listener());
	},
	sendEvent(message)
	{
		ipcRenderer.send('event', message);
	},
	sendElements(message)
	{
		ipcRenderer.send('elements', message);
	}
});
