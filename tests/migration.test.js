import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeImport, importedYearCertificateStatus } from '../src/migration.js';

const period = (id, status='ok', paid=true) => {
  const [year, month] = id.split('-').map(Number);
  return { id, year, month, revenues: paid ? [{type:'contribution',unitId:'101',amountCents:19000}] : [], calculated:{revenueCents:paid?19000:0,expenseCents:0,closingBalanceCents:19000}, reconciliation:{status} };
};

test('resume importação sem esconder períodos que exigem revisão', () => {
  const bundle={residential:{id:'r'},units:[{id:'101'}],periods:[period('2026-01'),period('2026-02','review')]};
  const s=summarizeImport(bundle);
  assert.equal(s.periodCount,2); assert.equal(s.reconciledCount,1); assert.equal(s.reviewCount,1);
});

test('histórico incompleto nunca autoriza declaração anual', () => {
  const periods=Array.from({length:8},(_,i)=>period(`2026-${String(i+1).padStart(2,'0')}`));
  const r=importedYearCertificateStatus({periods,year:2026,unitId:'101'});
  assert.equal(r.eligible,false); assert.equal(r.reason,'ANO_INCOMPLETO');
});

test('12 meses conciliados e com contribuição permitem elegibilidade histórica', () => {
  const periods=Array.from({length:12},(_,i)=>period(`2025-${String(i+1).padStart(2,'0')}`));
  const r=importedYearCertificateStatus({periods,year:2025,unitId:'101'});
  assert.equal(r.eligible,true); assert.equal(r.reason,'OK');
});
