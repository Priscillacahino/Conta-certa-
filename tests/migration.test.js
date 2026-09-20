import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeImport, importedYearCertificateStatus, requiresManualFinancialReview } from '../src/migration.js';

const period = (id, status='ok', paid=true, options={}) => {
  const [year, month] = id.split('-').map(Number);
  return {
    id, year, month,
    revenues: paid ? [{type:'contribution',unitId:'101',amountCents:19000}] : [],
    calculated:{revenueCents:paid?19000:0,expenseCents:0,closingBalanceCents:19000},
    reconciliation:{status, blockingForFinancialReview: status === 'review', blockingForCompliance: options.blockingForCompliance ?? (status === 'review')},
  };
};

test('resume importação separando conciliado, explicado, legado e revisão manual', () => {
  const bundle={
    residential:{id:'r'},units:[{id:'101'}],
    periods:[period('2026-01'),period('2026-02','resolved'),period('2026-03','legacy'),period('2026-04','review')]
  };
  const s=summarizeImport(bundle);
  assert.equal(s.periodCount,4);
  assert.equal(s.reconciledCount,1);
  assert.equal(s.resolvedCount,1);
  assert.equal(s.legacyCount,1);
  assert.equal(s.reviewCount,1);
  assert.equal(s.classifiedCount,3);
});

test('somente status de revisão exige conferência financeira manual por padrão', () => {
  assert.equal(requiresManualFinancialReview(period('2026-01','ok')),false);
  assert.equal(requiresManualFinancialReview(period('2026-02','resolved')),false);
  assert.equal(requiresManualFinancialReview(period('2026-03','legacy')),false);
  assert.equal(requiresManualFinancialReview(period('2026-04','review')),true);
});

test('histórico importado é referência e não autoriza declaração automaticamente', () => {
  const periods=Array.from({length:12},(_,i)=>period(`2025-${String(i+1).padStart(2,'0')}`));
  const r=importedYearCertificateStatus({periods,year:2025,unitId:'101'});
  assert.equal(r.eligible,false);
  assert.equal(r.reason,'HISTORICO_REFERENCIAL');
});

test('modo explícito de evidência completa ainda bloqueia ano incompleto', () => {
  const periods=Array.from({length:8},(_,i)=>period(`2026-${String(i+1).padStart(2,'0')}`));
  const r=importedYearCertificateStatus({periods,year:2026,unitId:'101',allowHistoricalCertificates:true});
  assert.equal(r.eligible,false);
  assert.equal(r.reason,'ANO_INCOMPLETO');
});

test('12 meses comprovados e não bloqueantes podem ser habilitados quando a evidência for explicitamente completa', () => {
  const periods=Array.from({length:12},(_,i)=>period(`2025-${String(i+1).padStart(2,'0')}`));
  const r=importedYearCertificateStatus({periods,year:2025,unitId:'101',allowHistoricalCertificates:true});
  assert.equal(r.eligible,true);
  assert.equal(r.reason,'OK');
});

test('competência legada marcada como bloqueante impede elegibilidade mesmo no modo completo', () => {
  const periods=Array.from({length:12},(_,i)=>period(`2019-${String(i+1).padStart(2,'0')}`, i===5?'legacy':'ok', true, {blockingForCompliance:i===5}));
  const r=importedYearCertificateStatus({periods,year:2019,unitId:'101',allowHistoricalCertificates:true});
  assert.equal(r.eligible,false);
  assert.deepEqual(r.reviewMonths,[6]);
});


test('ajustes de transporte já documentados podem ficar como resolved sem revisão manual', () => {
  const may = period('2023-05','resolved');
  may.reconciliation.code = 'SOURCE_OPENING_RESET';
  const aug = period('2023-08','resolved');
  aug.reconciliation.code = 'SOURCE_CARRYOVER_EXCLUDES_PRIOR_MONTH_MOVEMENT';
  const bundle={residential:{id:'r'},units:[{id:'101'}],periods:[may,aug]};
  const s=summarizeImport(bundle);
  assert.equal(s.resolvedCount,2);
  assert.equal(s.reviewCount,0);
  assert.equal(s.classifiedCount,2);
  assert.equal(requiresManualFinancialReview(may),false);
  assert.equal(requiresManualFinancialReview(aug),false);
});
