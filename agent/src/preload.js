'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
  // ── Window controls ─────────────────────────────────────────────────────────
  minimize: ()        => ipcRenderer.invoke('win:minimize'),
  maximize: ()        => ipcRenderer.invoke('win:maximize'),
  close:    ()        => ipcRenderer.invoke('win:close'),

  // ── Native dialogs ──────────────────────────────────────────────────────────
  pickFile:   (filters)        => ipcRenderer.invoke('dialog:file', filters),
  pickFolder: ()               => ipcRenderer.invoke('dialog:folder'),

  // ── Filesystem (constrained to allowed folders) ─────────────────────────────
  readFile:   (p, af)          => ipcRenderer.invoke('fs:read',    p, af),
  listFolder: (p, af)          => ipcRenderer.invoke('fs:list',    p, af),
  watchFolder:(p, af)          => ipcRenderer.invoke('fs:watch',   p, af),
  openPath:   (p, af)          => ipcRenderer.invoke('fs:open',    p, af),
  openApp:    (p, af)          => ipcRenderer.invoke('fs:openApp', p, af),
  backup:     (src, dst, af)   => ipcRenderer.invoke('fs:backup',  src, dst, af),

  // ── Auto-start ──────────────────────────────────────────────────────────────
  getAutostart: ()    => ipcRenderer.invoke('autostart:get'),
  setAutostart: (v)   => ipcRenderer.invoke('autostart:set', v),

  // ── Secure token (Electron safeStorage) ────────────────────────────────────
  saveToken:   (t)    => ipcRenderer.invoke('token:save', t),
  loadToken:   ()     => ipcRenderer.invoke('token:load'),
  deleteToken: ()     => ipcRenderer.invoke('token:delete'),

  // ── Persistent settings ─────────────────────────────────────────────────────
  getSettings: ()     => ipcRenderer.invoke('store:get'),
  setSettings: (d)    => ipcRenderer.invoke('store:set', d),

  // ── Action log ──────────────────────────────────────────────────────────────
  appendLog: (e)      => ipcRenderer.invoke('log:append', e),
  readLog:   ()       => ipcRenderer.invoke('log:read'),

  // ── Events pushed from main process ─────────────────────────────────────────
  onFileChanged: (cb) => ipcRenderer.on('fs:fileChanged', (_, d) => cb(d)),
});
