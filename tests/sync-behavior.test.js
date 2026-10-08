import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {setSetting} from '../src/db.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
globalThis.localStorage=storage();
globalThis.sessionStorage=storage();
globalThis.window=new EventTarget();
const sync=await import('../src/sync-client.js');

test('unchanged data does not resync due to snapshot timestamp',async()=>{
  sync.setApiBaseUrl('http://localhost:8000');
  sessionStorage.setItem('conta-certa-admin-api-token','test-session');
  let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({syncVersion:calls}),{status:200});};
  await setSetting('example',1);
  const first=await sync.syncAdminNow();
  assert.equal(first.syncVersion,1);
  const second=await sync.syncAdminNow();
  assert.equal(second.reason,'unchanged');
  assert.equal(calls,1);
  await setSetting('example',2);
  await Promise.all([sync.syncAdminNow(),sync.syncAdminNow()]);
  assert.equal(calls,2);
});

test('changing API clears sessions and synchronization versions',()=>{
  sessionStorage.setItem('conta-certa-resident-api-token','test-resident');
  sync.setApiBaseUrl('http://localhost:8001');
  assert.equal(sessionStorage.getItem('conta-certa-admin-api-token'),null);
  assert.equal(sessionStorage.getItem('conta-certa-resident-api-token'),null);
  assert.equal(localStorage.getItem('conta-certa-admin-sync-version'),null);
});

test('resident authentication never reuses another existing session',async()=>{
  sessionStorage.setItem('conta-certa-resident-api-token','other-session');
  let path='';
  globalThis.fetch=async url=>{path=url;return new Response(JSON.stringify({token:'new-session',snapshot:{unit:{id:'101'}}}),{status:200});};
  await sync.refreshResidentRemote({phone:'83999999999',pin:'123456',authenticate:true});
  assert.ok(path.endsWith('/api/auth/resident/login/'));
});
