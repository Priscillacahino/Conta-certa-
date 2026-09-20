import { cents, extraordinaryShare } from './finance.js';

function validateUnits(units) {
  if (!Number.isSafeInteger(units) || units <= 0) throw new TypeError('Unidades inválidas');
  return units;
}

function exactSplit(totalCents, parts) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new TypeError('Total inválido');
  validateUnits(parts);
  const base=Math.floor(totalCents/parts);
  let remainder=totalCents%parts;
  return Array.from({length:parts},()=>base+(remainder-- > 0 ? 1 : 0));
}

export function evaluateQuote({
  cashBalanceCents,
  quoteCents,
  protectedReserveCents = 0,
  committedCents = 0,
  contingencyBasisPoints = 0,
  activeUnits = 1,
}) {
  const cash = cents(cashBalanceCents);
  const quote = cents(quoteCents);
  const reserve = cents(protectedReserveCents);
  const committed = cents(committedCents);
  validateUnits(activeUnits);
  if (!Number.isSafeInteger(contingencyBasisPoints) || contingencyBasisPoints < 0 || contingencyBasisPoints > 5000) throw new RangeError('Contingência inválida');
  if (cash < 0 || quote < 0 || reserve < 0 || committed < 0) throw new RangeError('Valores de projeção não podem ser negativos');

  const contingencyCents = Math.floor((quote * contingencyBasisPoints + 9999) / 10000);
  const plannedQuoteCents = quote + contingencyCents;
  const availableForProjectCents = Math.max(cash - reserve - committed, 0);
  const gapCents = Math.max(plannedQuoteCents - availableForProjectCents, 0);
  const projectedBalanceAfterPaymentCents = cash - plannedQuoteCents;
  const reserveAfterPaymentCents = Math.max(projectedBalanceAfterPaymentCents - committed, 0);
  const reserveBreachCents = Math.max(reserve - reserveAfterPaymentCents, 0);
  const coverageBasisPoints = plannedQuoteCents === 0 ? 10000 : Math.min(10000, Math.floor((availableForProjectCents * 10000) / plannedQuoteCents));
  const split = exactSplit(gapCents, activeUnits);

  return Object.freeze({
    cashBalanceCents: cash,
    protectedReserveCents: reserve,
    committedCents: committed,
    availableForProjectCents,
    quoteCents: quote,
    contingencyBasisPoints,
    contingencyCents,
    plannedQuoteCents,
    gapCents,
    hasEnoughCash: gapCents === 0,
    canHireWithoutTouchingReserve: gapCents === 0 && reserveBreachCents === 0,
    projectedBalanceAfterPaymentCents,
    reserveAfterPaymentCents,
    reserveBreachCents,
    coverageBasisPoints,
    suggestedExtraPerUnitCents: gapCents === 0 ? 0 : extraordinaryShare(gapCents, activeUnits),
    suggestedSplitCents: Object.freeze(split),
    suggestedSplitTotalCents: split.reduce((s,v)=>s+v,0),
  });
}

export function evaluateProject({
  name,
  cashBalanceCents,
  protectedReserveCents = 0,
  committedCents = 0,
  contingencyBasisPoints = 0,
  activeUnits,
  quotes,
}) {
  validateUnits(activeUnits);
  if (!Array.isArray(quotes) || quotes.length === 0) throw new TypeError('Informe pelo menos um orçamento');

  const evaluatedQuotes = quotes.map((quote, index) => {
    if (!quote || !Number.isSafeInteger(quote.amountCents)) throw new TypeError(`Orçamento inválido na posição ${index}`);
    return Object.freeze({
      id: quote.id ?? `quote-${index + 1}`,
      supplier: quote.supplier ?? `Orçamento ${index + 1}`,
      notes: quote.notes ?? '',
      ...evaluateQuote({cashBalanceCents,quoteCents:quote.amountCents,protectedReserveCents,committedCents,contingencyBasisPoints,activeUnits}),
    });
  });

  const plannedValues=evaluatedQuotes.map(q=>q.plannedQuoteCents);
  return Object.freeze({
    name: name ?? 'Projeto sem nome',
    cashBalanceCents,
    protectedReserveCents,
    committedCents,
    contingencyBasisPoints,
    activeUnits,
    quotes: Object.freeze(evaluatedQuotes),
    comparison: Object.freeze({
      lowestPlannedCents: Math.min(...plannedValues),
      highestPlannedCents: Math.max(...plannedValues),
      spreadCents: Math.max(...plannedValues)-Math.min(...plannedValues),
    }),
  });
}

export { exactSplit };
