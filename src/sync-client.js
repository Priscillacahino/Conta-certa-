import { exportDatabaseSnapshot, restoreDatabaseSnapshot } from './db.js';

const DEFAULT_API_URL = 'https://conta-certa-dusky-seven.vercel.app';
const API_KEY = 'conta-certa-api-base-url';
const ADMIN_TOKEN_KEY = 'conta-certa-admin-api-token';
const ADMIN_VERSION_KEY = 'conta-certa-admin-sync-version';
const ADMIN_HASH_KEY = 'conta-certa-admin-last-sync-hash';
const ADMIN_LAST_SYNC_KEY = 'conta-certa-admin-last-sync-at';
const RESIDENT_TOKEN_KEY = 'conta-certa-resident-api-token';

function normalizeApiUrl(value) {
  const text = String(value ?? '').trim().replace(/\/+$/, '');
  if (!text) return '';
  const url = new URL(text);
  if (url.username || url.password) throw new Error('API_URL_NAO_PODE_CONTER_CREDENCIAIS');
  if (url.search || url.hash) throw new Error('API_URL_NAO_PODE_CONTER_PARAMETROS');
  if (url.protocol !== 'https:' && !(url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    throw new Error('API_HTTPS_OBRIGATORIO');
  }
  return url.toString().replace(/\/+$/, '');
}

function dispatchSync(detail) {
  window.dispatchEvent(new CustomEvent('conta-certa-sync', { detail }));
}

// Por segurança, links não podem mais trocar silenciosamente o servidor da API.
export function captureApiBaseUrlFromLocation() {
  return getApiBaseUrl();
}

export function getApiBaseUrl() {
  return localStorage.getItem(API_KEY) || DEFAULT_API_URL;
}

export function setApiBaseUrl(value) {
  const normalized = normalizeApiUrl(value);
  if (normalized !== getApiBaseUrl()) {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(RESIDENT_TOKEN_KEY);
    for (const key of [ADMIN_VERSION_KEY, ADMIN_HASH_KEY, ADMIN_LAST_SYNC_KEY]) localStorage.removeItem(key);
  }
  localStorage.setItem(API_KEY, normalized);
  return normalized;
}

export function getAdminSyncStatus() {
  return Object.freeze({
    apiConfigured: Boolean(getApiBaseUrl()),
    authenticated: Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY)),
    online: navigator.onLine,
    syncVersion: Number(localStorage.getItem(ADMIN_VERSION_KEY) || 0),
    lastSyncAt: localStorage.getItem(ADMIN_LAST_SYNC_KEY) || '',
  });
}

async function api(path, { method='GET', token='', body=null } = {}) {
  const base = getApiBaseUrl();
  if (!base) throw new Error('API_NAO_CONFIGURADA');
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP_${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function healthCheck() {
  return api('/api/health/');
}

export async function adminLogin(username, password) {
  const previous = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  if (previous) {
    try { await api('/api/auth/logout/', { method:'POST', token:previous }); } catch {}
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
  const data = await api('/api/auth/admin/login/', {
    method:'POST',
    body:{ username, password },
  });
  sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
  dispatchSync({ authenticated:true });
  return data;
}

export async function clearAdminRemoteSession({ revoke=true } = {}) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  dispatchSync({ authenticated:false, reason:'login-required' });
  if (revoke && token && getApiBaseUrl()) {
    try { await api('/api/auth/logout/', { method:'POST', token }); } catch {}
  }
}

export async function listRemoteSessions() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  if (!token) throw new Error('SESSAO_ADMIN_AUSENTE');
  return api('/api/admin/sessions/', { token });
}

export async function revokeRemoteSession(sessionId) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  if (!token) throw new Error('SESSAO_ADMIN_AUSENTE');
  const data = await api('/api/admin/sessions/revoke/', {
    method:'POST',
    token,
    body:{ sessionId },
  });
  return data;
}

export async function issueResidentActivation({ residentialId, unitId, phone }) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  return api('/api/admin/residents/activation/', {
    method:'POST', token, body:{ residentialId, unitId, phone },
  });
}

async function sha256Text(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
}

async function pullAdminUnlocked({ residentialId='' } = {}) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  if (!getApiBaseUrl() || !token) throw new Error('API_OU_SESSAO_NAO_CONFIGURADA');
  const suffix = residentialId ? `?residentialId=${encodeURIComponent(residentialId)}` : '';
  const data = await api(`/api/admin/sync/pull/${suffix}`, { token });
  if (!data.snapshot) throw new Error('SNAPSHOT_REMOTO_AUSENTE');
  await restoreDatabaseSnapshot(data.snapshot);
  const hash = await sha256Text(JSON.stringify(data.snapshot.stores));
  localStorage.setItem(ADMIN_VERSION_KEY, String(data.syncVersion || 0));
  localStorage.setItem(ADMIN_HASH_KEY, hash);
  localStorage.setItem(ADMIN_LAST_SYNC_KEY, new Date().toISOString());
  dispatchSync({ ok:true, pulled:true, syncVersion:data.syncVersion });
  return data;
}

async function syncAdminUnlocked({ force=false } = {}) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  if (!getApiBaseUrl()) return { skipped:true, reason:'not-configured' };
  if (!token) return { skipped:true, reason:'login-required' };
  const snapshot = await exportDatabaseSnapshot('0.12.4');
  const serialized = JSON.stringify(snapshot.stores);
  const hash = await sha256Text(serialized);
  if (!force && hash === localStorage.getItem(ADMIN_HASH_KEY)) {
    return { skipped:true, reason:'unchanged' };
  }
  const baseVersion = Number(localStorage.getItem(ADMIN_VERSION_KEY) || 0);
  const data = await api('/api/admin/sync/push/', {
    method:'POST', token, body:{ baseVersion, snapshot },
  });
  localStorage.setItem(ADMIN_VERSION_KEY, String(data.syncVersion || 0));
  localStorage.setItem(ADMIN_HASH_KEY, hash);
  localStorage.setItem(ADMIN_LAST_SYNC_KEY, new Date().toISOString());
  dispatchSync({ ok:true, syncVersion:data.syncVersion });
  return data;
}

let syncQueue = Promise.resolve();
function withSyncLock(task) {
  const run = () => navigator.locks
    ? navigator.locks.request('conta-certa-admin-sync', task)
    : task();
  const pending = syncQueue.then(run, run);
  syncQueue = pending.catch(() => {});
  return pending;
}
export function syncAdminNow(options = {}) { return withSyncLock(() => syncAdminUnlocked(options)); }
export function pullAdminNow(options = {}) { return withSyncLock(() => pullAdminUnlocked(options)); }

let timer = null;
let syncing = false;

async function safeSync() {
  if (syncing) return;
  if (!navigator.onLine) {
    dispatchSync({ offline:true });
    return;
  }
  const state = getAdminSyncStatus();
  if (!state.apiConfigured) {
    dispatchSync({ skipped:true, reason:'not-configured' });
    return;
  }
  if (!state.authenticated) {
    dispatchSync({ skipped:true, reason:'login-required' });
    return;
  }
  syncing = true;
  dispatchSync({ syncing:true });
  try {
    const result = await syncAdminNow();
    if (result?.skipped) dispatchSync({ ok:true, ...result });
  } catch (error) {
    if (error.status === 401) {
      await clearAdminRemoteSession({ revoke:false });
    }
    dispatchSync({
      ok:false,
      error:error.message,
      conflict:error.status === 409 || error.message === 'VERSAO_DESATUALIZADA',
    });
  } finally {
    syncing = false;
  }
}

export function startAdminAutoSync({ intervalMs=45000 } = {}) {
  captureApiBaseUrlFromLocation();
  if (timer) clearInterval(timer);
  timer = setInterval(safeSync, intervalMs);
  window.addEventListener('online', safeSync);
  window.addEventListener('focus', safeSync);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) safeSync();
  });
  setTimeout(safeSync, 1200);
}

function storeResidentToken(data) {
  if (data?.token) sessionStorage.setItem(RESIDENT_TOKEN_KEY, data.token);
}

export async function clearResidentRemoteSession({ revoke=true } = {}) {
  const token = sessionStorage.getItem(RESIDENT_TOKEN_KEY) || '';
  sessionStorage.removeItem(RESIDENT_TOKEN_KEY);
  if (revoke && token && getApiBaseUrl()) {
    try { await api('/api/auth/logout/', { method:'POST', token }); } catch {}
  }
}

export async function activateResidentRemote({ phone, activationCode, pin }) {
  const data = await api('/api/auth/resident/activate/', {
    method:'POST', body:{ phone, activationCode, pin },
  });
  storeResidentToken(data);
  return data.snapshot;
}

export async function fetchResidentSnapshotRemote() {
  const token = sessionStorage.getItem(RESIDENT_TOKEN_KEY) || '';
  if (!token) throw new Error('SESSAO_REMOTA_MORADOR_AUSENTE');
  return api('/api/resident/snapshot/', { token });
}

export async function refreshResidentRemote({ phone='', pin='', authenticate=false } = {}) {
  const existing = sessionStorage.getItem(RESIDENT_TOKEN_KEY) || '';
  if (existing && !authenticate) {
    try {
      return await fetchResidentSnapshotRemote();
    } catch (error) {
      if (error.status !== 401) throw error;
      await clearResidentRemoteSession({ revoke:false });
    }
  }
  if (!phone || !pin) throw new Error('SESSAO_REMOTA_MORADOR_AUSENTE');
  const data = await api('/api/auth/resident/login/', {
    method:'POST', body:{ phone, pin },
  });
  storeResidentToken(data);
  return data.snapshot;
}
