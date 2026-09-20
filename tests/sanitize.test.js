import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, safeFileBase } from '../src/sanitize.js';

test('escape HTML neutraliza marcação e atributos injetados', () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert(1)">&'`), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;');
});

test('nome seguro de arquivo remove separadores e caracteres perigosos', () => {
  assert.equal(safeFileBase('../../Prestação: setembro/2026'), '.._.._Prestacao_setembro_2026');
});
