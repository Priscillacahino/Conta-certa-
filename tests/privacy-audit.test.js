import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('pacote público mantém regras de exclusão de dados privados',()=>{
  const ignore=read('.gitignore');
  assert.match(ignore,/(^|\n)private\//m);
  assert.match(ignore,/\*\.private\.json/);
  assert.equal(fs.existsSync(path.join(root,'private')),false);
});

test('políticas de navegador reduzem vazamento e execução externa',()=>{
  const html=read('index.html');
  assert.match(html,/Content-Security-Policy/);
  assert.match(html,/script-src 'self'/);
  assert.match(html,/name="referrer" content="no-referrer"/);
});

test('service worker não referencia dados privados e restringe origem',()=>{
  const sw=read('sw.js');
  assert.doesNotMatch(sw,/private\/|\.private\.json/);
  assert.match(sw,/url\.origin !== self\.location\.origin/);
});

test('interface inicia bloqueada antes de executar JavaScript',()=>{
  assert.match(read('index.html'),/<body class="app-locked">/);
});
