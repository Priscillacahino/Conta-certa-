import test from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrPayload } from '../src/qr.js';

test('gera matriz QR version 4 de 33x33', () => {
  const payload = qrPayload({certificateId:'CC-2026-101-ABCDEF12',verificationCode:'ABCDEF123456',contentHash:'0123456789abcdef0123456789abcdef'});
  const matrix = qrMatrix(payload);
  assert.equal(matrix.length, 33);
  assert.equal(matrix.every(row => row.length === 33), true);
  assert.equal(matrix[0][0], true);
  assert.equal(matrix[3][3], true);
});
