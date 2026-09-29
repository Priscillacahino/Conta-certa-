import { CERTIFICATE_MARK_JPEG } from './brand-data.js';

function safeText(value) {
  return String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/•/g, '-')
    .replace(/…/g, '...')
    .replace(/[\r\n]+/g, ' ');
}

function pdfEscape(value) {
  return safeText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function latin1Bytes(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function base64Binary(value) {
  if (typeof atob === 'function') return atob(value);
  return Buffer.from(value, 'base64').toString('latin1');
}

function drawText(content, x, y, size, value, font = 'F1', rgb = [0.08, 0.15, 0.25]) {
  const [r, g, b] = rgb;
  content.push(`${r} ${g} ${b} rg BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`);
}

function wrap(value, maxChars = 76) {
  const words = safeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function money(cents) {
  const value = (Number(cents) || 0) / 100;
  return `R$ ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function formatDate(value) {
  if (!value) return '-';
  const text = String(value).slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString('pt-BR');
}

function kindLabel(kind) {
  return ({
    monthly_contribution: 'Mensalidade',
    extraordinary_fee: 'Taxa extraordinária',
    installment: 'Parcelamento',
    other: 'Outra obrigação',
  })[kind] ?? safeText(kind || 'Obrigação');
}

function statusLabel(status) {
  return ({ paid: 'Quitada', partial: 'Parcial', open: 'Em aberto', cancelled: 'Cancelada' })[status] ?? safeText(status || '-');
}

function addWrapped(lines, value, { bold = false, size = 9, maxChars = 76 } = {}) {
  for (const part of wrap(value, maxChars)) lines.push({ text: part, bold, size });
}

function buildBodyLines(payload) {
  const lines = [];
  const obligations = [...(payload.obligations ?? [])].sort((a, b) => String(b.dueDate ?? '').localeCompare(String(a.dueDate ?? '')));
  const payments = [...(payload.payments ?? [])].sort((a, b) => String(b.paidAt ?? '').localeCompare(String(a.paidAt ?? '')));
  const closings = [...(payload.closings ?? [])].sort((a, b) => String(b.competence ?? '').localeCompare(String(a.competence ?? '')));
  const certificates = [...(payload.certificates ?? [])].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
  const latest = closings[0] ?? null;
  const outstanding = obligations.reduce((sum, item) => {
    if (item.status === 'cancelled') return sum;
    return sum + Math.max(0, (Number(item.amountCents) || 0) - (Number(item.paidCents) || 0));
  }, 0);

  lines.push({ text: 'RESUMO', bold: true, size: 11 });
  addWrapped(lines, `Unidade: ${payload.unit?.label ?? payload.unit?.id ?? '-'}`, { bold: true });
  if (payload.unit?.responsibleName) addWrapped(lines, `Responsável: ${payload.unit.responsibleName}`);
  addWrapped(lines, `Gerado em: ${new Date(payload.generatedAt || Date.now()).toLocaleString('pt-BR')}`);
  addWrapped(lines, `Saldo mais recente do residencial: ${latest ? money(latest.closingBalanceCents) : '-'}`);
  addWrapped(lines, `Pendência atual da unidade: ${money(outstanding)}`);
  lines.push({ text: '' });

  lines.push({ text: `OBRIGAÇÕES DA UNIDADE (${obligations.length})`, bold: true, size: 11 });
  if (!obligations.length) addWrapped(lines, 'Nenhuma obrigação disponibilizada para esta unidade.');
  obligations.forEach(item => {
    const remaining = Math.max(0, (Number(item.amountCents) || 0) - (Number(item.paidCents) || 0));
    addWrapped(
      lines,
      `${formatDate(item.dueDate)} - ${kindLabel(item.kind)} - ${item.description || 'Sem descrição'} - Valor ${money(item.amountCents)} - Pago ${money(item.paidCents)} - Saldo ${money(remaining)} - ${statusLabel(item.status)}`,
      { maxChars: 84 }
    );
  });
  lines.push({ text: '' });

  lines.push({ text: `PAGAMENTOS (${payments.length})`, bold: true, size: 11 });
  if (!payments.length) addWrapped(lines, 'Nenhum pagamento disponibilizado para esta unidade.');
  payments.forEach(item => {
    addWrapped(lines, `${formatDate(item.paidAt)} - ${item.description || 'Pagamento'} - ${money(item.amountCents)}`, { maxChars: 84 });
  });
  lines.push({ text: '' });

  lines.push({ text: `PRESTAÇÃO DE CONTAS (${closings.length} competência(s))`, bold: true, size: 11 });
  if (!closings.length) addWrapped(lines, 'Nenhuma competência fechada disponibilizada.');
  closings.forEach(item => {
    addWrapped(
      lines,
      `${item.competence || '-'} - Saldo inicial ${money(item.openingBalanceCents)} - Receitas ${money(item.revenueCents)} - Despesas ${money(item.expenseCents)} - Resultado ${money(item.resultCents)} - Saldo final ${money(item.closingBalanceCents)}`,
      { maxChars: 84 }
    );
  });
  lines.push({ text: '' });

  lines.push({ text: `DOCUMENTOS (${certificates.length})`, bold: true, size: 11 });
  if (!certificates.length) addWrapped(lines, 'Nenhuma declaração disponibilizada para esta unidade.');
  certificates.forEach(item => {
    addWrapped(lines, `${item.year || '-'} - ${item.certificateId || 'Declaração'} - ${item.status === 'VALID' ? 'Válida' : statusLabel(item.status)}`, { maxChars: 84 });
  });

  return lines;
}

function pageStream({ payload, lines, pageNumber, pageCount }) {
  const content = [];
  content.push('1 1 1 rg 0 0 595.28 841.89 re f');
  content.push('0.04 0.18 0.32 rg 0 795 595.28 46 re f');
  content.push('0.10 0.55 0.34 rg 0 790 595.28 5 re f');
  content.push('q 50 0 0 50 38 716 cm /Im1 Do Q');
  drawText(content, 100, 750, 18, payload.residential?.name || 'Residencial', 'F2', [0.04, 0.18, 0.32]);
  drawText(content, 101, 730, 10.5, 'Conta Certa - Consulta do morador', 'F2', [0.10, 0.55, 0.34]);
  drawText(content, 101, 714, 8.5, `${payload.unit?.label || 'Unidade'} - ${payload.unit?.responsibleName || ''}`, 'F1', [0.35, 0.43, 0.52]);
  drawText(content, 500, 748, 8, `Pág. ${pageNumber}/${pageCount}`, 'F1', [0.35, 0.43, 0.52]);
  content.push('0.82 0.87 0.91 RG 0.6 w 38 692 m 557 692 l S');

  let y = 670;
  for (const line of lines) {
    if (!line.text) {
      y -= 8;
      continue;
    }
    drawText(content, 42, y, line.size || 9, line.text, line.bold ? 'F2' : 'F1', line.bold ? [0.04, 0.18, 0.32] : [0.08, 0.15, 0.25]);
    y -= line.bold ? 17 : 14;
  }

  content.push('0.82 0.87 0.91 RG 0.5 w 38 48 m 557 48 l S');
  drawText(content, 38, 34, 7.2, 'Documento de consulta gerado pelo Conta Certa. Este PDF não concede acesso ao aplicativo.', 'F1', [0.35, 0.43, 0.52]);
  return `${content.join('\n')}\n`;
}

export function buildResidentPdf(payload) {
  if (!payload?.unit?.id || !payload?.residential?.name) throw new Error('DADOS_MORADOR_INVALIDOS');
  const body = buildBodyLines(payload);
  const pages = [];
  const MAX_LINES = 38;
  for (let i = 0; i < body.length; i += MAX_LINES) pages.push(body.slice(i, i + MAX_LINES));
  if (!pages.length) pages.push([]);

  const streams = pages.map((lines, index) => pageStream({ payload, lines, pageNumber: index + 1, pageCount: pages.length }));
  const imageBinary = base64Binary(CERTIFICATE_MARK_JPEG.base64);
  const objects = [];
  const pageIds = [];
  const streamIds = [];
  const pageCount = streams.length;
  const font1 = 3 + pageCount * 2;
  const font2 = font1 + 1;
  const imageId = font2 + 1;

  for (let i = 0; i < pageCount; i += 1) {
    pageIds.push(3 + i * 2);
    streamIds.push(4 + i * 2);
  }

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`;
  streams.forEach((stream, i) => {
    objects[pageIds[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${streamIds[i]} 0 R >>`;
    objects[streamIds[i]] = `<< /Length ${latin1Bytes(stream).length} >>\nstream\n${stream}endstream`;
  });
  objects[font1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[font2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objects[imageId] = `<< /Type /XObject /Subtype /Image /Width ${CERTIFICATE_MARK_JPEG.width} /Height ${CERTIFICATE_MARK_JPEG.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBinary.length} >>\nstream\n${imageBinary}\nendstream`;

  let pdf = '%PDF-1.4\n%âãÏÓ\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = latin1Bytes(pdf).length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = latin1Bytes(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return latin1Bytes(pdf);
}
