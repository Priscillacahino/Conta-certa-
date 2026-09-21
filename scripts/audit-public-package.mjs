import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passes = [];
const check = (condition, message) => (condition ? passes : failures).push(message);
const textFiles = [];
const binaryExtensions = new Set(['.png','.jpg','.jpeg','.pdf','.zip','.xlsx']);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    if (['.git','node_modules'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replaceAll('\\','/');
    if (entry.isDirectory()) {
      check(rel !== 'private' && !rel.startsWith('private/'), `sem pasta privada publicada: ${rel}`);
      walk(full);
    } else {
      check(!entry.name.endsWith('.private.json'), `sem arquivo .private.json publicado: ${rel}`);
      check(!entry.name.endsWith('.ccresident.json'), `sem pacote de morador publicado: ${rel}`);
      if (!binaryExtensions.has(path.extname(entry.name).toLowerCase())) textFiles.push({ rel, content:fs.readFileSync(full,'utf8') });
    }
  }
}
walk(root);

const allText = textFiles.map(x => `\n---${x.rel}---\n${x.content}`).join('');
const gitignore = fs.readFileSync(path.join(root,'.gitignore'),'utf8');
const index = fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw = fs.readFileSync(path.join(root,'sw.js'),'utf8');

check(/(^|\n)private\//m.test(gitignore), '.gitignore bloqueia private/');
check(/\*\.private\.json/.test(gitignore), '.gitignore bloqueia *.private.json');
check(index.includes('Content-Security-Policy'), 'index possui Content Security Policy');
check(index.includes('name="referrer" content="no-referrer"'), 'index usa política no-referrer');
check(!/https?:\/\//i.test(sw), 'service worker não contém endpoint externo');
check(!/localStorage\.(setItem|getItem)\([^)]*(password|senha|secret|credential|token)/i.test(allText), 'nenhum segredo é persistido em localStorage');
check(!/(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(allText), 'nenhuma chave privada PEM publicada');
check(!/(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{30,})/.test(allText), 'nenhum token comum detectado');
check(sw.includes("url.origin !== self.location.origin"), 'service worker restringe cache a mesma origem');
check(!/private\/|\.private\.json/.test(sw), 'service worker não referencia arquivo privado');
check(allText.includes("excludedLocalSecrets: ['securityCredential']"), 'backup declara exclusão da credencial local');
check(allText.includes("entry?.key === 'securityCredential'") || allText.includes("entry.key === 'securityCredential'"), 'backup filtra securityCredential');

for (const item of passes) console.log(`✔ ${item}`);
for (const item of failures) console.error(`✘ ${item}`);
console.log(`\nAuditoria pública: ${passes.length} verificações aprovadas; ${failures.length} falha(s).`);
if (failures.length) process.exitCode = 1;
