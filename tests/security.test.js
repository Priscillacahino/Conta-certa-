import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecurityCredential, verifySecurityCredential, isSessionActive, nextSessionDeadline, unlockThrottleStatus, recordUnlockFailure, resetUnlockThrottle } from '../src/security.js';

test('credencial PBKDF2 valida o segredo correto', async () => {
  const credential = await createSecurityCredential('Brise#2026');
  assert.equal(credential.algorithm, 'PBKDF2-SHA-256');
  assert.ok(credential.iterations >= 100000);
  assert.equal(await verifySecurityCredential('Brise#2026', credential), true);
});

test('credencial PBKDF2 rejeita segredo incorreto', async () => {
  const credential = await createSecurityCredential('Brise#2026');
  assert.equal(await verifySecurityCredential('OutraSenha', credential), false);
});

test('segredo curto é recusado', async () => {
  await assert.rejects(() => createSecurityCredential('12345'), /SEGREDO_MUITO_CURTO/);
});

test('prazo de sessão expira corretamente', () => {
  const now = 100000;
  const deadline = nextSessionDeadline(now, 60000);
  assert.equal(isSessionActive(deadline, now + 59999), true);
  assert.equal(isSessionActive(deadline, now + 60000), false);
});


test('mesma senha gera verificadores diferentes por causa do salt', async () => {
  const a = await createSecurityCredential('SenhaSegura#1');
  const b = await createSecurityCredential('SenhaSegura#1');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.verifier, b.verifier);
});

test('credencial adulterada ou com parâmetros fracos é rejeitada', async () => {
  const c = await createSecurityCredential('SenhaSegura#1');
  assert.equal(await verifySecurityCredential('SenhaSegura#1', {...c, iterations:99999}), false);
  assert.equal(await verifySecurityCredential('SenhaSegura#1', {...c, verifier:'%%%'}), false);
});

test('cinco falhas consecutivas ativam bloqueio temporário', () => {
  let state = resetUnlockThrottle();
  for (let i=0;i<4;i+=1) state = recordUnlockFailure(state, 1000+i, {maxAttempts:5,cooldownMs:30000});
  assert.equal(state.blocked,false);
  state = recordUnlockFailure(state, 1004, {maxAttempts:5,cooldownMs:30000});
  assert.equal(state.blocked,true);
  assert.equal(unlockThrottleStatus(state, 31003).blocked,true);
  assert.equal(unlockThrottleStatus(state, 31004).blocked,false);
});
