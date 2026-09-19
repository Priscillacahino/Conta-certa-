const asInt = (value, label) => {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} deve ser inteiro`);
  return value;
};

export function validateImportBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') throw new TypeError('Arquivo de importação inválido');
  if (!Array.isArray(bundle.periods)) throw new TypeError('Importação sem períodos');
  if (!Array.isArray(bundle.units)) throw new TypeError('Importação sem unidades');
  if (!bundle.residential || typeof bundle.residential !== 'object') throw new TypeError('Importação sem residencial');

  for (const period of bundle.periods) {
    if (!/^\d{4}-\d{2}$/.test(period.id ?? '')) throw new TypeError(`Competência inválida: ${period.id ?? ''}`);
    asInt(period.year, 'Ano');
    asInt(period.month, 'Mês');
    if (!period.calculated) throw new TypeError(`Período ${period.id} sem cálculos`);
    asInt(period.calculated.revenueCents, 'Receitas');
    asInt(period.calculated.expenseCents, 'Despesas');
    asInt(period.calculated.closingBalanceCents, 'Saldo final');
  }

  return true;
}

export function latestPeriod(periods = []) {
  return [...periods].sort((a, b) => a.id.localeCompare(b.id)).at(-1) ?? null;
}

export function summarizeImport(bundle) {
  validateImportBundle(bundle);
  const review = bundle.periods.filter(p => p.reconciliation?.status !== 'ok');
  const latest = latestPeriod(bundle.periods);
  return Object.freeze({
    periodCount: bundle.periods.length,
    reconciledCount: bundle.periods.length - review.length,
    reviewCount: review.length,
    latestPeriodId: latest?.id ?? null,
    latestBalanceCents: latest?.calculated?.closingBalanceCents ?? 0,
    startPeriodId: [...bundle.periods].sort((a, b) => a.id.localeCompare(b.id))[0]?.id ?? null,
  });
}

export function summarizeByYear(periods = []) {
  const map = new Map();
  for (const p of periods) {
    const current = map.get(p.year) ?? { year: p.year, months: 0, revenuesCents: 0, expensesCents: 0, reconciled: 0, review: 0, closingBalanceCents: 0 };
    current.months += 1;
    current.revenuesCents += p.calculated?.revenueCents ?? 0;
    current.expensesCents += p.calculated?.expenseCents ?? 0;
    current.closingBalanceCents = p.calculated?.closingBalanceCents ?? current.closingBalanceCents;
    if (p.reconciliation?.status === 'ok') current.reconciled += 1;
    else current.review += 1;
    map.set(p.year, current);
  }
  return [...map.values()].sort((a, b) => b.year - a.year);
}

export function annualPaymentEvidence({ periods, year, unitId }) {
  const months = new Map();
  for (const p of periods.filter(p => p.year === year)) {
    const contribution = (p.revenues ?? []).find(r => r.type === 'contribution' && String(r.unitId) === String(unitId));
    months.set(p.month, {
      month: p.month,
      imported: true,
      hasContributionEntry: Boolean(contribution && contribution.amountCents > 0),
      amountCents: contribution?.amountCents ?? 0,
      sourceStatus: p.reconciliation?.status ?? 'review',
    });
  }
  return [...months.values()].sort((a, b) => a.month - b.month);
}

export function importedYearCertificateStatus({ periods, year, unitId }) {
  const evidence = annualPaymentEvidence({ periods, year, unitId });
  const missingMonths = [];
  const reviewMonths = [];
  for (let month = 1; month <= 12; month += 1) {
    const item = evidence.find(x => x.month === month);
    if (!item || !item.hasContributionEntry) missingMonths.push(month);
    if (item && item.sourceStatus !== 'ok') reviewMonths.push(month);
  }
  const completeYear = evidence.length === 12;
  return Object.freeze({
    eligible: completeYear && missingMonths.length === 0 && reviewMonths.length === 0,
    completeYear,
    missingMonths,
    reviewMonths,
    evidence,
    reason: !completeYear ? 'ANO_INCOMPLETO' : missingMonths.length ? 'PAGAMENTO_NAO_COMPROVADO' : reviewMonths.length ? 'IMPORTACAO_REQUER_REVISAO' : 'OK',
  });
}
