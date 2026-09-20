const DEFAULT_ITERATIONS = 210000;
const MIN_SECRET_LENGTH = 6;
const MAX_SECRET_LENGTH = 128;

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

function normalizeSecret(secret) {
  const value = String(secret ?? '');
  if (value.length < MIN_SECRET_LENGTH) throw new Error('SEGREDO_MUITO_CURTO');
  if (value.length > MAX_SECRET_LENGTH) throw new Error('SEGREDO_MUITO_LONGO');
  return value;
}

async function deriveVerifier(secret, salt, iterations) {
  const crypto = getCrypto();
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(normalizeSecret(secret)), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, 256
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function createSecurityCredential(secret, { iterations = DEFAULT_ITERATIONS, saltBytes = 16 } = {}) {
  normalizeSecret(secret);
  if (!Number.isSafeInteger(iterations) || iterations < 100000) throw new Error('ITERACOES_INSUFICIENTES');
  const salt = new Uint8Array(saltBytes);
  getCrypto().getRandomValues(salt);
  const verifier = await deriveVerifier(secret, salt, iterations);
  return Object.freeze({
    version: 1,
    algorithm: 'PBKDF2-SHA-256',
    iterations,
    salt: bytesToBase64(salt),
    verifier: bytesToBase64(verifier),
    createdAt: new Date().toISOString(),
  });
}

export async function verifySecurityCredential(secret, credential) {
  if (!credential || credential.version !== 1 || credential.algorithm !== 'PBKDF2-SHA-256') return false;
  if (!Number.isSafeInteger(credential.iterations) || credential.iterations < 100000) return false;
  try {
    const actual = await deriveVerifier(secret, base64ToBytes(credential.salt), credential.iterations);
    const expected = base64ToBytes(credential.verifier);
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function isSessionActive(unlockedUntil, now = Date.now()) {
  return Number.isFinite(unlockedUntil) && unlockedUntil > now;
}

export function nextSessionDeadline(now = Date.now(), ttlMs = 10 * 60 * 1000) {
  if (!Number.isFinite(ttlMs) || ttlMs < 60000) throw new Error('SESSAO_MUITO_CURTA');
  return now + ttlMs;
}


export function unlockThrottleStatus(state = {}, now = Date.now()) {
  const failedAttempts = Number.isSafeInteger(state.failedAttempts) && state.failedAttempts >= 0 ? state.failedAttempts : 0;
  const blockedUntil = Number.isFinite(state.blockedUntil) ? state.blockedUntil : 0;
  if (blockedUntil > now) return Object.freeze({ failedAttempts, blockedUntil, blocked: true, remainingMs: blockedUntil - now });
  return Object.freeze({ failedAttempts: blockedUntil ? 0 : failedAttempts, blockedUntil: 0, blocked: false, remainingMs: 0 });
}

export function recordUnlockFailure(state = {}, now = Date.now(), { maxAttempts = 5, cooldownMs = 30_000 } = {}) {
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 2) throw new Error('LIMITE_TENTATIVAS_INVALIDO');
  if (!Number.isFinite(cooldownMs) || cooldownMs < 10_000) throw new Error('COOLDOWN_INVALIDO');
  const current = unlockThrottleStatus(state, now);
  if (current.blocked) return current;
  const failedAttempts = current.failedAttempts + 1;
  if (failedAttempts >= maxAttempts) {
    return Object.freeze({ failedAttempts, blockedUntil: now + cooldownMs, blocked: true, remainingMs: cooldownMs });
  }
  return Object.freeze({ failedAttempts, blockedUntil: 0, blocked: false, remainingMs: 0 });
}

export function resetUnlockThrottle() {
  return Object.freeze({ failedAttempts: 0, blockedUntil: 0, blocked: false, remainingMs: 0 });
}

export const SECURITY_DEFAULTS = Object.freeze({
  iterations: DEFAULT_ITERATIONS,
  minSecretLength: MIN_SECRET_LENGTH,
  maxSecretLength: MAX_SECRET_LENGTH,
  sessionTtlMs: 10 * 60 * 1000,
  backgroundGraceMs: 2 * 60 * 1000,
  maxUnlockAttempts: 5,
  unlockCooldownMs: 30 * 1000,
});
