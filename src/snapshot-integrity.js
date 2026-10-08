import { normalizeObligation, paymentTimestampFromDate } from './obligations.js';
import { normalizeMovement, summarizeCompetence } from './closing.js';

export function validateFinancialStores(stores) {
  for (const [name, entries] of Object.entries(stores)) {
    const seen = new Set();
    for (const entry of entries) {
      if (!entry || !Object.hasOwn(entry, 'key') || !Object.hasOwn(entry, 'value')) throw new Error('BACKUP_REGISTRO_INVALIDO');
      if (!['string', 'number'].includes(typeof entry.key) || seen.has(String(entry.key))) throw new Error('BACKUP_CHAVE_DUPLICADA_OU_INVALIDA');
      seen.add(String(entry.key));
      if (!['settings', 'importMeta'].includes(name)) {
        const id = name === 'certificates' ? 'certificateId' : 'id';
        if (!entry.value || String(entry.value[id] ?? '') !== String(entry.key)) throw new Error('BACKUP_ID_DIVERGENTE');
      }
    }
  }
  const rows = name => (stores[name] ?? []).map(entry => entry.value);
  const obligations = new Map(rows('obligations').map(item => [item.id, normalizeObligation(item)]));
  const received = new Map();
  for (const p of rows('payments')) {
    const o = obligations.get(p.obligationId);
    if (!o || String(o.unitId) !== String(p.unitId)) throw new Error('BACKUP_PAGAMENTO_SEM_OBRIGACAO');
    if (!Number.isSafeInteger(p.amountCents) || p.amountCents <= 0) throw new Error('BACKUP_PAGAMENTO_INVALIDO');
    paymentTimestampFromDate(String(p.paidAt).slice(0,10));
    received.set(p.obligationId, (received.get(p.obligationId) ?? 0) + p.amountCents);
  }
  for (const o of obligations.values()) {
    if ((received.get(o.id) ?? 0) !== o.paidCents) throw new Error('BACKUP_TOTAL_PAGAMENTOS_DIVERGENTE');
  }
  const movements = rows('transactions').map(normalizeMovement);
  for (const c of rows('monthClosings')) {
    for (const key of ['openingBalanceCents','revenueCents','expenseCents','resultCents','closingBalanceCents']) {
      if (!Number.isSafeInteger(c[key])) throw new Error('BACKUP_FECHAMENTO_INVALIDO');
    }
    if (c.openingBalanceCents + c.resultCents !== c.closingBalanceCents) throw new Error('BACKUP_SALDO_DIVERGENTE');
    if (c.status === 'closed' && c.source !== 'historical_import') {
      const summary = summarizeCompetence({competence:c.competence,openingBalanceCents:c.openingBalanceCents,payments:rows('payments'),movements});
      for (const key of ['revenueCents','expenseCents','resultCents','closingBalanceCents']) {
        if (summary[key] !== c[key]) throw new Error('BACKUP_FECHAMENTO_DIVERGENTE');
      }
    }
  }
}
