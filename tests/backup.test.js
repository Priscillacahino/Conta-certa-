import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshotEnvelope, encryptSnapshot, decryptSnapshot, BACKUP_CONSTANTS } from '../src/backup.js';

test('backup criptografado restaura o snapshot integralmente', async () => {
  const snapshot=createSnapshotEnvelope({settings:[{key:'x',value:1}],units:[{id:'101'}]},{appVersion:'0.9.0',createdAt:'2026-09-20T03:00:00Z'});
  const encrypted=await encryptSnapshot(snapshot,'senha-forte-123',{iterations:150000});
  const restored=await decryptSnapshot(encrypted,'senha-forte-123');
  assert.deepEqual(restored,snapshot);
  assert.equal(encrypted.algorithm,'PBKDF2-SHA-256+A256GCM');
});

test('backup rejeita senha incorreta', async () => {
  const snapshot=createSnapshotEnvelope({settings:[]});
  const encrypted=await encryptSnapshot(snapshot,'senha-forte-123',{iterations:150000});
  await assert.rejects(()=>decryptSnapshot(encrypted,'senha-errada-456'),/BACKUP_SENHA_OU_INTEGRIDADE_INVALIDA/);
});

test('backup detecta adulteração do conteúdo cifrado', async () => {
  const snapshot=createSnapshotEnvelope({settings:[]});
  const encrypted=await encryptSnapshot(snapshot,'senha-forte-123',{iterations:150000});
  const chars=encrypted.ciphertext.split(''); chars[5]=chars[5]==='A'?'B':'A';
  await assert.rejects(()=>decryptSnapshot({...encrypted,ciphertext:chars.join('')},'senha-forte-123'),/BACKUP_SENHA_OU_INTEGRIDADE_INVALIDA/);
});


test('snapshot remove securityCredential mesmo se recebida diretamente', () => {
  const snapshot=createSnapshotEnvelope({settings:[{key:'securityCredential',value:{verifier:'x'}},{key:'tema',value:'claro'}]});
  assert.deepEqual(snapshot.stores.settings,[{key:'tema',value:'claro'}]);
});

test('backup recusa IV e salt com tamanho inválido', async () => {
  const snapshot=createSnapshotEnvelope({settings:[]});
  const encrypted=await encryptSnapshot(snapshot,'senha-forte-123',{iterations:150000});
  await assert.rejects(()=>decryptSnapshot({...encrypted,iv:'QUJDRA=='},'senha-forte-123'),/BACKUP_IV_INVALIDO/);
  await assert.rejects(()=>decryptSnapshot({...encrypted,salt:'QUJDRA=='},'senha-forte-123'),/BACKUP_SALT_INVALIDO/);
});

test('parâmetros de backup excessivos são recusados antes da derivação', async () => {
  const envelope={format:BACKUP_CONSTANTS.backupFormat,version:1,algorithm:'PBKDF2-SHA-256+A256GCM',iterations:3000000,salt:'AAAAAAAAAAAAAAAAAAAAAA==',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AAAAAAAAAAAAAAAAAAAAAAAA'};
  await assert.rejects(()=>decryptSnapshot(envelope,'senha-forte-123'),/BACKUP_PARAMETROS_INVALIDOS/);
});
