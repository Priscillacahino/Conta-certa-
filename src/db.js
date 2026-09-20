const DB_NAME = 'conta-certa';
const DB_VERSION = 4;
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

export const getSetting = (key, fallback = null) => getFrom(SETTINGS, key, fallback);
export const setSetting = (key, value) => putTo(SETTINGS, value, key);
export const saveProjection = projection => putTo(PROJECTIONS, projection);
export const listProjections = () => getAll(PROJECTIONS);
export const getResidential = () => getAll(RESIDENTIAL).then(items => items[0] ?? null);
export const listUnits = () => getAll(UNITS);
export const listPeriods = () => getAll(PERIODS);
export const getImportMeta = () => getFrom(IMPORT_META, 'current', null);
export const saveObligation = obligation => putTo(OBLIGATIONS, obligation);
export const listObligations = () => getAll(OBLIGATIONS);
export const listPayments = () => getAll(PAYMENTS);
export const listCertificates = () => getAll(CERTIFICATES);
export const listCertificateEvents = () => getAll(CERTIFICATE_EVENTS);

export async function saveObligations(obligations = []) {
  const db = await openDb();
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
    const tx = db.transaction([OBLIGATIONS, PAYMENTS], 'readwrite');
    tx.objectStore(OBLIGATIONS).put(obligation);
    tx.objectStore(PAYMENTS).put(payment);
    tx.oncomplete = () => resolve({ obligation, payment });
    tx.onerror = () => reject(tx.error);
  });
}


export async function saveIssuedCertificate(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CERTIFICATES, CERTIFICATE_EVENTS], 'readwrite');
    tx.objectStore(CERTIFICATES).add(record);
    tx.objectStore(CERTIFICATE_EVENTS).add({
      id: crypto.randomUUID(), certificateId: record.certificateId, type: 'ISSUED',
      at: record.issuedAt, unitId: record.unitId, year: record.year, contentHash: record.contentHash, pdfHash: record.pdfHash,
    });
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
      tx.objectStore(CERTIFICATE_EVENTS).add({
        id: crypto.randomUUID(), certificateId, type: 'REVOKED', at: revokedAt, reason: cleanReason,
        unitId: current.unitId, year: current.year,
      });
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve(updated);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => { if (!updated) return; };
  });
}

export async function replaceImportedData(bundle, summary) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([RESIDENTIAL, UNITS, PERIODS, IMPORT_META], 'readwrite');
    const residential = tx.objectStore(RESIDENTIAL);
    const units = tx.objectStore(UNITS);
    const periods = tx.objectStore(PERIODS);
    const meta = tx.objectStore(IMPORT_META);

    residential.clear(); units.clear(); periods.clear();
    residential.put(bundle.residential);
    for (const unit of bundle.units) units.put(unit);
    for (const period of bundle.periods) periods.put(period);
    meta.put({ ...summary, importedAt: new Date().toISOString(), source: bundle.source ?? null }, 'current');

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
