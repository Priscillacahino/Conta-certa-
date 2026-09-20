function asInt(value, label) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} deve ser inteiro`);
  return value;
}

export function validateCompetence(value) {
  const text = String(value ?? '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) throw new Error('COMPETENCIA_INVALIDA');
  return text;
}

export function competenceFromIso(value) {
  const text = String(value ?? '');
  const match = text.match(/^(\d{4}-(?:0[1-9]|1[0-2]))/);
  return match ? match[1] : null;
}

export function previousCompetence(value) {
  const competence = validateCompetence(value);
  const [year, month] = competence.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function normalizeMovement(input) {
  if (!input?.id) throw new Error('MOVIMENTO_SEM_ID');
  const competence = validateCompetence(input.competence);
  if (!['income', 'expense'].includes(input.kind)) throw new Error('TIPO_MOVIMENTO_INVALIDO');
  asInt(input.amountCents, 'Valor');
  if (input.amountCents <= 0) throw new Error('VALOR_MOVIMENTO_INVALIDO');
  if (!String(input.description ?? '').trim()) throw new Error('DESCRICAO_MOVIMENTO_OBRIGATORIA');
  const date = String(input.date ?? `${competence}-01`);
  if (competenceFromIso(date) !== competence) throw new Error('DATA_FORA_DA_COMPETENCIA');
  return Object.freeze({
    ...input,
    competence,
    date,
    kind: input.kind,
    description: String(input.description).trim(),
    category: String(input.category ?? '').trim() || (input.kind === 'income' ? 'Receita' : 'Despesa'),
    amountCents: input.amountCents,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

export function summarizeCompetence({ competence, openingBalanceCents, payments = [], movements = [] }) {
  const key = validateCompetence(competence);
  asInt(openingBalanceCents, 'Saldo inicial');
  const paymentRows = payments.filter(p => competenceFromIso(p.paidAt) === key).map(p => ({
    id: `payment:${p.id}`,
    source: 'payment',
    date: p.paidAt,
    description: p.description || `Pagamento - unidade ${p.unitId}`,
    amountCents: asInt(p.amountCents, 'Pagamento'),
  }));
  const normalized = movements.map(normalizeMovement).filter(m => m.competence === key);
  const manualIncome = normalized.filter(m => m.kind === 'income');
  const expenses = normalized.filter(m => m.kind === 'expense');
  const paymentIncomeCents = paymentRows.reduce((s, r) => s + r.amountCents, 0);
  const manualIncomeCents = manualIncome.reduce((s, r) => s + r.amountCents, 0);
  const revenueCents = paymentIncomeCents + manualIncomeCents;
  const expenseCents = expenses.reduce((s, r) => s + r.amountCents, 0);
  const resultCents = revenueCents - expenseCents;
  const closingBalanceCents = openingBalanceCents + resultCents;
  return Object.freeze({
    competence: key,
    openingBalanceCents,
    revenueCents,
    paymentIncomeCents,
    manualIncomeCents,
    expenseCents,
    resultCents,
    closingBalanceCents,
    paymentRows: Object.freeze(paymentRows),
    incomeMovements: Object.freeze(manualIncome),
    expenseMovements: Object.freeze(expenses),
  });
}

export function createClosingRecord({ summary, closedAt = new Date().toISOString(), previousRecord = null }) {
  if (!summary?.competence) throw new Error('RESUMO_FECHAMENTO_INVALIDO');
  const revision = Math.max(1, Number(previousRecord?.revision ?? 0) + 1);
  return Object.freeze({
    id: summary.competence,
    competence: summary.competence,
    status: 'closed',
    revision,
    closedAt,
    reopenedAt: null,
    reopenReason: null,
    openingBalanceCents: summary.openingBalanceCents,
    revenueCents: summary.revenueCents,
    paymentIncomeCents: summary.paymentIncomeCents,
    manualIncomeCents: summary.manualIncomeCents,
    expenseCents: summary.expenseCents,
    resultCents: summary.resultCents,
    closingBalanceCents: summary.closingBalanceCents,
    paymentIds: summary.paymentRows.map(r => String(r.id).replace(/^payment:/, '')),
    movementIds: [...summary.incomeMovements, ...summary.expenseMovements].map(m => m.id),
  });
}

export function reopenClosingRecord(record, reason, reopenedAt = new Date().toISOString()) {
  if (!record || record.status !== 'closed') throw new Error('COMPETENCIA_NAO_FECHADA');
  const cleanReason = String(reason ?? '').trim();
  if (cleanReason.length < 5) throw new Error('MOTIVO_REABERTURA_OBRIGATORIO');
  return Object.freeze({ ...record, status: 'reopened', reopenedAt, reopenReason: cleanReason });
}

export function isCompetenceLocked(record) {
  return Boolean(record && record.status === 'closed');
}
