import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const publicDocs = ['README.md','docs/INSTALACAO_PWA.md'];

test('documentação pública não divulga endereço de instalação nem QR Code distribuível', () => {
  const combined = publicDocs.map(file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(combined, /priscillacahino\.github\.io\/Conta-certa-/i);
  assert.equal(existsSync(new URL('../assets/qrcode-instalacao-conta-certa.png', import.meta.url)), false);
  assert.equal(existsSync(new URL('../assets/qrcode-instalacao-conta-certa-poster.png', import.meta.url)), false);
  assert.equal(existsSync(new URL('../docs/QR_CODE_INSTALACAO.md', import.meta.url)), false);
  assert.equal(existsSync(new URL('../docs/LINK_INSTALACAO.md', import.meta.url)), false);
});
