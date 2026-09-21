const PACKAGE_FORMAT = 'conta-certa-resident-package';
const PACKAGE_VERSION = 1;
const VAULT_FORMAT = 'conta-certa-resident-vault';
const VAULT_VERSION = 1;
const VAULT_ITERATIONS = 310000;

function getCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw new Error('CRYPTO_INDISPONIVEL');
  return globalThis.crypto;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = String(value ?? '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
}

function base64ToBytes(value) {
  const binary = typeof atob === 'function' ? atob(value) : Buffer.from(String(value ?? ''), 'base64').toString('binary');
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

export function normalizePhoneDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new Error('TELEFONE_INVALIDO');
  return digits;
}

export function validateResidentPin(pin) {
  const value = String(pin ?? '');
  if (!/^\d{4}$/.test(value)) throw new Error('PIN_MORADOR_INVALIDO');
  return value;
}

export function createActivationToken() {
  const bytes = new Uint8Array(32);
  getCrypto().getRandomValues(bytes);
  return `CCA1-${bytesToBase64Url(bytes)}`;
}

function activationKeyBytes(token) {
  const match = String(token ?? '').trim().match(/^CCA1-([A-Za-z0-9_-]{40,50})$/);
  if (!match) throw new Error('TOKEN_ATIVACAO_INVALIDO');
  const bytes = base64UrlToBytes(match[1]);
  if (bytes.length !== 32) throw new Error('TOKEN_ATIVACAO_INVALIDO');
  return bytes;
}

function safeInt(value) {
  return Number.isSafeInteger(value) ? value : 0;
}

function compactMovement(item) {
  return {
    date: String(item.date ?? '').slice(0, 10),
    category: String(item.category ?? ''),
    description: String(item.description ?? ''),
    amountCents: safeInt(item.amountCents),
  };
}

function compactObligation(item) {
  return {
    id: String(item.id),
    kind: String(item.kind),
    description: String(item.description ?? ''),
    amountCents: safeInt(item.amountCents),
    paidCents: safeInt(item.paidCents),
    dueDate: String(item.dueDate ?? ''),
    year: Number(item.year) || null,
    month: Number(item.month) || null,
    status: String(item.status ?? 'open'),
    cancelledAt: item.cancelledAt ?? null,
    cancellationReason: item.cancellationReason ?? null,
  };
}

function compactPayment(item) {
  return {
    id: String(item.id),
    obligationId: String(item.obligationId ?? ''),
    amountCents: safeInt(item.amountCents),
    paidAt: String(item.paidAt ?? ''),
    description: String(item.description ?? ''),
  };
}

function compactCertificate(item) {
  return {
    certificateId: String(item.certificateId),
    year: Number(item.year),
    issuedAt: String(item.issuedAt ?? ''),
    status: String(item.status ?? ''),
    fileName: String(item.fileName ?? ''),
    pdfBase64: String(item.pdfBase64 ?? ''),
    pdfHash: String(item.pdfHash ?? ''),
    revokedAt: item.revokedAt ?? null,
    revocationReason: item.revocationReason ?? null,
  };
}

export function buildResidentPayload({ residential, unit, closings = [], movements = [], obligations = [], payments = [], certificates = [], generatedAt = new Date().toISOString() }) {
  if (!residential?.id || !residential?.name) throw new Error('RESIDENCIAL_INVALIDO');
  if (!unit?.id) throw new Error('UNIDADE_INVALIDA');
  const allowedPhones = (unit.contacts ?? [])
    .filter(contact => contact?.type === 'phone' && contact?.active !== false)
    .map(contact => normalizePhoneDigits(contact.value));
  if (!allowedPhones.length) throw new Error('UNIDADE_SEM_TELEFONE_AUTORIZADO');

  const unitId = String(unit.id);
  const ownObligations = obligations.filter(item => String(item.unitId) === unitId).map(compactObligation);
  const ownPayments = payments.filter(item => String(item.unitId) === unitId).map(compactPayment);
  const ownCertificates = certificates.filter(item => String(item.unitId) === unitId).map(compactCertificate);
  const closed = closings
    .filter(item => item?.status === 'closed')
    .sort((a, b) => String(a.competence).localeCompare(String(b.competence)))
    .map(item => ({
      competence: String(item.competence),
      revision: Number(item.revision) || 1,
      source: item.source ?? 'operational',
      openingBalanceCents: safeInt(item.openingBalanceCents),
      revenueCents: safeInt(item.revenueCents),
      expenseCents: safeInt(item.expenseCents),
      resultCents: safeInt(item.resultCents),
      closingBalanceCents: safeInt(item.closingBalanceCents),
      expenses: movements
        .filter(movement => movement?.kind === 'expense' && String(movement.competence) === String(item.competence))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .map(compactMovement),
    }));

  return Object.freeze({
    schemaVersion: 1,
    profileType: 'resident-readonly',
    generatedAt,
    residential: { id: String(residential.id), name: String(residential.name) },
    unit: {
      id: unitId,
      label: String(unit.label ?? `Unidade ${unitId}`),
      responsibleName: String(unit.responsibleName ?? ''),
    },
    allowedPhones,
    obligations: ownObligations,
    payments: ownPayments,
    closings: closed,
    certificates: ownCertificates,
  });
}

export async function encryptResidentPayload(payload, activationToken) {
  const keyBytes = activationKeyBytes(activationToken);
  const key = await getCrypto().subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = new Uint8Array(12);
  getCrypto().getRandomValues(iv);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await getCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  return Object.freeze({
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    algorithm: 'A256GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    createdAt: new Date().toISOString(),
  });
}

export async function decryptResidentPackage(envelope, activationToken) {
  if (!envelope || envelope.format !== PACKAGE_FORMAT || envelope.version !== PACKAGE_VERSION || envelope.algorithm !== 'A256GCM') {
    throw new Error('PACOTE_MORADOR_INVALIDO');
  }
  try {
    const key = await getCrypto().subtle.importKey('raw', activationKeyBytes(activationToken), { name: 'AES-GCM' }, false, ['decrypt']);
    const plaintext = await getCrypto().subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(envelope.iv) }, key, base64ToBytes(envelope.ciphertext));
    const payload = JSON.parse(new TextDecoder().decode(plaintext));
    if (payload?.profileType !== 'resident-readonly' || !payload?.unit?.id || !Array.isArray(payload?.allowedPhones)) throw new Error('PACOTE_MORADOR_INVALIDO');
    return payload;
  } catch (error) {
    if (String(error?.message ?? '').startsWith('PACOTE_') || String(error?.message ?? '').startsWith('TOKEN_')) throw error;
    throw new Error('PACOTE_MORADOR_CHAVE_INVALIDA');
  }
}

async function deriveVaultKey(phone, pin, salt, iterations = VAULT_ITERATIONS) {
  const normalizedPhone = normalizePhoneDigits(phone);
  const normalizedPin = validateResidentPin(pin);
  const material = await getCrypto().subtle.importKey(
    'raw', new TextEncoder().encode(`${normalizedPhone}:${normalizedPin}`), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return getCrypto().subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

export async function createResidentVault(payload, phone, pin, { iterations = VAULT_ITERATIONS } = {}) {
  const normalizedPhone = normalizePhoneDigits(phone);
  validateResidentPin(pin);
  const allowed = (payload.allowedPhones ?? []).map(normalizePhoneDigits);
  if (!allowed.includes(normalizedPhone)) throw new Error('TELEFONE_NAO_AUTORIZADO');
  if (!Number.isSafeInteger(iterations) || iterations < 150000) throw new Error('ITERACOES_INSUFICIENTES');
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  getCrypto().getRandomValues(salt);
  getCrypto().getRandomValues(iv);
  const key = await deriveVaultKey(normalizedPhone, pin, salt, iterations);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await getCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  return Object.freeze({
    format: VAULT_FORMAT,
    version: VAULT_VERSION,
    algorithm: 'PBKDF2-SHA-256+A256GCM',
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    unitId: String(payload.unit.id),
    createdAt: new Date().toISOString(),
  });
}

export async function openResidentVault(vault, phone, pin) {
  if (!vault || vault.format !== VAULT_FORMAT || vault.version !== VAULT_VERSION) throw new Error('COFRE_MORADOR_INVALIDO');
  try {
    const salt = base64ToBytes(vault.salt);
    const iv = base64ToBytes(vault.iv);
    const key = await deriveVaultKey(phone, pin, salt, vault.iterations);
    const plaintext = await getCrypto().subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(vault.ciphertext));
    const payload = JSON.parse(new TextDecoder().decode(plaintext));
    if (payload?.profileType !== 'resident-readonly') throw new Error('COFRE_MORADOR_INVALIDO');
    return payload;
  } catch (error) {
    if (String(error?.message ?? '').startsWith('COFRE_') || String(error?.message ?? '').startsWith('PIN_') || String(error?.message ?? '').startsWith('TELEFONE_')) throw error;
    throw new Error('LOGIN_MORADOR_INVALIDO');
  }
}

export function residentOutstandingCents(payload) {
  return (payload?.obligations ?? []).reduce((sum, item) => {
    if (item.status === 'cancelled') return sum;
    return sum + Math.max(0, safeInt(item.amountCents) - safeInt(item.paidCents));
  }, 0);
}

export const RESIDENT_ACCESS_CONSTANTS = Object.freeze({
  packageFormat: PACKAGE_FORMAT,
  packageVersion: PACKAGE_VERSION,
  vaultFormat: VAULT_FORMAT,
  vaultVersion: VAULT_VERSION,
  vaultIterations: VAULT_ITERATIONS,
});
