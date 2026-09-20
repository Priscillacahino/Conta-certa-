import test from 'node:test';
import assert from 'node:assert/strict';
import { issueCertificateArtifact, verifyCertificateRecord, revokeCertificate, base64ToBytes } from '../src/certificates.js';

const months = (unitId, year, unpaidMonth = null) => Array.from({length:12},(_,i)=>({
  id:`${unitId}-${year}-${i+1}`, unitId, year, month:i+1, kind:'monthly_contribution', amountCents:19000,
  paidCents: unpaidMonth === i+1 ? 0 : 19000, status: unpaidMonth === i+1 ? 'open' : 'paid', required:true,
  dueDate:`${year}-${String(i+1).padStart(2,'0')}-10`,
}));

const base = {
  residential:{id:'r1',name:'Residencial Demonstração',address:'Rua Exemplo, 100, João Pessoa-PB'},
  unit:{id:'101',label:'Apartamento 101'}, responsible:{name:'Responsável Exemplo'}, year:2026,
  issuedAt:'2026-12-30T12:00:00-03:00', obligations:months('101',2026),
};

test('emite PDF somente para unidade adimplente e calcula dois hashes', async () => {
  const { record, pdfBytes } = await issueCertificateArtifact(base);
  assert.match(record.certificateId, /^CC-2026-101-/);
  assert.match(record.contentHash, /^[a-f0-9]{64}$/);
  assert.match(record.pdfHash, /^[a-f0-9]{64}$/);
  assert.equal(new TextDecoder('latin1').decode(pdfBytes.slice(0,8)), '%PDF-1.4');
  assert.deepEqual(base64ToBytes(record.pdfBase64), pdfBytes);
  const check = await verifyCertificateRecord(record, pdfBytes);
  assert.equal(check.valid, true);
});

test('alteração do registro é detectada', async () => {
  const { record } = await issueCertificateArtifact(base);
  const tampered = { ...record, unitLabel:'Apartamento 103' };
  const check = await verifyCertificateRecord(tampered);
  assert.equal(check.authenticRecord, false);
  assert.equal(check.valid, false);
});

test('alteração de um byte do PDF é detectada', async () => {
  const { record, pdfBytes } = await issueCertificateArtifact(base);
  const tampered = pdfBytes.slice();
  tampered[tampered.length - 10] ^= 1;
  const check = await verifyCertificateRecord(record, tampered);
  assert.equal(check.fileIntegrity, false);
  assert.equal(check.valid, false);
});

test('revogação preserva hashes e invalida o documento no registro', async () => {
  const { record } = await issueCertificateArtifact(base);
  const revoked = revokeCertificate(record, {reason:'Correção cadastral', revokedAt:'2027-01-02T12:00:00Z'});
  assert.equal(revoked.status, 'REVOKED');
  assert.equal(revoked.contentHash, record.contentHash);
  assert.equal(revoked.pdfHash, record.pdfHash);
  const check = await verifyCertificateRecord(revoked);
  assert.equal(check.authenticRecord, true);
  assert.equal(check.valid, false);
});

test('não emite PDF com dezembro pendente', async () => {
  await assert.rejects(() => issueCertificateArtifact({...base, obligations:months('101',2026,12)}), /PENDENCIA/);
});
