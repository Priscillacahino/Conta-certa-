import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAnnualCompliance, certificatePayload, lastWeekdayOfYear } from '../src/compliance.js';

const months = (unitId, year, unpaidMonth = null) => Array.from({length:12},(_,i)=>({
  id:`${unitId}-${year}-${i+1}`,
  unitId,
  year,
  month:i+1,
  kind:'monthly_contribution',
  amountCents:19000,
  paidCents: unpaidMonth === i+1 ? 0 : 19000,
  status: unpaidMonth === i+1 ? 'open' : 'paid',
  required:true,
  dueDate:`${year}-${String(i+1).padStart(2,'0')}-10`,
}));

test('unidade com doze contribuições quitadas é elegível', () => {
  const result = evaluateAnnualCompliance({ obligations: months('101', 2026), year: 2026 });
  assert.equal(result.eligible, true);
});

test('dezembro pendente bloqueia declaração', () => {
  const obligations = months('103', 2026, 12);
  assert.equal(evaluateAnnualCompliance({ obligations, year: 2026 }).eligible, false);
  assert.throws(() => certificatePayload({ residential:{id:'r',name:'R',address:'A'}, unit:{id:'103',label:'Apartamento 103'}, responsible:{name:'Teste'}, year:2026, issuedAt:'2026-12-30', obligations }), /PENDENCIA/);
});

test('parcelamento aberto de exercício anterior também bloqueia', () => {
  const obligations = [...months('101', 2026), {
    id:'parcela-antiga',unitId:'101',year:2025,month:12,kind:'installment',amountCents:5000,paidCents:0,status:'open',required:true,dueDate:'2025-12-20'
  }];
  const result = evaluateAnnualCompliance({ obligations, year:2026 });
  assert.equal(result.eligible, false);
  assert.equal(result.pending[0].kind, 'installment');
});

test('último dia útil ignora fim de semana', () => {
  assert.equal(lastWeekdayOfYear(2023), '2023-12-29');
});
