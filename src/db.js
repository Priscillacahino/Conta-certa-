import { createSnapshotEnvelope, validateSnapshot } from './backup.js';
import { competenceFromIso } from './closing.js';

const DB_NAME = 'conta-certa';
const DB_VERSION = 6;
const SETTINGS = 'settings';
const PROJECTIONS = 'projections';
const RESIDENTIAL = 'residential';
const UNITS = 'units';
const PERIODS = 'periods';
const IMPORT_META = 'importMeta';
const OBLIGATIONS = 'obligations';
const PAYMENTS = 'payments';
const CERTIFICATES = 'certificates';
const CERTIFICATE_EVENTS = 'certificateEvents';
const TRANSACTIONS = 'transactions';
const MONTH_CLOSINGS = 'monthClosings';
const CLOSING_EVENTS = 'closingEvents';

const BACKUP_STORES = [SETTINGS,PROJECTIONS,RESIDENTIAL,UNITS,PERIODS,IMPORT_META,OBLIGATIONS,PAYMENTS,CERTIFICATES,CERTIFICATE_EVENTS,TRANSACTIONS,MONTH_CLOSINGS,CLOSING_EVENTS];

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS);
      if (!db.objectStoreNames.contains(PROJECTIONS)) db.createObjectStore(PROJECTIONS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(RESIDENTIAL)) db.createObjectStore(RESIDENTIAL, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(UNITS)) db.createObjectStore(UNITS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PERIODS)) db.createObjectStore(PERIODS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(IMPORT_META)) db.createObjectStore(IMPORT_META);
      if (!db.objectStoreNames.contains(OBLIGATIONS)) db.createObjectStore(OBLIGATIONS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PAYMENTS)) db.createObjectStore(PAYMENTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CERTIFICATES)) db.createObjectStore(CERTIFICATES, { keyPath: 'certificateId' });
      if (!db.objectStoreNames.contains(CERTIFICATE_EVENTS)) db.createObjectStore(CERTIFICATE_EVENTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(TRANSACTIONS)) db.createObjectStore(TRANSACTIONS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(MONTH_CLOSINGS)) db.createObjectStore(MONTH_CLOSINGS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CLOSING_EVENTS)) db.createObjectStore(CLOSING_EVENTS, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getFrom(store, key, fallback = null) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? fallback);
    req.onerror = () => reject(req.error);
  }));
}

function putTo(store, value, key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    key === undefined ? tx.objectStore(store).put(value) : tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  }));
}

function getAll(store) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  }));
}

function getAllEntries(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const valuesReq = store.getAll();
    const keysReq = store.getAllKeys();
    let values = null, keys = null;
    const finish = () => { if (values && keys) resolve(values.map((value,i)=>({key:keys[i],value}))); };
    valuesReq.onsuccess = () => { values=valuesReq.result ?? []; finish(); };
    keysReq.onsuccess = () => { keys=keysReq.result ?? []; finish(); };
    valuesReq.onerror = () => reject(valuesReq.error);
    keysReq.onerror = () => reject(keysReq.error);
  });
}

export const getSetting = (key, fallback = null) => getFrom(SETTINGS, key, fallback);
export const setSetting = (key, value) => putTo(SETTINGS, value, key);
export const saveProjection = projection => putTo(PROJECTIONS, projection);
export const listProjections = () => getAll(PROJECTIONS);
export const getResidential = () => getAll(RESIDENTIAL).then(items => items[0] ?? null);
export const listUnits = () => getAll(UNITS);
export const listPeriods = () => getAll(PERIODS);
export const getImportMeta = () => getFrom(IMPORT_META, 'current', null);
export async function saveObligation(obligation) {
  const db=await openDb();
  const competence = Number(obligation?.year) && Number(obligation?.month) ? `${obligation.year}-${String(obligation.month).padStart(2,'0')}` : null;
  if (!competence) return putTo(OBLIGATIONS, obligation);
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([OBLIGATIONS,MONTH_CLOSINGS],'readwrite');
    const req=tx.objectStore(MONTH_CLOSINGS).get(competence);
    req.onsuccess=()=>{
      if(req.result?.status==='closed'){tx.abort();reject(new Error('COMPETENCIA_FECHADA'));return;}
      tx.objectStore(OBLIGATIONS).put(obligation);
    };
    req.onerror=()=>reject(req.error); tx.oncomplete=()=>resolve(obligation); tx.onerror=()=>reject(tx.error);
  });
}
export const listObligations = () => getAll(OBLIGATIONS);
export const listPayments = () => getAll(PAYMENTS);
export const listCertificates = () => getAll(CERTIFICATES);
export const listCertificateEvents = () => getAll(CERTIFICATE_EVENTS);
export const listTransactions = () => getAll(TRANSACTIONS);
export const listMonthClosings = () => getAll(MONTH_CLOSINGS);
export const listClosingEvents = () => getAll(CLOSING_EVENTS);
export const getMonthClosing = competence => getFrom(MONTH_CLOSINGS, competence, null);

export async function saveObligations(obligations = []) {
  const db = await openDb();
  const competences=[...new Set(obligations.map(o => Number(o?.year)&&Number(o?.month) ? `${o.year}-${String(o.month).padStart(2,'0')}` : null).filter(Boolean))];
  for(const competence of competences){
    const closing=await getMonthClosing(competence);
    if(closing?.status==='closed') throw new Error('COMPETENCIA_FECHADA');
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OBLIGATIONS, 'readwrite');
    const store = tx.objectStore(OBLIGATIONS);
    for (const obligation of obligations) store.put(obligation);
    tx.oncomplete = () => resolve(obligations);
    tx.onerror = () => reject(tx.error);
  });
}

export async function registerObligationPayment({ obligation, payment }) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const competence = competenceFromIso(payment?.paidAt);
    const stores = competence ? [OBLIGATIONS,PAYMENTS,MONTH_CLOSINGS] : [OBLIGATIONS,PAYMENTS];
    const tx = db.transaction(stores, 'readwrite');
    const write = () => {
      tx.objectStore(OBLIGATIONS).put(obligation);
      tx.objectStore(PAYMENTS).put(payment);
    };
    if (!competence) write();
    else {
      const req = tx.objectStore(MONTH_CLOSINGS).get(competence);
      req.onsuccess = () => {
        if (req.result?.status === 'closed') { tx.abort(); reject(new Error('COMPETENCIA_FECHADA')); return; }
        write();
      };
      req.onerror = () => reject(req.error);
    }
    tx.oncomplete = () => resolve({ obligation, payment });
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveTransaction(movement) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([TRANSACTIONS,MONTH_CLOSINGS], 'readwrite');
    const req = tx.objectStore(MONTH_CLOSINGS).get(movement.competence);
    req.onsuccess = () => {
      if (req.result?.status === 'closed') { tx.abort(); reject(new Error('COMPETENCIA_FECHADA')); return; }
      tx.objectStore(TRANSACTIONS).put(movement);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve(movement);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMonthClosing(record) {
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([MONTH_CLOSINGS,CLOSING_EVENTS],'readwrite');
    tx.objectStore(MONTH_CLOSINGS).put(record);
    tx.objectStore(CLOSING_EVENTS).add({id:crypto.randomUUID(),competence:record.competence,type:'CLOSED',revision:record.revision,at:record.closedAt,closingBalanceCents:record.closingBalanceCents});
    tx.oncomplete=()=>resolve(record); tx.onerror=()=>reject(tx.error);
  });
}

export async function reopenMonthClosing(record) {
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([MONTH_CLOSINGS,CLOSING_EVENTS],'readwrite');
    tx.objectStore(MONTH_CLOSINGS).put(record);
    tx.objectStore(CLOSING_EVENTS).add({id:crypto.randomUUID(),competence:record.competence,type:'REOPENED',revision:record.revision,at:record.reopenedAt,reason:record.reopenReason});
    tx.oncomplete=()=>resolve(record); tx.onerror=()=>reject(tx.error);
  });
}

export async function saveIssuedCertificate(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CERTIFICATES, CERTIFICATE_EVENTS], 'readwrite');
    tx.objectStore(CERTIFICATES).add(record);
    tx.objectStore(CERTIFICATE_EVENTS).add({id:crypto.randomUUID(),certificateId:record.certificateId,type:'ISSUED',at:record.issuedAt,unitId:record.unitId,year:record.year,contentHash:record.contentHash,pdfHash:record.pdfHash});
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function revokeStoredCertificate(certificateId, reason, revokedAt = new Date().toISOString()) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CERTIFICATES, CERTIFICATE_EVENTS], 'readwrite');
    const certStore = tx.objectStore(CERTIFICATES);
    const req = certStore.get(certificateId);
    let updated = null;
    req.onsuccess = () => {
      const current = req.result;
      if (!current) { tx.abort(); reject(new Error('DECLARACAO_NAO_ENCONTRADA')); return; }
      if (current.status !== 'VALID') { tx.abort(); reject(new Error('DECLARACAO_JA_INVALIDA')); return; }
      const cleanReason = String(reason ?? '').trim();
      if (!cleanReason) { tx.abort(); reject(new Error('MOTIVO_REVOGACAO_OBRIGATORIO')); return; }
      updated = { ...current, status: 'REVOKED', revokedAt, revocationReason: cleanReason };
      certStore.put(updated);
      tx.objectStore(CERTIFICATE_EVENTS).add({id:crypto.randomUUID(),certificateId,type:'REVOKED',at:revokedAt,reason:cleanReason,unitId:current.unitId,year:current.year});
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve(updated);
    tx.onerror = () => reject(tx.error);
  });
}

export async function replacePrivateProfile(profile) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([RESIDENTIAL, UNITS, SETTINGS], 'readwrite');
    const residential = tx.objectStore(RESIDENTIAL); const units = tx.objectStore(UNITS); const settings = tx.objectStore(SETTINGS);
    residential.clear(); units.clear(); residential.put(profile.residential); for (const unit of profile.units) units.put(unit);
    settings.put({importedAt:new Date().toISOString(),residentialId:profile.residential.id,unitCount:profile.units.length}, 'privateProfileMeta');
    tx.oncomplete = () => resolve(profile); tx.onerror = () => reject(tx.error);
  });
}

export async function replaceImportedData(bundle, summary) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([RESIDENTIAL, UNITS, PERIODS, IMPORT_META], 'readwrite');
    const residential=tx.objectStore(RESIDENTIAL), units=tx.objectStore(UNITS), periods=tx.objectStore(PERIODS), meta=tx.objectStore(IMPORT_META);
    residential.clear(); units.clear(); periods.clear(); residential.put(bundle.residential); for(const unit of bundle.units) units.put(unit); for(const period of bundle.periods) periods.put(period);
    meta.put({...summary,importedAt:new Date().toISOString(),source:bundle.source??null},'current');
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
  });
}

export async function exportDatabaseSnapshot(appVersion = 'unknown') {
  const db=await openDb();
  const stores={};
  for(const name of BACKUP_STORES) {
    const entries=await getAllEntries(db,name);
    stores[name]=entries.filter(entry => !(name===SETTINGS && entry.key==='securityCredential'));
  }
  return createSnapshotEnvelope(stores,{appVersion});
}

export async function restoreDatabaseSnapshot(snapshot) {
  validateSnapshot(snapshot);
  const unknown=Object.keys(snapshot.stores).filter(name=>!BACKUP_STORES.includes(name));
  if(unknown.length) throw new Error(`BACKUP_STORE_DESCONHECIDO:${unknown.join(',')}`);
  const securityCredential=await getSetting('securityCredential',null);
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(BACKUP_STORES,'readwrite');
    for(const name of BACKUP_STORES) tx.objectStore(name).clear();
    for(const name of BACKUP_STORES) {
      const store=tx.objectStore(name);
      const entries=snapshot.stores[name] ?? [];
      for(const entry of entries) {
        if(name===SETTINGS && entry.key==='securityCredential') continue;
        store.keyPath == null ? store.put(entry.value,entry.key) : store.put(entry.value);
      }
    }
    if(securityCredential) tx.objectStore(SETTINGS).put(securityCredential,'securityCredential');
    tx.objectStore(SETTINGS).put({restoredAt:new Date().toISOString(),sourceBackupCreatedAt:snapshot.createdAt,sourceAppVersion:snapshot.appVersion},'lastRestoreMeta');
    tx.oncomplete=()=>resolve(true); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error ?? new Error('RESTAURACAO_ABORTADA'));
  });
}
