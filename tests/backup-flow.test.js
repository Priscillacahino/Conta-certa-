import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import 'fake-indexeddb/auto';
import { encryptSnapshot, decryptSnapshot } from '../src/backup.js';
import { exportDatabaseSnapshot, validateDatabaseSnapshot } from '../src/db.js';

function flow() {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {value:'',disabled:false,hidden:true,textContent:'',removeAttribute(name){delete this[name];}});
    return elements.get(id);
  };
  const urls = new Map(); let sequence=0;
  const context=vm.createContext({$,Blob,Date,JSON,Error,encryptSnapshot,decryptSnapshot,exportDatabaseSnapshot,validateDatabaseSnapshot,
    URL:{createObjectURL(blob){const url=`blob:test-${++sequence}`;urls.set(url,blob);return url;},revokeObjectURL(url){urls.delete(url);}}
  });
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  vm.runInContext(app.slice(app.indexOf('let preparedBackupUrl'),app.indexOf('async function restoreEncryptedBackup')),context);
  return {context,$,urls};
}

test('preparation produces an encrypted file without automatic navigation and releases previous file', async()=>{
  const {context,$,urls}=flow();
  for(let i=0;i<2;i++) {
    $('#backup-passphrase').value='backup-flow-test-123';
    $('#backup-confirm').value='backup-flow-test-123';
    await vm.runInContext('createEncryptedBackup()',context);
    assert.equal($('#create-backup').disabled,false);
    assert.equal($('#save-backup').hidden,false);
    assert.match($('#save-backup').download,/^Conta_Certa_backup_.*\.ccbackup\.json$/);
    assert.equal(urls.size,1);
    const envelope=JSON.parse(await urls.get($('#save-backup').href).text());
    const snapshot=await decryptSnapshot(envelope,'backup-flow-test-123');
    validateDatabaseSnapshot(snapshot);
    assert.equal($('#backup-passphrase').value,'');
    assert.equal($('#backup-confirm').value,'');
  }
  vm.runInContext('discardPreparedBackup()',context);
  assert.equal(urls.size,0);
  assert.equal($('#save-backup').hidden,true);
});

test('file verification and wrong password leave existing database unchanged', async()=>{
  const {context,$}=flow();
  const original=await exportDatabaseSnapshot('0.12.5');
  const envelope=await encryptSnapshot(original,'backup-flow-test-123');
  const content=JSON.stringify(envelope);
  $('#restore-backup-file').files=[{size:content.length,text:async()=>content}];
  for(const password of ['wrong-password-123','backup-flow-test-123']) {
    $('#backup-passphrase').value=password;
    await vm.runInContext('verifySelectedBackup()',context);
    assert.equal($('#validate-backup').disabled,false);
    assert.equal($('#backup-passphrase').value,'');
    assert.deepEqual((await exportDatabaseSnapshot()).stores,original.stores);
    assert.match($('#backup-feedback').textContent,password==='wrong-password-123'?/Verificação recusada/:/Arquivo verificado/);
  }
});

test('verification rejects incomplete backup without writing to database', async()=>{
  const {context,$}=flow();
  const original=await exportDatabaseSnapshot();
  const partial=structuredClone(original); delete partial.stores.payments;
  const envelope=await encryptSnapshot(partial,'backup-flow-test-123');
  const content=JSON.stringify(envelope);
  $('#restore-backup-file').files=[{size:content.length,text:async()=>content}];
  $('#backup-passphrase').value='backup-flow-test-123';
  await vm.runInContext('verifySelectedBackup()',context);
  assert.match($('#backup-feedback').textContent,/BACKUP_INCOMPLETO/);
  assert.deepEqual((await exportDatabaseSnapshot()).stores,original.stores);
});
