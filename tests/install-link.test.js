import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('pagina de instalacao referencia manifest e instalador', () => {
  const html = readFileSync(new URL('../instalar.html', import.meta.url), 'utf8');
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /src\/install\.js/);
  assert.match(html, /id="install-button"/);
});

test('instalador usa prompt nativo quando disponivel', () => {
  const js = readFileSync(new URL('../src/install.js', import.meta.url), 'utf8');
  assert.match(js, /beforeinstallprompt/);
  assert.match(js, /prompt\.prompt\(\)/);
  assert.match(js, /appinstalled/);
  assert.match(js, /iosHelp/);
  assert.match(js, /isIOS/);
});

test('workflow publica instalar.html', () => {
  const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(workflow, /instalar\.html/);
});


test('instalador força atualização dos arquivos críticos e do service worker', () => {
  const html = readFileSync(new URL('../instalar.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../src/install.js', import.meta.url), 'utf8');
  assert.match(html, /manifest\.webmanifest\?v=0100/);
  assert.match(html, /styles\.css\?v=0100/);
  assert.match(html, /src\/install\.js\?v=0100/);
  assert.match(js, /updateViaCache:\s*['"]none['"]/);
  assert.match(js, /registration\.update\(\)/);
  assert.match(js, /\.\/\?v=0100/);
});
