const { app, BrowserWindow } = require('electron');
const path = require('path');

// Extract target node port from arguments: e.g. --port=5000 or --port=5001
let targetPort = '5000';
for (const arg of process.argv) {
  if (arg.startsWith('--port=')) {
    targetPort = arg.split('=')[1];
  } else if (arg.startsWith('--nodePort=')) {
    targetPort = arg.split('=')[1];
  }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1250,
    height: 880,
    minWidth: 950,
    minHeight: 650,
    title: `CtrlC-Coin Node Client (: ${targetPort})`,
    backgroundColor: '#0c0f17',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });

  const baseDevUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  mainWindow.loadURL(`${baseDevUrl}?port=${targetPort}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
