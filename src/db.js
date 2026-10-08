import { validateFinancialStores } from './snapshot-integrity.js';
import { createSnapshotEnvelope, validateSnapshot } from './backup.js';
import { applyPayment, normalizeObligation, paymentTimestampFromDate } from './obligations.js';
import { competenceFromIso, historicalClosingFromPeriod, summarizeCompetence, createClosingRecord, requiredExpenseStatus, previousCompetence } from './closing.js';

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
  const normalized = normalizeObligation(obligation);
  const db = await openDb();
  const competence = `${normalized.year}-${String(normalized.month).padStart(2, '0')}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction([OBLIGATIONS, MONTH_CLOSINGS], 'readwrite');
    const fail = error => { tx.abort(); reject(error); };
    const req = tx.objectStore(MONTH_CLOSINGS).get(competence);
    req.onsuccess = () => {
      if (req.result?.status === 'closed') return fail(new Error('COMPETENCIA_FECHADA'));
      const existing = tx.objectStore(OBLIGATIONS).get(normalized.id);
      existing.onsuccess = () => {
        const current = existing.result;
        if (current && (current.paidCents !== normalized.paidCents || current.unitId !== normalized.unitId || current.amountCents !== normalized.amountCents || (normalized.status === 'cancelled' && current.paidCents > 0))) {
          return fail(new Error('OBRIGACAO_ALTERADA_RECARREGUE'));
        }
        tx.objectStore(OBLIGATIONS).put(normalized);
      };
    };
    tx.oncomplete = () => resolve(normalized);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('GRAVACAO_ABORTADA'));
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


export async function syncHistoricalClosings(periods = [], cutoffCompetence) {
  if (!Array.isArray(periods)) throw new TypeError('PERIODOS_HISTORICOS_INVALIDOS');
  if (cutoffCompetence && !/^\d{4}-(0[1-9]|1[0-2])$/.test(cutoffCompetence)) throw new Error('COMPETENCIA_LIMITE_INVALIDA');

  const candidates = periods.filter(period =>
    period?.id && (!cutoffCompetence || String(period.id) < String(cutoffCompetence))
  );
  if (!candidates.length) return [];

  const existing = new Map((await listMonthClosings()).map(item => [String(item.competence ?? item.id), item]));
  const missing = candidates.filter(period => !existing.has(String(period.id)));
  if (!missing.length) return [];

  const importedAt = new Date().toISOString();
  const records = missing.map(period => historicalClosingFromPeriod(period, importedAt));
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([MONTH_CLOSINGS, CLOSING_EVENTS], 'readwrite');
    const closings = tx.objectStore(MONTH_CLOSINGS);
    const events = tx.objectStore(CLOSING_EVENTS);
    for (const record of records) {
      closings.put(record);
      events.add({
        id: crypto.randomUUID(),
        competence: record.competence,
        type: 'HISTORICAL_IMPORT',
        at: importedAt,
        sourceStatus: record.sourceStatus,
        closingBalanceCents: record.closingBalanceCents,
      });
    }
    tx.oncomplete = () => resolve(records);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('SINCRONIZACAO_HISTORICA_ABORTADA'));
  });
}

export async function saveObligations(obligations = []) {
  const normalized = obligations.map(normalizeObligation);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([OBLIGATIONS, MONTH_CLOSINGS], 'readwrite');
    const fail = error => { tx.abort(); reject(error); };
    for (const obligation of normalized) {
      const competence = `${obligation.year}-${String(obligation.month).padStart(2, '0')}`;
      const req = tx.objectStore(MONTH_CLOSINGS).get(competence);
      req.onsuccess = () => {
        if (req.result?.status === 'closed') return fail(new Error('COMPETENCIA_FECHADA'));
        // A batch creates obligations; it must never replace a paid or cancelled row.
        tx.objectStore(OBLIGATIONS).add(obligation);
      };
    }
    tx.oncomplete = () => resolve(normalized);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('GRAVACAO_ABORTADA'));
  });
}

export async function registerObligationPayment({ obligation, payment }) {
  if (!payment?.id || !payment.obligationId || payment.obligationId !== obligation?.id) throw new Error('PAGAMENTO_INVALIDO');
  paymentTimestampFromDate(String(payment.paidAt).slice(0, 10));
  const competence = competenceFromIso(payment.paidAt);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([OBLIGATIONS, PAYMENTS, MONTH_CLOSINGS], 'readwrite');
    let updated;
    const fail = error => { tx.abort(); reject(error); };
    const closing = tx.objectStore(MONTH_CLOSINGS).get(competence);
    closing.onsuccess = () => {
      if (closing.result?.status === 'closed') return fail(new Error('COMPETENCIA_FECHADA'));
      const req = tx.objectStore(OBLIGATIONS).get(payment.obligationId);
      req.onsuccess = () => {
        try {
          const current = req.result;
          if (!current || current.unitId !== payment.unitId) throw new Error('OBRIGACAO_INVALIDA');
          updated = applyPayment(current, payment.amountCents, payment.paidAt);
          if (updated.paidCents !== obligation.paidCents) throw new Error('SALDO_ALTERADO_RECARREGUE');
          tx.objectStore(OBLIGATIONS).put(updated);
          tx.objectStore(PAYMENTS).add(payment);
        } catch (error) { fail(error); }
      };
    };
    tx.oncomplete = () => resolve({ obligation: updated, payment });
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('PAGAMENTO_ABORTADO'));
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
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MONTH_CLOSINGS, CLOSING_EVENTS, PAYMENTS, TRANSACTIONS], 'readwrite');
    const values = {};
    let remaining = 3;
    let saved;
    const fail = error => { tx.abort(); reject(error); };
    for (const name of [MONTH_CLOSINGS, PAYMENTS, TRANSACTIONS]) {
      const req = tx.objectStore(name).getAll();
      req.onsuccess = () => {
        values[name] = req.result;
        if (--remaining) return;
        try {
          const current = values[MONTH_CLOSINGS].find(c => c.competence === record.competence);
          if (current?.status === 'closed') throw new Error('COMPETENCIA_FECHADA');
          const prior = values[MONTH_CLOSINGS].find(c => c.competence === previousCompetence(record.competence));
          if (prior?.status === 'reopened') throw new Error('COMPETENCIA_ANTERIOR_REABERTA');
          if (values[MONTH_CLOSINGS].some(c => c.competence > record.competence && c.status === 'closed')) throw new Error('REABRA_PRIMEIRO_OS_MESES_POSTERIORES');
          if (!requiredExpenseStatus(values[TRANSACTIONS], record.competence).complete) throw new Error('DESPESAS_OBRIGATORIAS_AUSENTES');
          const summary = summarizeCompetence({
            competence: record.competence,
            openingBalanceCents: prior?.status === 'closed' ? prior.closingBalanceCents : record.openingBalanceCents,
            payments: values[PAYMENTS], movements: values[TRANSACTIONS],
          });
          saved = createClosingRecord({ summary, previousRecord: current, closedAt: record.closedAt });
          for (const key of ['openingBalanceCents', 'revenueCents', 'expenseCents', 'closingBalanceCents']) {
            if (saved[key] !== record[key]) throw new Error('DADOS_ALTERADOS_RECARREGUE_FECHAMENTO');
          }
          tx.objectStore(MONTH_CLOSINGS).put(saved);
          tx.objectStore(CLOSING_EVENTS).add({id:crypto.randomUUID(),competence:saved.competence,type:'CLOSED',revision:saved.revision,at:saved.closedAt,closingBalanceCents:saved.closingBalanceCents});
        } catch (error) { fail(error); }
      };
    }
    tx.oncomplete = () => resolve(saved);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('FECHAMENTO_ABORTADO'));
  });
}

export async function reopenMonthClosing(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MONTH_CLOSINGS, CLOSING_EVENTS], 'readwrite');
    const req = tx.objectStore(MONTH_CLOSINGS).getAll();
    req.onsuccess = () => {
      try {
        const current = req.result.find(c => c.competence === record.competence);
        if (!current || current.status !== 'closed' || current.revision !== record.revision) throw new Error('FECHAMENTO_ALTERADO_RECARREGUE');
        if (current.source === 'historical_import') throw new Error('FECHAMENTO_HISTORICO_BLOQUEADO');
        if (req.result.some(c => c.competence > record.competence && c.status === 'closed')) throw new Error('REABRA_PRIMEIRO_OS_MESES_POSTERIORES');
        if (record.status !== 'reopened' || String(record.reopenReason ?? '').trim().length < 5) throw new Error('MOTIVO_REABERTURA_OBRIGATORIO');
        tx.objectStore(MONTH_CLOSINGS).put({...current, status:'reopened', reopenedAt:record.reopenedAt, reopenReason:record.reopenReason});
        tx.objectStore(CLOSING_EVENTS).add({id:crypto.randomUUID(),competence:record.competence,type:'REOPENED',revision:record.revision,at:record.reopenedAt,reason:record.reopenReason});
      } catch (error) { tx.abort(); reject(error); }
    };
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('REABERTURA_ABORTADA'));
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
  // One readonly transaction gives a coherent point-in-time backup across all stores.
  const stores = await new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORES, 'readonly');
    const result = {};
    for (const name of BACKUP_STORES) {
      const store = tx.objectStore(name);
      const values = store.getAll();
      const keys = store.getAllKeys();
      keys.onsuccess = () => {
        result[name] = values.result.map((value, i) => ({key: keys.result[i], value}))
          .filter(entry => !(name === SETTINGS && entry.key === 'securityCredential'));
      };
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('BACKUP_ABORTADO'));
  });
  return createSnapshotEnvelope(stores,{appVersion});
}

export async function restoreDatabaseSnapshot(snapshot) {
  validateSnapshot(snapshot);
  const missing = BACKUP_STORES.filter(name => !Array.isArray(snapshot.stores[name]));
  if (missing.length) throw new Error(`BACKUP_INCOMPLETO:${missing.join(',')}`);
  const unknown=Object.keys(snapshot.stores).filter(name=>!BACKUP_STORES.includes(name));
  if(unknown.length) throw new Error(`BACKUP_STORE_DESCONHECIDO:${unknown.join(',')}`);
  validateFinancialStores(snapshot.stores);
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
