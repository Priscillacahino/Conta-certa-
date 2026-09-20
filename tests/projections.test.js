import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateQuote, evaluateProject, exactSplit } from '../src/projections.js';

test('projeção mostra quanto falta para um serviço', () => {
  const result = evaluateQuote({cashBalanceCents:125872,quoteCents:200000,activeUnits:5});
  assert.equal(result.availableForProjectCents,125872);
  assert.equal(result.gapCents,74128);
  assert.equal(result.hasEnoughCash,false);
  assert.equal(result.suggestedExtraPerUnitCents,14826);
  assert.deepEqual(result.suggestedSplitCents,[14826,14826,14826,14825,14825]);
  assert.equal(result.suggestedSplitTotalCents,74128);
});

test('reserva mínima e compromissos reduzem o caixa disponível', () => {
  const result=evaluateQuote({cashBalanceCents:300000,quoteCents:150000,protectedReserveCents:100000,committedCents:25000,activeUnits:5});
  assert.equal(result.availableForProjectCents,175000);
  assert.equal(result.gapCents,0);
  assert.equal(result.canHireWithoutTouchingReserve,true);
});

test('contingência entra no custo planejado antes de calcular déficit', () => {
  const result=evaluateQuote({cashBalanceCents:100000,quoteCents:100000,contingencyBasisPoints:1000,activeUnits:5});
  assert.equal(result.contingencyCents,10000);
  assert.equal(result.plannedQuoteCents,110000);
  assert.equal(result.gapCents,10000);
});

test('avalia vários orçamentos sem escolher fornecedor e mostra amplitude', () => {
  const project=evaluateProject({name:'Serviço de fachada',cashBalanceCents:125872,activeUnits:5,quotes:[{id:'a',supplier:'Fornecedor A',amountCents:180000},{id:'b',supplier:'Fornecedor B',amountCents:220000}]});
  assert.equal(project.quotes.length,2);
  assert.equal(project.quotes[0].gapCents,54128);
  assert.equal(project.quotes[1].gapCents,94128);
  assert.equal(project.comparison.spreadCents,40000);
});

test('rateio exato preserva todos os centavos',()=>{
  assert.deepEqual(exactSplit(1,5),[1,0,0,0,0]);
  assert.equal(exactSplit(74128,5).reduce((a,b)=>a+b,0),74128);
});
