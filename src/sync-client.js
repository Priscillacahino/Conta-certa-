import { exportDatabaseSnapshot, restoreDatabaseSnapshot } from './db.js';

const API_KEY = 'conta-certa-api-base-url';
const ADMIN_TOKEN_KEY = 'conta-certa-admin-api-token';
const ADMIN_VERSION_KEY = 'conta-certa-admin-sync-version';
const ADMIN_HASH_KEY = 'conta-certa-admin-last-sync-hash';

function normalizeApiUrl(value) {
  const text = String(value ?? '').trim().replace(/\/+$/, '');
  if (!text) return '';
  const url = new URL(text);
  if (url.protocol !== 'https:' && !(url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    throw new Error('API_HTTPS_OBRIGATORIO');
  }
  return url.toString().replace(/\/+$/, '');
}

export function captureApiBaseUrlFromLocation() {
  const params = new URLSearchParams(location.search);
  const raw = params.get('api');
  if (!raw) return getApiBaseUrl();
  try {
    const normalized = normalizeApiUrl(raw);
    localStorage.setItem(API_KEY, normalized);
    return normalized;
  } catch {
    return getApiBaseUrl();
  }
}

export function getApiBaseUrl() {
  return localStorage.getItem(API_KEY) || '';
}

export function setApiBaseUrl(value) {
  const normalized = normalizeApiUrl(value);
  localStorage.setItem(API_KEY, normalized);
  return normalized;
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
  const data = await api('/api/auth/admin/login/', {
    method:'POST',
    body:{ username, password },
  });
  sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
  return data;
}

export function clearAdminRemoteSession() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
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

export async function pullAdminNow({ residentialId='' } = {}) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  if (!getApiBaseUrl() || !token) throw new Error('API_OU_SESSAO_NAO_CONFIGURADA');
  const suffix = residentialId ? `?residentialId=${encodeURIComponent(residentialId)}` : '';
  const data = await api(`/api/admin/sync/pull/${suffix}`, { token });
  if (!data.snapshot) throw new Error('SNAPSHOT_REMOTO_AUSENTE');
  await restoreDatabaseSnapshot(data.snapshot);
  const hash = await sha256Text(JSON.stringify(data.snapshot));
  localStorage.setItem(ADMIN_VERSION_KEY, String(data.syncVersion || 0));
  localStorage.setItem(ADMIN_HASH_KEY, hash);
  localStorage.setItem('conta-certa-admin-last-sync-at', new Date().toISOString());
  window.dispatchEvent(new CustomEvent('conta-certa-sync', { detail:{ ok:true, pulled:true, syncVersion:data.syncVersion } }));
  return data;
}

export async function syncAdminNow({ force=false } = {}) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  if (!getApiBaseUrl() || !token) return { skipped:true, reason:'not-configured' };
  const snapshot = await exportDatabaseSnapshot('0.11.0');
  const serialized = JSON.stringify(snapshot);
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
  localStorage.setItem('conta-certa-admin-last-sync-at', new Date().toISOString());
  window.dispatchEvent(new CustomEvent('conta-certa-sync', { detail:{ ok:true, syncVersion:data.syncVersion } }));
  return data;
}

let timer = null;
let syncing = false;

async function safeSync() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try { await syncAdminNow(); }
  catch (error) {
    window.dispatchEvent(new CustomEvent('conta-certa-sync', { detail:{ ok:false, error:error.message } }));
  } finally { syncing = false; }
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

export async function activateResidentRemote({ phone, activationCode, pin }) {
  const data = await api('/api/auth/resident/activate/', {
    method:'POST', body:{ phone, activationCode, pin },
  });
  return data.snapshot;
}

export async function refreshResidentRemote({ phone, pin }) {
  const data = await api('/api/auth/resident/login/', {
    method:'POST', body:{ phone, pin },
  });
  return data.snapshot;
}
