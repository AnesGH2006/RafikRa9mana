'use strict';

const {
  app, BrowserWindow, ipcMain, Tray, Menu,
  shell, dialog, nativeTheme,
} = require('electron');
const path = require('path');
const fs   = require('fs');

const isDev = process.argv.includes('--dev');

let mainWindow = null;
let tray       = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function isPathAllowed(targetPath, allowedFolders) {
  if (!Array.isArray(allowedFolders) || allowedFolders.length === 0) return false;
  const norm = path.normalize(targetPath);
  return allowedFolders.some((f) => norm.startsWith(path.normalize(f)));
}

function dataPath(filename) {
  return path.join(app.getPath('userData'), filename);
}

// ── Window ─────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:     980,
    height:    680,
    minWidth:  820,
    minHeight: 560,
    title:     'School Manager Agent',
    frame:     false,
    backgroundColor: '#0f172a',
    show:      false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Hide to tray instead of closing
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const iconFile = path.join(__dirname, '..', 'assets', 'tray.png');
  const fallback = path.join(__dirname, '..', 'assets', 'icon.png');
  const icon = fs.existsSync(iconFile) ? iconFile : (fs.existsSync(fallback) ? fallback : null);

  if (!icon) { tray = null; return; }

  tray = new Tray(icon);
  tray.setToolTip('School Manager Agent');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'إظهار النافذة', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'إنهاء',          click: () => { app.exit(0); } },
  ]));
  tray.on('click', () => mainWindow?.show());
}

// ── App lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  nativeTheme.themeSource = 'dark';
});

app.on('window-all-closed', (e) => e.preventDefault()); // keep alive in tray
app.on('activate', () => mainWindow?.show());

// ── IPC: window controls ───────────────────────────────────────────────────────
ipcMain.handle('win:minimize', () => mainWindow?.minimize());
ipcMain.handle('win:maximize', () =>
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.handle('win:close',   () => mainWindow?.hide());

// ── IPC: dialogs ───────────────────────────────────────────────────────────────
ipcMain.handle('dialog:file', async (_e, filters) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters ?? [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

// ── IPC: filesystem (constrained) ─────────────────────────────────────────────
ipcMain.handle('fs:read', async (_e, filePath, allowedFolders) => {
  if (!isPathAllowed(filePath, allowedFolders)) throw new Error('Path not in allowed folders');
  return fs.promises.readFile(filePath);
});

ipcMain.handle('fs:list', async (_e, folderPath, allowedFolders) => {
  if (!isPathAllowed(folderPath, allowedFolders)) throw new Error('Path not in allowed folders');
  const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
  return entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }));
});

const watchers = new Map();
ipcMain.handle('fs:watch', async (_e, folderPath, allowedFolders) => {
  if (!isPathAllowed(folderPath, allowedFolders)) throw new Error('Path not in allowed folders');
  if (watchers.has(folderPath)) return { watching: true, existing: true };

  const w = fs.watch(folderPath, { recursive: false }, (eventType, filename) => {
    if (filename && /\.(xlsx|xls)$/i.test(filename)) {
      mainWindow?.webContents.send('fs:fileChanged', { eventType, filename, folder: folderPath });
    }
  });
  watchers.set(folderPath, w);
  return { watching: true };
});

ipcMain.handle('fs:open', async (_e, targetPath, allowedFolders) => {
  if (!isPathAllowed(targetPath, allowedFolders)) throw new Error('Path not in allowed folders');
  const err = await shell.openPath(targetPath);
  if (err) throw new Error(err);
  return { ok: true };
});

ipcMain.handle('fs:openApp', async (_e, appPath, allowedFolders) => {
  if (!isPathAllowed(appPath, allowedFolders)) throw new Error('Path not in allowed folders');
  const err = await shell.openPath(appPath);
  if (err) throw new Error(err);
  return { ok: true };
});

ipcMain.handle('fs:backup', async (_e, srcFolder, destFolder, allowedFolders) => {
  if (!isPathAllowed(srcFolder,  allowedFolders)) throw new Error('Source path not in allowed folders');
  if (!isPathAllowed(destFolder, allowedFolders)) throw new Error('Destination path not in allowed folders');

  await fs.promises.mkdir(destFolder, { recursive: true });
  const files = await fs.promises.readdir(srcFolder);
  let copied = 0;
  for (const f of files) {
    if (/\.(pdf|xlsx|xls)$/i.test(f)) {
      await fs.promises.copyFile(
        path.join(srcFolder, f),
        path.join(destFolder, f),
      );
      copied++;
    }
  }
  return { ok: true, copied };
});

// ── IPC: auto-start ────────────────────────────────────────────────────────────
ipcMain.handle('autostart:get', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('autostart:set', (_e, enabled) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
  return Boolean(enabled);
});

// ── IPC: settings (plain JSON in userData) ─────────────────────────────────────
const SETTINGS_PATH = dataPath('settings.json');
ipcMain.handle('store:get', async () => {
  try { return JSON.parse(await fs.promises.readFile(SETTINGS_PATH, 'utf-8')); }
  catch { return {}; }
});
ipcMain.handle('store:set', async (_e, data) => {
  await fs.promises.writeFile(SETTINGS_PATH, JSON.stringify(data, null, 2));
  return true;
});

// ── IPC: secure token (safeStorage) ───────────────────────────────────────────
const TOKEN_PATH = dataPath('.agent_token');
ipcMain.handle('token:save', async (_e, token) => {
  const { safeStorage } = require('electron');
  const enc = safeStorage.encryptString(String(token));
  await fs.promises.writeFile(TOKEN_PATH, enc);
  return true;
});
ipcMain.handle('token:load', async () => {
  const { safeStorage } = require('electron');
  try {
    const enc = await fs.promises.readFile(TOKEN_PATH);
    return safeStorage.decryptString(enc);
  } catch { return null; }
});
ipcMain.handle('token:delete', async () => {
  try { await fs.promises.unlink(TOKEN_PATH); } catch {}
  return true;
});

// ── IPC: action log ────────────────────────────────────────────────────────────
const LOG_PATH    = dataPath('agent.log');
const MAX_LINES   = 500;

ipcMain.handle('log:append', async (_e, entry) => {
  const line = JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n';
  await fs.promises.appendFile(LOG_PATH, line);
  return true;
});

ipcMain.handle('log:read', async () => {
  try {
    const raw = await fs.promises.readFile(LOG_PATH, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.slice(-MAX_LINES).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
});
