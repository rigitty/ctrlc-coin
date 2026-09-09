const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

let mainWindow = null;
let spawnedNodeProcess = null;

function checkIsNodeRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/blocks`, (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startPythonNode(port) {
  try {
    const projectRoot = path.join(__dirname, '..');
    const pyScript = path.join(projectRoot, 'node.py');
    
    // Spawn Python node in background
    const py = spawn('python', [pyScript, String(port)], {
      cwd: projectRoot,
      windowsHide: true,
      stdio: 'ignore'
    });

    spawnedNodeProcess = py;

    py.on('error', (err) => {
      console.error('[Electron] Failed to start background Python node:', err);
    });
  } catch (err) {
    console.error('[Electron] Error launching node.py:', err);
  }
}

function cleanupPythonNode() {
  if (spawnedNodeProcess && spawnedNodeProcess.pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${spawnedNodeProcess.pid} /F /T`, { stdio: 'ignore' });
      } else {
        spawnedNodeProcess.kill();
      }
    } catch (e) {}
    spawnedNodeProcess = null;
  }
}

async function createWindow() {
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

  // Check if python node is already active on this port. If not, auto-launch it!
  const isRunning = await checkIsNodeRunning(targetPort);
  if (!isRunning) {
    startPythonNode(targetPort);
  }

  const winWidth = Math.min(1180, width - 40);
  const winHeight = Math.min(840, height - 40);

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 840,
    minHeight: 580,
    frame: false, // Frameless window - custom app titlebar
    backgroundColor: '#08090c',
    icon: path.join(__dirname, 'public', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });

  const baseDevUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  mainWindow.loadURL(`${baseDevUrl}?port=${targetPort}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupPythonNode();
  });
}

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  cleanupPythonNode();
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(createWindow);

app.on('before-quit', () => {
  cleanupPythonNode();
});

app.on('will-quit', () => {
  cleanupPythonNode();
});

process.on('exit', () => {
  cleanupPythonNode();
});

app.on('window-all-closed', () => {
  cleanupPythonNode();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
