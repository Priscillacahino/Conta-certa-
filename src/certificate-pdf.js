import { qrMatrix, qrPayload } from './qr.js';
import { CERTIFICATE_MARK_JPEG } from './brand-data.js';

function pdfEscape(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n]+/g, ' ');
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

function text(content, x, y, size, value, font = 'F1', rgb = [0.08, 0.15, 0.25]) {
  const [r, g, b] = rgb;
  content.push(`${r} ${g} ${b} rg BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`);
}

function lineRule(content, x1, y1, x2, y2, width = 0.7, rgb = [0.12, 0.56, 0.34]) {
  const [r, g, b] = rgb;
  content.push(`${r} ${g} ${b} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
}

function wrap(value, maxChars) {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

function drawQr(content, certificate) {
  const qrText = qrPayload(certificate);
  const matrix = qrMatrix(qrText);
  const module = 2.6;
  const quiet = 4;
  const qrX = 407;
  const qrY = 96;
  const qrSide = (matrix.length + quiet * 2) * module;

  content.push(`1 1 1 rg ${qrX} ${qrY} ${qrSide.toFixed(2)} ${qrSide.toFixed(2)} re f`);
  content.push('0.03 0.12 0.22 rg');
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = 0; c < matrix.length; c += 1) {
      if (!matrix[r][c]) continue;
      const x = qrX + (c + quiet) * module;
      const yRect = qrY + (matrix.length + quiet - 1 - r) * module;
      content.push(`${x.toFixed(2)} ${yRect.toFixed(2)} ${module.toFixed(2)} ${module.toFixed(2)} re f`);
    }
  }
  content.push(`0.75 0.82 0.88 RG 0.5 w ${qrX} ${qrY} ${qrSide.toFixed(2)} ${qrSide.toFixed(2)} re S`);
  return { qrX, qrY, qrSide };
}

export function buildCertificatePdf(certificate) {
  const pageW = 595.28;
  const pageH = 841.89;
  const content = [];

  // Fundo e moldura
  content.push('1 1 1 rg 0 0 595.28 841.89 re f');
  content.push('0.82 0.89 0.93 RG 0.8 w 18 18 559.28 805.89 re S');
  content.push('0.04 0.18 0.32 rg 18 782 559.28 41 re f');
  content.push('0.10 0.55 0.34 rg 18 777 559.28 5 re f');

  // Marca do aplicativo
  content.push('q 66 0 0 66 42 694 cm /Im1 Do Q');

  // Hierarquia pedida: Residencial em destaque, Conta Certa como subtítulo
  text(content, 126, 742, 25, certificate.residentialName, 'F2', [0.04, 0.18, 0.32]);
  text(content, 127, 717, 12, 'Conta Certa', 'F2', [0.10, 0.55, 0.34]);
  text(content, 127, 701, 8.5, 'Gestão financeira compartilhada', 'F1', [0.35, 0.43, 0.52]);
  lineRule(content, 42, 677, 553, 677, 1.2, [0.10, 0.55, 0.34]);

  text(content, 42, 642, 18, 'DECLARAÇÃO DE ADIMPLÊNCIA', 'F2', [0.04, 0.18, 0.32]);

  let y = 611;
  const paragraph = `Declaramos, para os devidos fins, que a unidade ${certificate.unitLabel}, do ${certificate.residentialName}, encontra-se adimplente com as obrigações financeiras exigíveis registradas no Conta Certa referentes ao exercício de ${certificate.year}, não constando mensalidade, taxa extraordinária, parcelamento ou outra obrigação impeditiva em aberto na data de emissão.`;
  for (const item of wrap(paragraph, 84)) {
    text(content, 42, y, 10.5, item, 'F1', [0.08, 0.15, 0.25]);
    y -= 16;
  }

  // Quadro de dados
  const panelTop = y - 8;
  const panelH = 158;
  content.push(`0.96 0.98 0.98 rg 36 ${panelTop - panelH + 14} 523 ${panelH} re f`);
  content.push(`0.83 0.88 0.91 RG 0.6 w 36 ${panelTop - panelH + 14} 523 ${panelH} re S`);

  let rowY = panelTop - 18;
  const labelX = 52;
  const valueX = 178;
  const rows = [
    ['Unidade:', certificate.unitLabel],
    ['Exercício:', String(certificate.year)],
    ['Data de emissão:', certificate.issuedAtDisplay],
    ['ID da declaração:', certificate.certificateId],
    ['Situação:', 'Adimplente'],
  ];
  for (const [label, value] of rows) {
    text(content, labelX, rowY, 9.5, label, 'F2', [0.04, 0.18, 0.32]);
    text(content, valueX, rowY, 9.5, value, value === 'Adimplente' ? 'F2' : 'F1', value === 'Adimplente' ? [0.10, 0.55, 0.34] : [0.08, 0.15, 0.25]);
    rowY -= 23;
  }

  text(content, labelX, rowY, 9.5, 'Endereço:', 'F2', [0.04, 0.18, 0.32]);
  const addressText = `${certificate.address}, ${certificate.unitLabel}`;
  let addrY = rowY;
  for (const item of wrap(addressText, 58)) {
    text(content, valueX, addrY, 9.2, item, 'F1', [0.08, 0.15, 0.25]);
    addrY -= 13;
  }

  const footerY = panelTop - panelH - 18;
  text(content, 42, footerY, 8.6, `Código de validação: ${certificate.verificationCode}`, 'F2', [0.04, 0.18, 0.32]);
  text(content, 42, footerY - 15, 7.8, `Hash do conteúdo: ${certificate.contentHash}`, 'F1', [0.35, 0.43, 0.52]);

  const qr = drawQr(content, certificate);
  text(content, 407, 82, 7.8, 'Valide pelo QR Code', 'F2', [0.04, 0.18, 0.32]);
  text(content, 407, 70, 7.1, 'e pelo registro preservado', 'F1', [0.35, 0.43, 0.52]);
  text(content, 407, 60, 7.1, 'no Conta Certa.', 'F1', [0.35, 0.43, 0.52]);

  // aviso de integridade
  lineRule(content, 42, 123, 362, 123, 0.8, [0.10, 0.55, 0.34]);
  text(content, 42, 109, 7.7, 'Documento emitido eletronicamente. Não deve ser editado.', 'F2', [0.04, 0.18, 0.32]);
  for (const item of wrap('Correções exigem revogação do registro anterior e nova emissão. Qualquer alteração nos bytes do PDF modifica o SHA-256 e é detectável na conferência.', 66)) {
    text(content, 42, 97 - (wrap('Correções exigem revogação do registro anterior e nova emissão. Qualquer alteração nos bytes do PDF modifica o SHA-256 e é detectável na conferência.', 66).indexOf(item) * 11), 7.1, item, 'F1', [0.35, 0.43, 0.52]);
  }
  text(content, 42, 46, 7, `Versão do documento: ${certificate.documentVersion}`, 'F1', [0.35, 0.43, 0.52]);
  text(content, 198, 46, 7, 'Conta Certa - gestão compartilhada, contas transparentes.', 'F1', [0.35, 0.43, 0.52]);

  const stream = `${content.join('\n')}\n`;
  const imageBinary = base64Binary(CERTIFICATE_MARK_JPEG.base64);

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Im1 7 0 R >> >> /Contents 4 0 R >>`;
  objects[4] = `<< /Length ${latin1Bytes(stream).length} >>\nstream\n${stream}endstream`;
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objects[7] = `<< /Type /XObject /Subtype /Image /Width ${CERTIFICATE_MARK_JPEG.width} /Height ${CERTIFICATE_MARK_JPEG.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBinary.length} >>\nstream\n${imageBinary}\nendstream`;

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
