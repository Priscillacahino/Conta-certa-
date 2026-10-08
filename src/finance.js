export const cents = v => { if(!Number.isSafeInteger(v)) throw new TypeError('Valor deve estar em centavos inteiros'); return v; };
export function monthlyResult(revenues, expenses){ return cents(cents(revenues)-cents(expenses)); }
export function closingBalance(opening, revenues, expenses){ return cents(cents(opening)+monthlyResult(revenues,expenses)); }
export function expectedRevenue(units, contribution){ if(!Number.isSafeInteger(units)||units<0) throw new TypeError('Unidades inválidas'); return cents(units*cents(contribution)); }
export function extraordinaryShare(deficit, units){ cents(deficit); if(!Number.isSafeInteger(units)||units<=0) throw new TypeError('Unidades inválidas'); return deficit<=0?0:Math.ceil(deficit/units); }

// Accept decimal input and Brazilian grouped currency without floating-point rounding.
export function parseMoneyCents(value) {
  let text = String(value ?? '').trim().replace(/^R\$\s*/, '');
  if (!text) return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text)) text = text.replace(/\./g, '');
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(text)) throw new Error('VALOR_INVALIDO_USE_REAIS_E_CENTAVOS');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^-/, '').replace(',', '.').split('.');
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  const result = Number(negative ? -amount : amount);
  return cents(result);
}
