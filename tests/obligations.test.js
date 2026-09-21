import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPayment,
  cancelObligation,
  createInstallmentPlan,
  createMonthlyObligations,
  ledgerSummary,
  obligationsBlockingCertificate,
  splitAmount,
} from '../src/obligations.js';

test('divide parcelamento preservando todos os centavos', () => {
  const values = splitAmount(10000, 3);
  assert.deepEqual(values, [3334, 3333, 3333]);
  assert.equal(values.reduce((a,b)=>a+b,0), 10000);
});

test('pagamento parcial mantém obrigação pendente até quitação integral', () => {
  const base = { id:'o1', unitId:'101', kind:'monthly_contribution', amountCents:19000, paidCents:0, year:2026, month:12, dueDate:'2026-12-10' };
  const partial = applyPayment(base, 10000, '2026-12-05T12:00:00Z');
  assert.equal(partial.status, 'partial');
  assert.equal(partial.paidCents, 10000);
  const paid = applyPayment(partial, 9000, '2026-12-06T12:00:00Z');
  assert.equal(paid.status, 'paid');
  assert.equal(paid.paidCents, 19000);
});

test('gera mensalidade somente para unidades ativas', () => {
  const items = createMonthlyObligations({
    units:[{id:'101',active:true},{id:'102',active:false},{id:'103',active:true}],
    year:2026, month:12, amountCents:19000, dueDate:'2026-12-10'
  });
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(x=>x.unitId), ['101','103']);
});

test('parcelamento aberto bloqueia declaração mesmo se for de dívida anterior', () => {
  const plan = createInstallmentPlan({ planId:'p1', unitId:'103', totalCents:60000, installments:3, firstDueDate:'2025-11-10' });
  const blockers = obligationsBlockingCertificate(plan, 2026);
  assert.equal(blockers.length, 3);
  assert.ok(blockers.every(x => x.kind === 'installment'));
});

test('resumo do livro separa quitado e pendente', () => {
  const items = [
    {id:'a',unitId:'101',kind:'other',amountCents:10000,paidCents:10000,year:2026,month:1},
    {id:'b',unitId:'101',kind:'other',amountCents:5000,paidCents:2000,year:2026,month:2},
  ];
  const summary = ledgerSummary(items);
  assert.equal(summary.paidCount, 1);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.outstandingCents, 3000);
});

test('cancelamento de obrigação sem pagamento preserva registro e zera pendência', () => {
  const base = { id:'teste-103', unitId:'103', kind:'monthly_contribution', amountCents:19000, paidCents:0, year:2026, month:9, dueDate:'2026-09-10' };
  const cancelled = cancelObligation(base, 'Lançamento de teste', '2026-09-20T12:00:00Z');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancellationReason, 'Lançamento de teste');
  const summary = ledgerSummary([cancelled]);
  assert.equal(summary.count, 0);
  assert.equal(summary.pendingCount, 0);
  assert.equal(summary.outstandingCents, 0);
});

test('obrigação com pagamento não pode ser simplesmente cancelada', () => {
  const partial = { id:'o2', unitId:'103', kind:'monthly_contribution', amountCents:19000, paidCents:1000, year:2026, month:9, dueDate:'2026-09-10' };
  assert.throws(()=>cancelObligation(partial,'Correção necessária'),/OBRIGACAO_COM_PAGAMENTO_NAO_PODE_SER_CANCELADA/);
});
