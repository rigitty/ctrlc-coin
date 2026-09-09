const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  let targetPort = '5000';
  for (const arg of process.argv) {
    if (arg.startsWith('--port=')) {
      targetPort = arg.split('=')[1];
    } else if (arg.startsWith('--nodePort=')) {
      targetPort = arg.split('=')[1];
    }
  }

  const winWidth = Math.min(1180, width - 40);
  const winHeight = Math.min(860, height - 40);

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 800,
    minHeight: 600,
    title: `CtrlC-Coin Desktop (: ${targetPort})`,
    backgroundColor: '#08090c',
    icon: path.join(__dirname, 'public', 'logo.png'),
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
