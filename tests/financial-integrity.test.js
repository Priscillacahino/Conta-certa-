import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { exportDatabaseSnapshot, restoreDatabaseSnapshot, saveObligation, saveObligations, listObligations, listPayments, registerObligationPayment, saveTransaction, saveMonthClosing, reopenMonthClosing, listMonthClosings } from '../src/db.js';
import { applyPayment, cancelObligation, normalizeObligation } from '../src/obligations.js';
import { summarizeCompetence, createClosingRecord, reopenClosingRecord, normalizeMovement } from '../src/closing.js';

const obligation = id => normalizeObligation({id, unitId:'101', kind:'monthly_contribution', amountCents:10000, paidCents:0, dueDate:'2026-10-10', year:2026, month:10});
const payment = (id, oid, amountCents=5000) => ({id, obligationId:oid, unitId:'101', amountCents, paidAt:'2026-10-08T12:00:00'});
async function reset() {
  const snapshot = await exportDatabaseSnapshot();
  for (const key of Object.keys(snapshot.stores)) snapshot.stores[key] = [];
  await restoreDatabaseSnapshot(snapshot);
}

test('concurrent stale payments cannot overwrite paid balance or double cash', async () => {
  await reset(); const o=obligation('a'); await saveObligation(o);
  const updated=applyPayment(o,5000);
  const result=await Promise.allSettled([
    registerObligationPayment({obligation:updated,payment:payment('p1','a')}),
    registerObligationPayment({obligation:updated,payment:payment('p2','a')}),
  ]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await listPayments()).length,1);
  assert.equal((await listObligations())[0].paidCents,5000);
});

test('duplicate payment ID rolls back the obligation update', async()=>{
  await reset();const o=obligation('a');await saveObligation(o);
  const half=applyPayment(o,5000);await registerObligationPayment({obligation:half,payment:payment('p1','a')});
  await assert.rejects(registerObligationPayment({obligation:applyPayment(half,5000),payment:payment('p1','a')}));
  assert.equal((await listObligations())[0].paidCents,5000);
});

test('stale cancellation and repeated batch cannot erase a payment',async()=>{
  await reset(); const o=obligation('a');await saveObligation(o);
  await registerObligationPayment({obligation:applyPayment(o,5000),payment:payment('p1','a')});
  await assert.rejects(saveObligation(cancelObligation(o,'Cancelamento solicitado')),/OBRIGACAO_ALTERADA/);
  await assert.rejects(saveObligations([o]));
  assert.equal((await listObligations())[0].paidCents,5000);
});

test('closing is recomputed atomically and rejects a stale screen',async()=>{
  await reset();
  const movements=['Água','Energia'].map((category,i)=>normalizeMovement({id:`m${i}`,competence:'2026-10',date:'2026-10-08',kind:'expense',category,description:category,amountCents:1000}));
  for(const m of movements)await saveTransaction(m);
  const record=createClosingRecord({summary:summarizeCompetence({competence:'2026-10',openingBalanceCents:5000,movements})});
  await saveTransaction({...movements[0],amountCents:2000});
  await assert.rejects(saveMonthClosing(record),/DADOS_ALTERADOS/);
  assert.equal((await listMonthClosings()).length,0);
  movements[0]={...movements[0],amountCents:2000};
  const fresh=createClosingRecord({summary:summarizeCompetence({competence:'2026-10',openingBalanceCents:5000,movements})});
  await saveMonthClosing(fresh);
  await assert.rejects(saveTransaction({...movements[0],amountCents:4000}),/COMPETENCIA_FECHADA/);
  await assert.rejects(saveMonthClosing(fresh),/COMPETENCIA_FECHADA/);
});

test('earlier closing cannot reopen while later balances are closed',async()=>{
  await reset();const snapshot=await exportDatabaseSnapshot();
  const make=competence=>createClosingRecord({summary:summarizeCompetence({competence,openingBalanceCents:0})});
  const october=make('2026-10'),november=make('2026-11');
  snapshot.stores.monthClosings=[october,november].map(value=>({key:value.id,value}));
  await restoreDatabaseSnapshot(snapshot);
  await assert.rejects(reopenMonthClosing(reopenClosingRecord(october,'Corrigir despesas')),/MESES_POSTERIORES/);
  await reopenMonthClosing(reopenClosingRecord(november,'Corrigir despesas'));
  await reopenMonthClosing(reopenClosingRecord(october,'Corrigir despesas'));
});

test('incomplete restore preserves all existing records',async()=>{
  await reset();await saveObligation(obligation('a'));
  const snapshot=await exportDatabaseSnapshot();delete snapshot.stores.payments;
  await assert.rejects(restoreDatabaseSnapshot(snapshot),/BACKUP_INCOMPLETO/);
  assert.equal((await listObligations()).length,1);
});

test('summary rejects invalid dates, duplicate payments and unsafe totals',()=>{
  assert.throws(()=>normalizeMovement({id:'x',competence:'2026-02',date:'2026-02-30',kind:'expense',description:'Despesa',amountCents:1}),/DATA/);
  const p=payment('p','a');
  assert.throws(()=>summarizeCompetence({competence:'2026-10',openingBalanceCents:0,payments:[p,p]}),/DUPLICADO/);
  assert.throws(()=>summarizeCompetence({competence:'2026-10',openingBalanceCents:Number.MAX_SAFE_INTEGER,payments:[p]}),/inteiro/);
});

test('tampered restore cannot replace a valid ledger with inconsistent payments',async()=>{
  await reset();const o=obligation('a');await saveObligation(o);
  await registerObligationPayment({obligation:applyPayment(o,5000),payment:payment('p1','a')});
  const snapshot=await exportDatabaseSnapshot();snapshot.stores.obligations[0].value.paidCents=8000;
  await assert.rejects(restoreDatabaseSnapshot(snapshot),/TOTAL_PAGAMENTOS_DIVERGENTE/);
  assert.equal((await listObligations())[0].paidCents,5000);
});
