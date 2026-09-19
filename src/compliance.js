export function evaluateAnnualCompliance({ obligations, year, requireTwelveMonths = true }) {
  const due = obligations.filter(o => o.year === year && o.required !== false && o.status !== 'cancelled');
  const pending = due.filter(o => o.status !== 'paid');
  const coveredMonths = new Set(due.filter(o => o.kind === 'monthly_contribution').map(o => o.month));
  const completeYear = !requireTwelveMonths || coveredMonths.size === 12;
  return { eligible: completeYear && pending.length === 0, checked: due.length, pending, completeYear, coveredMonths: [...coveredMonths].sort((a,b)=>a-b) };
}

export function certificatePayload({ residential, unit, responsible, year, issuedAt, obligations, sourceReviewRequired = false }) {
  if (sourceReviewRequired) throw new Error('DECLARACAO_BLOQUEADA_POR_DADOS_NAO_CONCILIADOS');
  const check = evaluateAnnualCompliance({ obligations, year });
  if (!check.completeYear) throw new Error('DECLARACAO_BLOQUEADA_ANO_INCOMPLETO');
  if (!check.eligible) throw new Error('DECLARACAO_BLOQUEADA_POR_PENDENCIA');
  return Object.freeze({
    version: 1,
    residentialId: residential.id,
    residentialName: residential.name,
    address: residential.address,
    unitId: unit.id,
    unitLabel: unit.label,
    responsible: responsible.name,
    year,
    issuedAt,
    status: 'VALID',
  });
}

export function lastWeekdayOfYear(year, holidays = []) {
  const blocked = new Set(holidays);
  const date = new Date(Date.UTC(year, 11, 31));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6 || blocked.has(date.toISOString().slice(0, 10))) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date.toISOString().slice(0, 10);
}
