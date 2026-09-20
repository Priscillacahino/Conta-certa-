import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCompetence, createClosingRecord, reopenClosingRecord, previousCompetence, isCompetenceLocked, normalizeMovement, validateCompetence } from '../src/closing.js';

test('fechamento mensal calcula resultado e transporta saldo matematicamente', () => {
  const summary=summarizeCompetence({
    competence:'2026-08',openingBalanceCents:93223,
    payments:[{id:'p1',unitId:'101',amountCents:95000,paidAt:'2026-08-05T12:00:00Z'}],
    movements:[{id:'d1',competence:'2026-08',date:'2026-08-10',kind:'expense',description:'Água e luz',amountCents:62351}]
  });
  assert.equal(summary.revenueCents,95000);
  assert.equal(summary.expenseCents,62351);
  assert.equal(summary.resultCents,32649);
  assert.equal(summary.closingBalanceCents,125872);
});

test('registro fechado bloqueia competência e reabertura exige motivo', () => {
  const summary=summarizeCompetence({competence:'2026-09',openingBalanceCents:125872,payments:[],movements:[]});
  const closed=createClosingRecord({summary,closedAt:'2026-09-30T20:00:00Z'});
  assert.equal(isCompetenceLocked(closed),true);
  const reopened=reopenClosingRecord(closed,'Correção de lançamento','2026-10-01T10:00:00Z');
  assert.equal(reopened.status,'reopened');
  assert.equal(isCompetenceLocked(reopened),false);
  assert.throws(()=>reopenClosingRecord(closed,'x'),/MOTIVO_REABERTURA_OBRIGATORIO/);
});

test('competência anterior cruza corretamente mudança de ano', () => {
  assert.equal(previousCompetence('2026-01'),'2025-12');
  assert.equal(previousCompetence('2026-09'),'2026-08');
});


test('movimento não pode usar data fora da competência', () => {
  assert.throws(()=>normalizeMovement({id:'x',competence:'2026-09',date:'2026-10-01',kind:'expense',description:'Teste',amountCents:100}),/DATA_FORA_DA_COMPETENCIA/);
});

test('competência e valores inválidos são recusados', () => {
  assert.throws(()=>validateCompetence('2026-13'),/COMPETENCIA_INVALIDA/);
  assert.throws(()=>normalizeMovement({id:'x',competence:'2026-09',date:'2026-09-01',kind:'expense',description:'Teste',amountCents:-1}),/VALOR_MOVIMENTO_INVALIDO/);
});

test('pagamentos fora da competência não entram no fechamento', () => {
  const s=summarizeCompetence({competence:'2026-09',openingBalanceCents:0,payments:[{id:'a',unitId:'101',amountCents:19000,paidAt:'2026-08-31T23:59:00Z'},{id:'b',unitId:'101',amountCents:19000,paidAt:'2026-09-01T00:01:00Z'}],movements:[]});
  assert.equal(s.paymentIncomeCents,19000);
});
