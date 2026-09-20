import { certificatePayload } from './compliance.js';
import { buildCertificatePdf } from './certificate-pdf.js';

function getCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw new Error('CRYPTO_INDISPONIVEL');
  return globalThis.crypto;
}

function hex(bytes) { return [...bytes].map(b => b.toString(16).padStart(2, '0')).join(''); }

export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await getCrypto().subtle.digest('SHA-256', bytes);
  return hex(new Uint8Array(digest));
}

function randomHex(bytes = 6) {
  const data = new Uint8Array(bytes);
  getCrypto().getRandomValues(data);
  return hex(data).toUpperCase();
}

function safeUnit(unitId) { return String(unitId).replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase() || 'UNIDADE'; }

export function immutableCertificateFields(record) {
  return {
    documentVersion: record.documentVersion,
    certificateId: record.certificateId,
    verificationCode: record.verificationCode,
    residentialId: record.residentialId,
    residentialName: record.residentialName,
    address: record.address,
    unitId: record.unitId,
    unitLabel: record.unitLabel,
    responsible: record.responsible,
    year: record.year,
    issuedAt: record.issuedAt,
  };
}

export function canonicalCertificateText(record) {
  const data = immutableCertificateFields(record);
  return Object.keys(data).map(key => `${key}=${String(data[key] ?? '')}`).join('\n');
}

function formatPtBr(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR');
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(value) {
  if (typeof atob === 'function') {
    const binary = atob(value);
    return Uint8Array.from(binary, ch => ch.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

export async function issueCertificateArtifact({ residential, unit, responsible, year, issuedAt, obligations, sourceReviewRequired = false }) {
  const compliance = certificatePayload({ residential, unit, responsible, year, issuedAt, obligations, sourceReviewRequired });
  const certificateId = `CC-${year}-${safeUnit(unit.id)}-${randomHex(4)}`;
  const verificationCode = randomHex(6);
  const draft = {
    ...compliance,
    documentVersion: 1,
    certificateId,
    verificationCode,
    issuedAt: new Date(issuedAt).toISOString(),
    issuedAtDisplay: formatPtBr(issuedAt),
  };
  const contentHash = await sha256Hex(canonicalCertificateText(draft));
  const pdfBytes = buildCertificatePdf({ ...draft, contentHash });
  const pdfHash = await sha256Hex(pdfBytes);
  const fileName = `Conta_Certa_Adimplencia_${year}_${safeUnit(unit.id)}_${certificateId.slice(-8)}.pdf`;
  const record = Object.freeze({
    ...draft,
    contentHash,
    pdfHash,
    pdfBase64: bytesToBase64(pdfBytes),
    fileName,
    status: 'VALID',
    revokedAt: null,
    revocationReason: null,
  });
  return { record, pdfBytes };
}

export async function verifyCertificateRecord(record, pdfBytes = null) {
  const expectedContentHash = await sha256Hex(canonicalCertificateText(record));
  const contentIntegrity = expectedContentHash === record.contentHash;
  let fileIntegrity = null;
  if (pdfBytes) fileIntegrity = (await sha256Hex(pdfBytes)) === record.pdfHash;
  return {
    authenticRecord: contentIntegrity,
    fileIntegrity,
    valid: contentIntegrity && record.status === 'VALID' && (fileIntegrity !== false),
    status: record.status,
  };
}

export function revokeCertificate(record, { reason, revokedAt = new Date().toISOString() }) {
  if (record.status !== 'VALID') throw new Error('DECLARACAO_NAO_PODE_SER_REVOGADA');
  if (!String(reason ?? '').trim()) throw new Error('MOTIVO_REVOGACAO_OBRIGATORIO');
  return Object.freeze({ ...record, status: 'REVOKED', revokedAt, revocationReason: String(reason).trim() });
}
