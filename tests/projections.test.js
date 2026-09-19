import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateQuote, evaluateProject } from '../src/projections.js';

test('projeção mostra quanto falta para um serviço', () => {
  const result = evaluateQuote({
    cashBalanceCents: 125872,
    quoteCents: 200000,
    activeUnits: 5,
  });

  assert.equal(result.availableForProjectCents, 125872);
  assert.equal(result.gapCents, 74128);
  assert.equal(result.hasEnoughCash, false);
  assert.equal(result.suggestedExtraPerUnitCents, 14826);
});

test('reserva mínima reduz o caixa disponível para o projeto', () => {
  const result = evaluateQuote({
    cashBalanceCents: 300000,
    quoteCents: 250000,
    protectedReserveCents: 100000,
    activeUnits: 5,
  });

  assert.equal(result.availableForProjectCents, 200000);
  assert.equal(result.gapCents, 50000);
  assert.equal(result.suggestedExtraPerUnitCents, 10000);
});

test('avalia vários orçamentos sem escolher automaticamente um fornecedor', () => {
  const project = evaluateProject({
    name: 'Serviço de fachada',
    cashBalanceCents: 125872,
    activeUnits: 5,
    quotes: [
      { id: 'a', supplier: 'Fornecedor A', amountCents: 180000 },
      { id: 'b', supplier: 'Fornecedor B', amountCents: 220000 },
    ],
  });

  assert.equal(project.quotes.length, 2);
  assert.equal(project.quotes[0].gapCents, 54128);
  assert.equal(project.quotes[1].gapCents, 94128);
});
