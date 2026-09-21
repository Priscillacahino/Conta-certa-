import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Ã¡rea do morador possui login por telefone e PIN de quatro dÃ­gitos', () => {
  const html = readFileSync(new URL('../morador.html', import.meta.url), 'utf8');
  assert.match(html, /id="resident-login-phone"/);
  assert.match(html, /id="resident-login-pin"/);
  assert.match(html, /pattern="\[0-9\]\{4\}"/);
  assert.match(html, /id="resident-view-contributions"/);
  assert.match(html, /id="resident-view-statements"/);
  assert.match(html, /id="resident-view-documents"/);
});

test('instalador do morador aponta para manifesto e script prÃ³prios', () => {
  const html = readFileSync(new URL('../instalar-morador.html', import.meta.url), 'utf8');
  assert.match(html, /manifest-morador\.webmanifest\?v=0110/);
  assert.match(html, /src\/install-resident\.js\?v=0110/);
});

test('workflow publica a Ã¡rea do morador', () => {
  const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(workflow, /morador\.html/);
  assert.match(workflow, /instalar-morador\.html/);
  assert.match(workflow, /manifest-morador\.webmanifest/);
  assert.match(workflow, /resident\.css/);
});

