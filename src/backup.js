const BACKUP_FORMAT = 'conta-certa-encrypted-backup';
const BACKUP_VERSION = 1;
const SNAPSHOT_FORMAT = 'conta-certa-snapshot';
const SNAPSHOT_VERSION = 1;
const DEFAULT_ITERATIONS = 260000;
const MIN_PASSPHRASE_LENGTH = 8;

function getCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw new Error('CRYPTO_INDISPONIVEL');
  return globalThis.crypto;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(value) {
  if (typeof atob === 'function') {
    const binary = atob(value);
    return Uint8Array.from(binary, ch => ch.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

function normalizePassphrase(value) {
  const text = String(value ?? '');
  if (text.length < MIN_PASSPHRASE_LENGTH) throw new Error('SENHA_BACKUP_MUITO_CURTA');
  if (text.length > 256) throw new Error('SENHA_BACKUP_MUITO_LONGA');
  return text;
}

function assertBase64Field(value, label, expectedBytes = null) {
  const text = String(value ?? '');
  if (!text || !/^[A-Za-z0-9+/]+={0,2}$/.test(text) || text.length % 4 !== 0) throw new Error(`BACKUP_${label}_INVALIDO`);
  const bytes = base64ToBytes(text);
  if (expectedBytes != null && bytes.length !== expectedBytes) throw new Error(`BACKUP_${label}_INVALIDO`);
  return bytes;
}

function sanitizeStores(stores) {
  const output = {};
  for (const [name, entries] of Object.entries(stores)) {
    if (!Array.isArray(entries)) throw new Error(`BACKUP_STORE_INVALIDO:${name}`);
    output[name] = entries.filter(entry => !(name === 'settings' && entry?.key === 'securityCredential'));
  }
  return output;
}

async function deriveKey(passphrase, salt, iterations) {
  const crypto = getCrypto();
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(normalizePassphrase(passphrase)), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.format !== SNAPSHOT_FORMAT || snapshot.schemaVersion !== SNAPSHOT_VERSION) {
    throw new Error('BACKUP_SNAPSHOT_INCOMPATIVEL');
  }
  if (!snapshot.stores || typeof snapshot.stores !== 'object') throw new Error('BACKUP_SNAPSHOT_SEM_DADOS');
  for (const [name, value] of Object.entries(snapshot.stores)) {
    if (!Array.isArray(value)) throw new Error(`BACKUP_STORE_INVALIDO:${name}`);
  }
  return true;
}

export function createSnapshotEnvelope(stores, { appVersion = 'unknown', createdAt = new Date().toISOString() } = {}) {
  if (!stores || typeof stores !== 'object') throw new Error('BACKUP_STORES_INVALIDOS');
  const snapshot = {
    format: SNAPSHOT_FORMAT,
    schemaVersion: SNAPSHOT_VERSION,
    appVersion,
    createdAt,
    excludedLocalSecrets: ['securityCredential'],
    stores: sanitizeStores(stores),
  };
  validateSnapshot(snapshot);
  return snapshot;
}

export async function encryptSnapshot(snapshot, passphrase, { iterations = DEFAULT_ITERATIONS } = {}) {
  validateSnapshot(snapshot);
  if (!Number.isSafeInteger(iterations) || iterations < 150000) throw new Error('ITERACOES_BACKUP_INSUFICIENTES');
  const crypto = getCrypto();
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);
  const key = await deriveKey(passphrase, salt, iterations);
  const plaintext = new TextEncoder().encode(JSON.stringify(snapshot));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  return Object.freeze({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    algorithm: 'PBKDF2-SHA-256+A256GCM',
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    createdAt: new Date().toISOString(),
  });
}

export async function decryptSnapshot(envelope, passphrase) {
  if (!envelope || envelope.format !== BACKUP_FORMAT || envelope.version !== BACKUP_VERSION) throw new Error('BACKUP_ARQUIVO_INCOMPATIVEL');
  if (envelope.algorithm !== 'PBKDF2-SHA-256+A256GCM') throw new Error('BACKUP_ALGORITMO_NAO_SUPORTADO');
  if (!Number.isSafeInteger(envelope.iterations) || envelope.iterations < 150000 || envelope.iterations > 2000000) throw new Error('BACKUP_PARAMETROS_INVALIDOS');
  let salt, iv, ciphertext;
  try {
    salt = assertBase64Field(envelope.salt, 'SALT', 16);
    iv = assertBase64Field(envelope.iv, 'IV', 12);
    ciphertext = assertBase64Field(envelope.ciphertext, 'CONTEUDO');
    if (ciphertext.length < 17 || ciphertext.length > 100 * 1024 * 1024) throw new Error('BACKUP_CONTEUDO_INVALIDO');
  } catch (error) {
    if (String(error?.message ?? '').startsWith('BACKUP_')) throw error;
    throw new Error('BACKUP_ARQUIVO_INCOMPATIVEL');
  }
  try {
    const key = await deriveKey(passphrase, salt, envelope.iterations);
    const plaintext = await getCrypto().subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const snapshot = JSON.parse(new TextDecoder().decode(plaintext));
    validateSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    if (String(error?.message ?? '').startsWith('BACKUP_')) throw error;
    throw new Error('BACKUP_SENHA_OU_INTEGRIDADE_INVALIDA');
  }
}

export const BACKUP_CONSTANTS = Object.freeze({
  backupFormat: BACKUP_FORMAT,
  backupVersion: BACKUP_VERSION,
  snapshotFormat: SNAPSHOT_FORMAT,
  snapshotVersion: SNAPSHOT_VERSION,
  defaultIterations: DEFAULT_ITERATIONS,
  minPassphraseLength: MIN_PASSPHRASE_LENGTH,
});
