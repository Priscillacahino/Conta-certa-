import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {IDBObjectStore} from 'fake-indexeddb';
import {replaceImportedData,replacePrivateProfile,exportDatabaseSnapshot,restoreDatabaseSnapshot,listUnits,listPeriods,validateDatabaseSnapshot} from '../src/db.js';
import {summarizeImport} from '../src/migration.js';
import {storageProtection} from '../src/storage-protection.js';
const good=()=>({residential:{id:'persistence-test',name:'Fictício'},units:[{id:'101',responsibleName:'Teste'}],periods:[{id:'2026-08',year:2026,month:8,calculated:{revenueCents:1000,expenseCents:100,closingBalanceCents:900}}]});
const stores=async()=>(await exportDatabaseSnapshot()).stores;

test('valid import survives reopening database and derives metadata from actual file',async()=>{
 await replaceImportedData(good(),{periodCount:999});
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('conta-certa',6);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const units=await new Promise(resolve=>{const r=db.transaction('units').objectStore('units').getAll();r.onsuccess=()=>resolve(r.result);});
 db.close(); assert.equal(units.length,1); assert.equal((await stores()).importMeta[0].value.periodCount,1);
});

test('malformed, empty and duplicate imports cannot erase stored history',async()=>{
 await replaceImportedData(good()); const before=await stores();
 for(const change of [b=>b.units=[{label:'sem ID'}],b=>b.units=[],b=>b.periods=[],b=>b.units.push({...b.units[0]}),b=>b.periods.push({...b.periods[0]}),b=>b.periods[0].month=13,b=>b.periods[0].id='2026-13']){
  const bad=good();change(bad);await assert.rejects(replaceImportedData(bad));assert.deepEqual(await stores(),before);
 }
});

test('synchronous storage failure rolls back all scheduled clear operations',async()=>{
 await replaceImportedData(good()); const before=await stores();
 const put=IDBObjectStore.prototype.put;
 try{
  IDBObjectStore.prototype.put=function(...args){if(this.name==='units')throw new Error('SIMULATED_STORAGE_ERROR');return put.apply(this,args);};
  await assert.rejects(replaceImportedData(good()),/SIMULATED_STORAGE_ERROR/);
 }finally{IDBObjectStore.prototype.put=put;}
 assert.deepEqual(await stores(),before);
});

test('private profile write failure also preserves current residents',async()=>{
 await replaceImportedData(good());const before=await stores();
 const put=IDBObjectStore.prototype.put;
 try{
  IDBObjectStore.prototype.put=function(...args){if(this.name==='units')throw new Error('SIMULATED_PROFILE_ERROR');return put.apply(this,args);};
  await assert.rejects(replacePrivateProfile({residential:{id:'persistence-test',name:'Fictício',address:'Teste'},units:[{id:'101',responsibleName:'Teste'}]}),/SIMULATED_PROFILE_ERROR/);
 }finally{IDBObjectStore.prototype.put=put;}
 assert.deepEqual(await stores(),before);
});

test('imports cannot silently remove residents or older months',async()=>{
 const larger=good();larger.units.push({id:'102'});larger.periods.push({...larger.periods[0],id:'2026-07',month:7});
 await replaceImportedData(larger);const before=await stores();
 await assert.rejects(replaceImportedData(good()),/IMPORTACAO_REMOVERIA/);
 await assert.rejects(replacePrivateProfile({residential:{id:'persistence-test',name:'Fictício',address:'Teste'},units:[{id:'101',responsibleName:'Teste'}]}),/IMPORTACAO_REMOVERIA_UNIDADES/);
 assert.deepEqual(await stores(),before);
});

test('empty backup and stale remote restore cannot erase current data',async()=>{
 const snapshot=await exportDatabaseSnapshot(); const before=await stores();
 const empty=structuredClone(snapshot);for(const name of Object.keys(empty.stores))empty.stores[name]=[];
 await assert.rejects(restoreDatabaseSnapshot(empty),/BACKUP_VAZIO/);
 const stale=structuredClone(snapshot.stores);stale.units=[];
 await assert.rejects(restoreDatabaseSnapshot(snapshot,{expectedStores:stale}),/DADOS_LOCAIS_ALTERADOS/);
 const partial=structuredClone(snapshot);partial.stores.periods.pop();
 await assert.rejects(restoreDatabaseSnapshot(partial,{protectExisting:true}),/SINCRONIZACAO_REMOVERIA/);
 assert.deepEqual(await stores(),before);
});

test('restoration storage error rolls back database and preserves security settings',async()=>{
 const snapshot=await exportDatabaseSnapshot();const before=await stores();
 const put=IDBObjectStore.prototype.put;
 try{
  IDBObjectStore.prototype.put=function(...args){if(this.name==='units')throw new Error('SIMULATED_RESTORE_ERROR');return put.apply(this,args);};
  await assert.rejects(restoreDatabaseSnapshot(snapshot),/SIMULATED_RESTORE_ERROR/);
 }finally{IDBObjectStore.prototype.put=put;}
 assert.deepEqual(await stores(),before);
});

test('nonfinite backup key is rejected before storage transaction',async()=>{
 const snapshot=await exportDatabaseSnapshot();snapshot.stores.settings.push({key:NaN,value:'invalid'});
 assert.throws(()=>validateDatabaseSnapshot(snapshot),/BACKUP_CHAVE_DUPLICADA/);
});

test('browser protection request denial or unavailable API does not falsely claim persistence',async()=>{
 assert.deepEqual(await storageProtection({storage:null}),{supported:false,persistent:false});
 assert.equal((await storageProtection({request:true,storage:{persisted:async()=>false,persist:async()=>false}})).persistent,false);
 assert.equal((await storageProtection({request:true,storage:{persisted:async()=>false,persist:async()=>true}})).persistent,true);
 assert.equal((await storageProtection({request:true,storage:{persisted:async()=>{throw Error('denied');}}})).persistent,false);
});
