const VALID_KINDS = new Set(['monthly_contribution', 'extraordinary_fee', 'installment', 'other']);
const VALID_STATUSES = new Set(['open', 'partial', 'paid', 'cancelled']);

function asInt(value, label) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} deve ser inteiro`);
  return value;
}

export function obligationStatus({ amountCents, paidCents = 0, cancelled = false }) {
  asInt(amountCents, 'Valor');
  asInt(paidCents, 'Valor pago');
  if (amountCents < 0 || paidCents < 0) throw new RangeError('Valores não podem ser negativos');
  if (cancelled) return 'cancelled';
  if (paidCents === 0) return 'open';
  if (paidCents < amountCents) return 'partial';
  return 'paid';
}

export function normalizeObligation(input) {
  if (!input?.id) throw new TypeError('Obrigação sem id');
  if (!input?.unitId) throw new TypeError('Obrigação sem unidade');
  if (!VALID_KINDS.has(input.kind)) throw new TypeError('Tipo de obrigação inválido');
  asInt(input.amountCents, 'Valor');
  const paidCents = input.paidCents ?? 0;
  asInt(paidCents, 'Valor pago');
  const cancelled = input.status === 'cancelled' || input.cancelled === true;
  const status = obligationStatus({ amountCents: input.amountCents, paidCents, cancelled });
  return Object.freeze({
    ...input,
    paidCents,
    status,
    required: input.required !== false,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

export function outstandingCents(obligation) {
  const o = normalizeObligation(obligation);
  if (o.status === 'cancelled') return 0;
  return Math.max(0, o.amountCents - o.paidCents);
}

export function applyPayment(obligation, paymentCents, paidAt = new Date().toISOString()) {
  const current = normalizeObligation(obligation);
  asInt(paymentCents, 'Pagamento');
  if (paymentCents <= 0) throw new RangeError('Pagamento deve ser maior que zero');
  if (current.status === 'cancelled') throw new Error('OBRIGACAO_CANCELADA');
  const open = outstandingCents(current);
  if (open === 0) throw new Error('OBRIGACAO_JA_QUITADA');
  if (paymentCents > open) throw new Error('PAGAMENTO_SUPERIOR_AO_SALDO');
  return normalizeObligation({
    ...current,
    paidCents: current.paidCents + paymentCents,
    lastPaidAt: paidAt,
  });
}

export function splitAmount(totalCents, parts) {
  asInt(totalCents, 'Total');
  asInt(parts, 'Parcelas');
  if (totalCents <= 0 || parts <= 0) throw new RangeError('Total e parcelas devem ser maiores que zero');
  const base = Math.floor(totalCents / parts);
  let remainder = totalCents % parts;
  return Array.from({ length: parts }, () => base + (remainder-- > 0 ? 1 : 0));
}

function addMonths(dateString, count) {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + count, 1));
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function createInstallmentPlan({ planId, unitId, totalCents, installments, firstDueDate, description = 'Parcelamento' }) {
  if (!planId || !unitId || !firstDueDate) throw new TypeError('Dados do parcelamento incompletos');
  const values = splitAmount(totalCents, installments);
  return values.map((amountCents, index) => {
    const dueDate = addMonths(firstDueDate, index);
    const [year, month] = dueDate.split('-').map(Number);
    return normalizeObligation({
      id: `${planId}-${String(index + 1).padStart(2, '0')}`,
      planId,
      unitId,
      kind: 'installment',
      description: `${description} — parcela ${index + 1}/${installments}`,
      amountCents,
      paidCents: 0,
      dueDate,
      year,
      month,
      required: true,
    });
  });
}

export function createMonthlyObligations({ units, year, month, amountCents, dueDate, description = 'Contribuição mensal' }) {
  asInt(year, 'Ano'); asInt(month, 'Mês'); asInt(amountCents, 'Valor');
  if (!Array.isArray(units)) throw new TypeError('Unidades inválidas');
  return units.filter(u => u.active !== false).map(unit => normalizeObligation({
    id: `mensal-${year}-${String(month).padStart(2, '0')}-${unit.id}`,
    unitId: String(unit.id),
    kind: 'monthly_contribution',
    description,
    amountCents,
    paidCents: 0,
    dueDate,
    year,
    month,
    required: true,
  }));
}

export function ledgerSummary(obligations = []) {
  const normalized = obligations.map(normalizeObligation);
  const active = normalized.filter(o => o.status !== 'cancelled');
  const amountCents = active.reduce((sum, o) => sum + o.amountCents, 0);
  const paidCents = active.reduce((sum, o) => sum + Math.min(o.paidCents, o.amountCents), 0);
  const outstanding = active.reduce((sum, o) => sum + outstandingCents(o), 0);
  return Object.freeze({
    count: active.length,
    paidCount: active.filter(o => o.status === 'paid').length,
    pendingCount: active.filter(o => o.status !== 'paid').length,
    amountCents,
    paidCents,
    outstandingCents: outstanding,
  });
}

export function obligationsBlockingCertificate(obligations = [], year) {
  const cutoff = `${year}-12-31`;
  return obligations.map(normalizeObligation).filter(o => {
    if (!o.required || o.status === 'cancelled' || o.status === 'paid') return false;
    if (o.kind === 'installment') return true;
    if (o.dueDate) return o.dueDate <= cutoff;
    return Number(o.year) <= Number(year);
  });
}

export { VALID_KINDS, VALID_STATUSES };
