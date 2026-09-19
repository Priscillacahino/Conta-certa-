export function evaluateAnnualCompliance({obligations, year}) {
  const due = obligations.filter(o => o.year === year && o.required !== false && o.status !== 'cancelled');
  const pending = due.filter(o => o.status !== 'paid');
  return { eligible: pending.length === 0, checked: due.length, pending };
}
export function certificatePayload({residential, unit, responsible, year, issuedAt, obligations}) {
  const check = evaluateAnnualCompliance({obligations, year});
  if (!check.eligible) throw new Error('DECLARACAO_BLOQUEADA_POR_PENDENCIA');
  return Object.freeze({version:1,residentialId:residential.id,residentialName:residential.name,address:residential.address,unitId:unit.id,unitLabel:unit.label,responsible:responsible.name,year,issuedAt,status:'VALID'});
}
