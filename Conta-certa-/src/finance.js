export const cents = v => { if(!Number.isSafeInteger(v)) throw new TypeError('Valor deve estar em centavos inteiros'); return v; };
export function monthlyResult(revenues, expenses){ return cents(revenues)-cents(expenses); }
export function closingBalance(opening, revenues, expenses){ return cents(opening)+monthlyResult(revenues,expenses); }
export function expectedRevenue(units, contribution){ if(!Number.isSafeInteger(units)||units<0) throw new TypeError('Unidades inválidas'); return units*cents(contribution); }
export function extraordinaryShare(deficit, units){ cents(deficit); if(!Number.isSafeInteger(units)||units<=0) throw new TypeError('Unidades inválidas'); return deficit<=0?0:Math.ceil(deficit/units); }
