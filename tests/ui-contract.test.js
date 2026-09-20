import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

function setFrom(regex, text) {
  return new Set([...text.matchAll(regex)].map(match => match[1]));
}

test('todos os IDs estáticos exigidos por app.js existem no HTML', () => {
  const referenced = setFrom(/\$\(['"]#([^'"]+)['"]\)/g, app);
  const present = setFrom(/id=["']([^"']+)["']/g, html);
  const missing = [...referenced].filter(id => !present.has(id)).sort();
  assert.deepEqual(missing, []);
});

test('interface operacional inclui caixa, backup e projeções ampliadas', () => {
  for (const id of [
    'closing-competence','closing-opening-balance','save-movement','close-month','reopen-month','download-statement',
    'backup-passphrase','backup-confirm','create-backup','restore-backup','committed-amount','contingency-percent','projection-comparison'
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));
});
