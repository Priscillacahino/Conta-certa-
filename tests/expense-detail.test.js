import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredExpenseStatus, summarizeCompetence } from '../src/closing.js';

test('água e energia são obrigatórias para o fechamento operacional', () => {
  const competence = '2026-09';
  const water = {id:'w',competence,date:'2026-09-05',kind:'expense',category:'Água',description:'Água — setembro/2026',amountCents:49340};
  let status = requiredExpenseStatus([water], competence);
  assert.equal(status.complete, false);
  assert.deepEqual(status.missing, ['Energia']);

  const energy = {id:'e',competence,date:'2026-09-06',kind:'expense',category:'Energia',description:'Energia — setembro/2026',amountCents:3011};
  status = requiredExpenseStatus([water, energy], competence);
  assert.equal(status.complete, true);
  assert.deepEqual(status.missing, []);
});

test('outras despesas podem ter vários itens e permanecem discriminadas', () => {
  const competence='2026-09';
  const movements=[
    {id:'w',competence,date:'2026-09-05',kind:'expense',category:'Água',description:'Água — setembro/2026',amountCents:49340},
    {id:'e',competence,date:'2026-09-06',kind:'expense',category:'Energia',description:'Energia — setembro/2026',amountCents:3011},
    {id:'o1',competence,date:'2026-09-10',kind:'expense',category:'Outros',description:'Dedetização',amountCents:3000},
    {id:'o2',competence,date:'2026-09-11',kind:'expense',category:'Outros',description:'Cupinização',amountCents:7000},
  ];
  const summary=summarizeCompetence({competence,openingBalanceCents:0,payments:[],movements});
  assert.equal(summary.expenseMovements.length,4);
  assert.equal(summary.expenseCents,62351);
  assert.deepEqual(summary.expenseMovements.map(m=>m.description),[
    'Água — setembro/2026','Energia — setembro/2026','Dedetização','Cupinização'
  ]);
});
