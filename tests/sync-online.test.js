import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const residentHtml = readFileSync(new URL('../morador.html', import.meta.url), 'utf8');
const residentJs = readFileSync(new URL('../src/resident.js', import.meta.url), 'utf8');
const syncClient = readFileSync(new URL('../src/sync-client.js', import.meta.url), 'utf8');

test('administrador exibe estado da sincronização', () => {
  assert.match(index, /id="sync-status-badge"/);
  assert.match(index, /id="sync-status-detail"/);
  assert.match(app, /conta-certa-sync/);
  assert.match(app, /getAdminSyncStatus/);
});

test('morador possui ativação online e contingência por arquivo', () => {
  assert.match(residentHtml, /id="resident-online-code"/);
  assert.match(residentHtml, /id="resident-package-file"/);
  assert.match(residentHtml, /id="resident-activation-token"/);
  assert.doesNotMatch(residentHtml, /id="resident-activation-token"[^>]*required/);
});

test('morador atualiza ao retomar conexão e usa sessão remota', () => {
  assert.match(residentJs, /window\.addEventListener\('online'/);
  assert.match(residentJs, /window\.addEventListener\('focus'/);
  assert.match(residentJs, /refreshResidentFromServer/);
  assert.match(syncClient, /RESIDENT_TOKEN_KEY/);
  assert.match(syncClient, /\/api\/resident\/snapshot\//);
});

test('snapshot administrativo usa versão 0.11.1', () => {
  assert.match(syncClient, /exportDatabaseSnapshot\('0\.11\.1'\)/);
});
