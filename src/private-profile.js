function cleanText(value, label, required = true) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new Error(`${label}_OBRIGATORIO`);
  return text;
}

function normalizePhone(contact) {
  const value = cleanText(contact?.value, 'TELEFONE');
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new Error('TELEFONE_INVALIDO');
  return Object.freeze({
    type: 'phone',
    value: value.startsWith('+') ? `+${digits}` : digits,
    label: cleanText(contact?.label, 'ROTULO_TELEFONE', false) || 'Telefone',
    active: contact?.active !== false,
    purpose: cleanText(contact?.purpose, 'FINALIDADE_TELEFONE', false) || 'contact',
  });
}

export function normalizePrivateProfile(input) {
  if (!input || typeof input !== 'object') throw new Error('PERFIL_PRIVADO_INVALIDO');
  if (!input.residential || typeof input.residential !== 'object') throw new Error('RESIDENCIAL_AUSENTE');
  if (!Array.isArray(input.units) || input.units.length === 0) throw new Error('UNIDADES_AUSENTES');

  const residential = Object.freeze({
    id: cleanText(input.residential.id, 'ID_RESIDENCIAL'),
    name: cleanText(input.residential.name, 'NOME_RESIDENCIAL'),
    address: cleanText(input.residential.address, 'ENDERECO_RESIDENCIAL'),
  });

  const seen = new Set();
  const units = input.units.map(raw => {
    const id = cleanText(raw?.id, 'ID_UNIDADE');
    if (seen.has(id)) throw new Error('UNIDADE_DUPLICADA');
    seen.add(id);
    const contacts = Array.isArray(raw?.contacts)
      ? raw.contacts.filter(c => c?.type === 'phone').map(normalizePhone)
      : [];
    return Object.freeze({
      id,
      label: cleanText(raw?.label, 'ROTULO_UNIDADE', false) || `Apartamento ${id}`,
      responsibleName: cleanText(raw?.responsibleName, 'RESPONSAVEL_UNIDADE'),
      contacts,
      active: raw?.active !== false,
    });
  });

  return Object.freeze({
    schemaVersion: Number(input.schemaVersion) || 1,
    profileType: 'conta-certa-private-profile',
    residential,
    units: Object.freeze(units),
  });
}

export function privateProfileSummary(profile) {
  const normalized = normalizePrivateProfile(profile);
  return Object.freeze({
    residentialName: normalized.residential.name,
    unitCount: normalized.units.length,
    activeUnitCount: normalized.units.filter(u => u.active).length,
    phoneCount: normalized.units.reduce((sum, u) => sum + u.contacts.filter(c => c.active).length, 0),
  });
}
