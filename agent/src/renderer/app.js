'use strict';

// ── Socket.IO client loaded via CDN-style require is unavailable in renderer.
// We import it via the preload-exposed API through the main process IPC bridge.
// The actual socket connection is managed here in the renderer using the
// socket.io-client bundled in node_modules (accessed via preload IPC helpers).

const api = window.agent; // exposed by preload.js via contextBridge

// ── State ─────────────────────────────────────────────────────────────────────
const State = {
  connected:     false,
  token:         null,
  deviceName:    null,
  serverUrl:     null,
  allowedFolders: [],
  logs:          [],
  socket:        null,
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ''; }, 3000);
}

// ── Navigation ─────────────────────────────────────────────────────────────────
function nav(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + pageId)?.classList.add('active');
  btn?.classList.add('active');

  if (pageId === 'tasks')       App.refreshLogs();
  if (pageId === 'settings')    App.loadSettingsUI();
  if (pageId === 'permissions') App.renderFolders();
}

// ── Status dot ─────────────────────────────────────────────────────────────────
function setStatus(status, label) {
  const dot = document.getElementById('status-dot');
  const lbl = document.getElementById('status-label');
  dot.className = 'status-dot ' + status;
  lbl.textContent = label;
  document.getElementById('info-status').textContent = label;
  State.connected = (status === 'connected');
}

// ── Socket connection (via IPC → main process) ─────────────────────────────────
// The renderer cannot directly require socket.io-client (nodeIntegration=false).
// We use a small IPC bridge: main process owns the socket, renderer sends/receives
// messages via ipcRenderer (preload), keeping the renderer fully sandboxed.
//
// For simplicity in this build the socket lives in the renderer via a <script>
// tag pointing to the local node_modules bundle. We use a dynamic script inject.

let _socket = null;

async function loadSocketIO() {
  return new Promise((resolve, reject) => {
    if (window.io) { resolve(window.io); return; }
    const s = document.createElement('script');
    // socket.io-client ships a browser bundle
    s.src = '../../node_modules/socket.io-client/dist/socket.io.min.js';
    s.onload  = () => resolve(window.io);
    s.onerror = () => reject(new Error('Failed to load socket.io-client'));
    document.head.appendChild(s);
  });
}

async function connectSocket(token, serverUrl) {
  try {
    const io = await loadSocketIO();
    _socket = io(serverUrl, {
      path:       '/agent-socket',
      auth:       { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: Infinity,
    });

    _socket.on('connect', () => {
      setStatus('connected', 'متصل');
      document.getElementById('info-lastseen').textContent = new Date().toLocaleTimeString('ar-DZ');
      toast('تم الاتصال بالخادم بنجاح');
      api.appendLog({ level: 'INFO', message: 'Connected to server', serverUrl });
    });

    _socket.on('connect_error', (err) => {
      setStatus('error', 'خطأ في الاتصال');
      toast('تعذّر الاتصال: ' + err.message, 'error');
    });

    _socket.on('disconnect', (reason) => {
      setStatus('disconnected', 'غير متصل');
      toast('انقطع الاتصال: ' + reason, 'error');
    });

    _socket.on('agent:command', (payload) => {
      handleCommand(payload);
    });

    // Heartbeat
    setInterval(() => {
      if (_socket?.connected) {
        _socket.emit('agent:ping', (res) => { /* keep-alive */ });
      }
    }, 30_000);

  } catch (err) {
    setStatus('error', 'خطأ');
    toast('فشل تحميل وحدة الاتصال: ' + err.message, 'error');
  }
}

function reportResult(action, status, details) {
  _socket?.emit('agent:taskResult', { action, status, details });
}

// ── Command dispatcher ─────────────────────────────────────────────────────────
async function handleCommand({ action, payload }) {
  api.appendLog({ level: 'INFO', message: `Command received: ${action}`, payload });
  let result, status;
  try {
    switch (action) {
      case 'openFolder':
        result = await api.openPath(payload.path, State.allowedFolders);
        break;
      case 'openFile':
        result = await api.openPath(payload.path, State.allowedFolders);
        break;
      case 'openApp':
        result = await api.openApp(payload.path, State.allowedFolders);
        break;
      case 'backupReports':
        result = await api.backup(payload.sourceFolder, payload.destFolder, State.allowedFolders);
        break;
      case 'monitorFolder':
        result = await api.watchFolder(payload.path, State.allowedFolders);
        break;
      case 'syncData':
        result = { ok: true, acknowledged: true };
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
    status = 'success';
    toast('تم تنفيذ: ' + actionLabel(action));
    api.appendLog({ level: 'INFO', message: `Task success: ${action}`, result });
  } catch (err) {
    status = 'failed';
    result = { error: err.message };
    toast('فشل تنفيذ: ' + actionLabel(action), 'error');
    api.appendLog({ level: 'ERROR', message: `Task failed: ${action}`, error: err.message });
  }
  reportResult(action, status, result);
  // Refresh task list if visible
  if (document.getElementById('page-tasks').classList.contains('active')) App.refreshLogs();
}

// ── Login ──────────────────────────────────────────────────────────────────────
async function login() {
  const tokenInput  = document.getElementById('login-token');
  const deviceInput = document.getElementById('login-device');
  const errEl       = document.getElementById('login-error');
  const btn         = document.querySelector('#login-screen .btn-primary');
  const token  = tokenInput.value.trim();
  const device = deviceInput.value.trim() || 'حاسوب الإدارة';
  errEl.textContent = '';

  if (!token) { errEl.textContent = 'يرجى إدخال رمز الوكيل.'; return; }

  const urlInput  = document.getElementById('login-url');
  const serverUrl = (urlInput?.value || '').trim().replace(/\/$/, '');
  if (!serverUrl) { errEl.textContent = 'يرجى إدخال عنوان الخادم (Server URL).'; return; }

  // Show loading state
  const origText = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الاتصال…'; }
  errEl.textContent = '';

  const settings = await api.getSettings();

  try {
    let res;
    try {
      res = await fetch(`${serverUrl}/api/agent/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (netErr) {
      // Network error or CORS — give actionable message
      errEl.textContent = `تعذّر الوصول إلى الخادم. تحقق من العنوان أو اتصالك بالإنترنت. (${netErr.message})`;
      return;
    }

    if (res.status === 401) {
      errEl.textContent = 'الرمز غير صالح أو منتهي الصلاحية — أنشئ رمزاً جديداً من لوحة التحكم.';
      return;
    }
    if (!res.ok) {
      errEl.textContent = `خطأ من الخادم (${res.status}) — تأكد من أن الخادم يعمل وأن الرمز صحيح.`;
      return;
    }

    const data = await res.json();

    // Save credentials
    await api.saveToken(token);
    await api.setSettings({ ...settings, serverUrl, deviceName: device });

    State.token          = token;
    State.deviceName     = data.deviceName ?? device;
    State.serverUrl      = serverUrl;
    State.allowedFolders = data.allowedFolders ?? [];

    // Update UI
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('info-device').textContent = State.deviceName;
    document.getElementById('info-server').textContent = serverUrl;
    document.getElementById('kpi-folders').textContent = State.allowedFolders.length;
    renderFolders();

    await connectSocket(token, serverUrl);
    refreshDashboard(data.recentLogs ?? []);

  } catch (err) {
    errEl.textContent = 'خطأ غير متوقع: ' + err.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
}

function refreshDashboard(logs) {
  const ok   = logs.filter(l => l.status === 'success').length;
  const fail = logs.filter(l => l.status === 'failed').length;
  const ups  = logs.filter(l => l.action === 'upload_excel').length;
  document.getElementById('kpi-tasks-ok').textContent   = ok;
  document.getElementById('kpi-tasks-fail').textContent = fail;
  document.getElementById('kpi-uploads').textContent    = ups;

  const tbody = document.getElementById('recent-tasks-body');
  if (!logs.length) { tbody.innerHTML = '<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:20px">لا توجد مهام بعد</td></tr>'; return; }
  tbody.innerHTML = logs.slice(0, 10).map(l => `
    <tr>
      <td>${actionLabel(l.action)}</td>
      <td>${badgeHtml(l.status)}</td>
      <td style="font-size:11px;color:var(--muted)">${fmtDate(l.createdAt)}</td>
    </tr>`).join('');
}

// ── Logout ─────────────────────────────────────────────────────────────────────
async function logout() {
  _socket?.disconnect();
  _socket = null;
  await api.deleteToken();
  State.token = null;
  setStatus('disconnected', 'غير متصل');
  document.getElementById('login-screen').classList.remove('hidden');
}

// ── Reconnect ──────────────────────────────────────────────────────────────────
async function reconnect() {
  if (!State.token || !State.serverUrl) { toast('يرجى تسجيل الدخول أولاً', 'error'); return; }
  _socket?.disconnect();
  await connectSocket(State.token, State.serverUrl);
}

// ── Folder permissions ─────────────────────────────────────────────────────────
async function pickFolder() {
  const folder = await api.pickFolder();
  if (folder) document.getElementById('folder-input').value = folder;
}

function addFolder() {
  const val = document.getElementById('folder-input').value.trim();
  if (!val) return;
  if (!State.allowedFolders.includes(val)) {
    State.allowedFolders.push(val);
    document.getElementById('kpi-folders').textContent = State.allowedFolders.length;
    renderFolders();
  }
  document.getElementById('folder-input').value = '';
}

function removeFolder(idx) {
  State.allowedFolders.splice(idx, 1);
  document.getElementById('kpi-folders').textContent = State.allowedFolders.length;
  renderFolders();
}

function renderFolders() {
  const el = document.getElementById('folders-list');
  if (!State.allowedFolders.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px">لا توجد مجلدات مُضافة</p>';
    return;
  }
  el.innerHTML = State.allowedFolders.map((f, i) => `
    <div class="folder-item">
      <svg viewBox="0 0 20 20" fill="var(--accent)" width="16"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
      <span class="folder-path">${f}</span>
      <button class="remove-btn" onclick="App.removeFolder(${i})" title="إزالة">×</button>
    </div>`).join('');
}

async function saveFolders() {
  if (!State.token || !State.serverUrl) { toast('يجب الاتصال أولاً', 'error'); return; }
  try {
    const res = await fetch(`${State.serverUrl}/api/agent/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${State.token}` },
      body: JSON.stringify({ folders: State.allowedFolders }),
    });
    if (!res.ok) throw new Error(await res.text());
    toast('تم حفظ صلاحيات المجلدات بنجاح');
  } catch (err) {
    toast('فشل الحفظ: ' + err.message, 'error');
  }
}

// ── Task log ───────────────────────────────────────────────────────────────────
async function refreshLogs() {
  if (!State.token || !State.serverUrl) return;
  try {
    const res = await fetch(`${State.serverUrl}/api/agent/logs?limit=100`, {
      headers: { Authorization: `Bearer ${State.token}` },
    });
    if (!res.ok) return;
    const logs = await res.json();
    document.getElementById('task-count').textContent = logs.length;
    const tbody = document.getElementById('tasks-body');
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:24px">لا توجد مهام</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map((l, i) => `
      <tr>
        <td style="color:var(--muted);font-size:11px">${i + 1}</td>
        <td>${actionLabel(l.action)}</td>
        <td>${badgeHtml(l.status)}</td>
        <td style="font-size:11px;color:var(--muted)">${l.details ? JSON.stringify(l.details).slice(0, 60) : '—'}</td>
        <td style="font-size:11px;color:var(--muted)">${fmtDate(l.createdAt)}</td>
      </tr>`).join('');
    refreshDashboard(logs);
  } catch (err) {
    console.error('refreshLogs', err);
  }
}

// ── Settings ───────────────────────────────────────────────────────────────────
async function loadSettingsUI() {
  const settings = await api.getSettings();
  document.getElementById('cfg-server').value = settings.serverUrl ?? '';
  document.getElementById('cfg-device').value = settings.deviceName ?? '';
  const autostart = await api.getAutostart();
  document.getElementById('toggle-autostart').checked = autostart;
}

async function saveSettings() {
  const serverUrl  = document.getElementById('cfg-server').value.trim();
  const deviceName = document.getElementById('cfg-device').value.trim();
  const settings   = await api.getSettings();
  await api.setSettings({ ...settings, serverUrl, deviceName });
  toast('تم حفظ الإعدادات');
}

async function setAutostart(enabled) {
  await api.setAutostart(enabled);
  toast(enabled ? 'تم تفعيل التشغيل التلقائي' : 'تم إلغاء التشغيل التلقائي');
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const ACTION_LABELS = {
  upload_excel:   'رفع ملف Excel',
  print_report:   'طباعة تقرير',
  open_folder:    'فتح مجلد',
  open_file:      'فتح ملف',
  open_app:       'تشغيل تطبيق',
  backup_reports: 'نسخ احتياطي',
  sync_data:      'مزامنة البيانات',
  monitor_folder: 'مراقبة مجلد',
  connect:        'اتصال',
  disconnect:     'قطع اتصال',
};
function actionLabel(a) { return ACTION_LABELS[a] ?? a; }

function badgeHtml(status) {
  return status === 'success'
    ? '<span class="badge badge-green">نجاح</span>'
    : '<span class="badge badge-red">فشل</span>';
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ar-DZ', { hour12: false });
  } catch { return iso; }
}

// ── File watcher events from main ──────────────────────────────────────────────
api.onFileChanged(async ({ eventType, filename, folder }) => {
  toast(`ملف جديد تم اكتشافه: ${filename}`);
  api.appendLog({ level: 'INFO', message: 'File changed in watched folder', filename, folder, eventType });

  if (!State.token || !State.serverUrl) return;
  try {
    const fullPath = folder + '\\' + filename;
    const bufArray = await api.readFile(fullPath, State.allowedFolders);
    const blob  = new Blob([bufArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const form  = new FormData();
    form.append('file', blob, filename);
    const res = await fetch(`${State.serverUrl}/api/agent/upload-excel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${State.token}` },
      body: form,
    });
    if (res.ok) {
      toast(`تم رفع ${filename} بنجاح`);
      reportResult('upload_excel', 'success', { filename, folder });
    } else {
      throw new Error(await res.text());
    }
  } catch (err) {
    toast('فشل رفع الملف: ' + err.message, 'error');
    reportResult('upload_excel', 'failed', { filename, error: err.message });
  }
});

// ── Bootstrap ──────────────────────────────────────────────────────────────────
async function init() {
  // Try auto-login from saved token
  const token = await api.loadToken();
  if (token) {
    const settings   = await api.getSettings();
    const serverUrl  = settings.serverUrl || 'https://your-school-manager.replit.app';
    try {
      const res = await fetch(`${serverUrl}/api/agent/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        document.getElementById('login-screen').classList.add('hidden');
        State.token         = token;
        State.serverUrl     = serverUrl;
        State.deviceName    = data.deviceName ?? settings.deviceName ?? '';
        State.allowedFolders = data.allowedFolders ?? [];
        document.getElementById('info-device').textContent = State.deviceName;
        document.getElementById('info-server').textContent = serverUrl;
        document.getElementById('kpi-folders').textContent = State.allowedFolders.length;
        renderFolders();
        refreshDashboard(data.recentLogs ?? []);
        await connectSocket(token, serverUrl);
        return;
      }
    } catch { /* fall through to login screen */ }
  }
  // Show login — pre-fill server URL from saved settings
  const savedSettings = await api.getSettings().catch(() => ({}));
  const savedUrl = savedSettings.serverUrl || '';
  const urlFld = document.getElementById('login-url');
  if (urlFld && savedUrl) urlFld.value = savedUrl;
  document.getElementById('login-screen').classList.remove('hidden');
}

// ── Public API ────────────────────────────────────────────────────────────────
window.App = {
  nav, login, logout, reconnect,
  pickFolder, addFolder, removeFolder, renderFolders, saveFolders,
  refreshLogs, loadSettingsUI, saveSettings, setAutostart,
};

init();
