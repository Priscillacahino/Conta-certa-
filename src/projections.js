import { cents, extraordinaryShare } from './finance.js';

function validateUnits(units) {
  if (!Number.isSafeInteger(units) || units <= 0) {
    throw new TypeError('Unidades inválidas');
  }
  return units;
}

export function evaluateQuote({
  cashBalanceCents,
  quoteCents,
  protectedReserveCents = 0,
  activeUnits = 1,
}) {
  const cash = cents(cashBalanceCents);
  const quote = cents(quoteCents);
  const reserve = cents(protectedReserveCents);
  validateUnits(activeUnits);

  if (cash < 0 || quote < 0 || reserve < 0) {
    throw new RangeError('Valores de projeção não podem ser negativos');
  }

  const availableForProjectCents = Math.max(cash - reserve, 0);
  const gapCents = Math.max(quote - availableForProjectCents, 0);
  const projectedBalanceAfterPaymentCents = cash - quote;
  const coverageBasisPoints = quote === 0
    ? 10000
    : Math.min(10000, Math.floor((availableForProjectCents * 10000) / quote));

  return Object.freeze({
    cashBalanceCents: cash,
    protectedReserveCents: reserve,
    availableForProjectCents,
    quoteCents: quote,
    gapCents,
    hasEnoughCash: gapCents === 0,
    projectedBalanceAfterPaymentCents,
    coverageBasisPoints,
    suggestedExtraPerUnitCents: gapCents === 0
      ? 0
      : extraordinaryShare(gapCents, activeUnits),
  });
}

export function evaluateProject({
  name,
  cashBalanceCents,
  protectedReserveCents = 0,
  activeUnits,
  quotes,
}) {
  validateUnits(activeUnits);
  if (!Array.isArray(quotes) || quotes.length === 0) {
    throw new TypeError('Informe pelo menos um orçamento');
  }

  const evaluatedQuotes = quotes.map((quote, index) => {
    if (!quote || !Number.isSafeInteger(quote.amountCents)) {
      throw new TypeError(`Orçamento inválido na posição ${index}`);
    }

    return Object.freeze({
      id: quote.id ?? `quote-${index + 1}`,
      supplier: quote.supplier ?? `Orçamento ${index + 1}`,
      notes: quote.notes ?? '',
      ...evaluateQuote({
        cashBalanceCents,
        quoteCents: quote.amountCents,
        protectedReserveCents,
        activeUnits,
      }),
    });
  });

  return Object.freeze({
    name: name ?? 'Projeto sem nome',
    cashBalanceCents,
    protectedReserveCents,
    activeUnits,
    quotes: Object.freeze(evaluatedQuotes),
  });
}
