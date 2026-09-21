import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentTimestampFromDate } from '../src/obligations.js';

test('pagamento usa a data informada manualmente pelo administrador', () => {
  assert.equal(paymentTimestampFromDate('2026-09-03'), '2026-09-03T12:00:00');
  assert.equal(paymentTimestampFromDate('2026-10-01'), '2026-10-01T12:00:00');
});

test('data de pagamento inválida é recusada', () => {
  assert.throws(() => paymentTimestampFromDate('03/09/2026'), /DATA_PAGAMENTO_INVALIDA/);
  assert.throws(() => paymentTimestampFromDate('2026-02-31'), /DATA_PAGAMENTO_INVALIDA/);
});
