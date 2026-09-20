export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

export function safeFileBase(value, fallback = 'arquivo') {
  const text = String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const clean = text.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  return clean || fallback;
}
