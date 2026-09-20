import { CERTIFICATE_MARK_JPEG } from './brand-data.js';

function pdfEscape(text) {
  return String(text ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ');
}
function latin1Bytes(text) { const out = new Uint8Array(text.length); for (let i=0;i<text.length;i+=1) out[i]=text.charCodeAt(i)&0xff; return out; }
function base64Binary(value) { if (typeof atob === 'function') return atob(value); return Buffer.from(value, 'base64').toString('latin1'); }
function text(content,x,y,size,value,font='F1',rgb=[0.08,0.15,0.25]) { const [r,g,b]=rgb; content.push(`${r} ${g} ${b} rg BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`); }
function money(cents) { const n=(cents??0)/100; return `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`; }
function competenceLabel(value) { const [y,m]=String(value).split('-'); const names=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']; return `${names[Number(m)-1] ?? m}/${y}`; }
function fmtDate(value) { const d=new Date(value); return Number.isNaN(d.getTime()) ? String(value??'') : d.toLocaleDateString('pt-BR'); }
function wrap(value,max=70) { const words=String(value??'').split(/\s+/).filter(Boolean); const out=[]; let line=''; for(const w of words){const n=line?`${line} ${w}`:w;if(n.length>max&&line){out.push(line);line=w;}else line=n;} if(line)out.push(line); return out; }

function row(content, y, date, description, amount, kind) {
  text(content, 48, y, 8.2, fmtDate(date), 'F1', [0.32,0.39,0.48]);
  const desc = String(description ?? '').slice(0, 58);
  text(content, 112, y, 8.4, desc, 'F1', [0.08,0.15,0.25]);
  text(content, 458, y, 8.4, `${kind === 'expense' ? '-' : '+'} ${money(amount)}`, 'F2', kind === 'expense' ? [0.55,0.18,0.18] : [0.10,0.45,0.27]);
}

function makePage({ residentialName, address, closing, rows, pageNumber, pageCount, continuation = false }) {
  const content=[];
  content.push('1 1 1 rg 0 0 595.28 841.89 re f');
  content.push('0.04 0.18 0.32 rg 0 795 595.28 46 re f');
  content.push('0.10 0.55 0.34 rg 0 790 595.28 5 re f');
  content.push('q 52 0 0 52 38 713 cm /Im1 Do Q');
  text(content, 105, 748, 19, residentialName || 'Residencial', 'F2', [0.04,0.18,0.32]);
  text(content, 106, 728, 10.5, 'Conta Certa - Prestação de contas mensal', 'F2', [0.10,0.55,0.34]);
  text(content, 106, 712, 7.8, address || 'Endereço cadastrado localmente', 'F1', [0.35,0.43,0.52]);
  text(content, 500, 748, 8, `Pág. ${pageNumber}/${pageCount}`, 'F1', [0.35,0.43,0.52]);

  let y=675;
  if (!continuation) {
    text(content, 38, y, 17, `PRESTAÇÃO DE CONTAS - ${competenceLabel(closing.competence)}`, 'F2', [0.04,0.18,0.32]); y-=28;
    const metrics=[
      ['Saldo anterior',closing.openingBalanceCents],['Receitas',closing.revenueCents],['Despesas',closing.expenseCents],['Resultado do mês',closing.resultCents],['Saldo final',closing.closingBalanceCents]
    ];
    const xs=[38,147,256,365,474];
    metrics.forEach(([label,value],i)=>{content.push(`0.96 0.98 0.99 rg ${xs[i]} ${y-38} 96 48 re f`); text(content,xs[i]+7,y-9,7.4,label,'F1',[0.35,0.43,0.52]); text(content,xs[i]+7,y-28,10.2,money(value),'F2', value<0?[0.55,0.18,0.18]:[0.04,0.18,0.32]);});
    y-=72;
    text(content, 38, y, 8.2, `Fechado em ${fmtDate(closing.closedAt)} - revisão ${closing.revision} - status: FECHADO`, 'F2', [0.10,0.45,0.27]);
    y-=27;
  } else {
    text(content,38,y,14,`Movimentações - continuação (${competenceLabel(closing.competence)})`,'F2',[0.04,0.18,0.32]); y-=32;
  }
  text(content,48,y,7.4,'DATA','F2',[0.35,0.43,0.52]); text(content,112,y,7.4,'DESCRIÇÃO','F2',[0.35,0.43,0.52]); text(content,458,y,7.4,'VALOR','F2',[0.35,0.43,0.52]); y-=13;
  content.push(`0.82 0.87 0.91 RG 0.6 w 38 ${y+7} m 557 ${y+7} l S`);
  for (const item of rows) { row(content,y,item.date,item.description,item.amountCents,item.kind); y-=18; }
  if (!rows.length) text(content,48,y,8.5,'Nenhuma movimentação registrada nesta competência.','F1',[0.35,0.43,0.52]);
  text(content,38,35,7.1,'Documento gerado localmente pelo Conta Certa. O fechamento mensal preserva os valores usados nesta prestação de contas.','F1',[0.35,0.43,0.52]);
  return `${content.join('\n')}\n`;
}

export function buildMonthlyStatementPdf({ residential, closing, payments = [], movements = [] }) {
  if (!closing || closing.status !== 'closed') throw new Error('PRESTACAO_EXIGE_COMPETENCIA_FECHADA');
  const revenueRows = [
    ...payments.filter(p => closing.paymentIds?.includes(p.id)).map(p => ({ date:p.paidAt, description:p.description || `Pagamento - unidade ${p.unitId}`, amountCents:p.amountCents, kind:'income' })),
    ...movements.filter(m => closing.movementIds?.includes(m.id) && m.kind === 'income')
  ];
  const expenseRows = movements.filter(m => closing.movementIds?.includes(m.id) && m.kind === 'expense');
  const allRows=[...revenueRows,...expenseRows].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const firstPageCount=20, otherPageCount=31;
  const pages=[];
  pages.push(allRows.slice(0,firstPageCount));
  for(let i=firstPageCount;i<allRows.length;i+=otherPageCount) pages.push(allRows.slice(i,i+otherPageCount));
  if (!pages.length) pages.push([]);

  const streams=pages.map((rows,index)=>makePage({
    residentialName: residential?.name ?? 'Residencial', address: residential?.address ?? '', closing, rows,
    pageNumber:index+1,pageCount:pages.length,continuation:index>0
  }));
  const imageBinary=base64Binary(CERTIFICATE_MARK_JPEG.base64);
  const objects=[];
  const pageIds=[]; const streamIds=[];
  const pageCount=streams.length;
  const font1=3+pageCount*2; const font2=font1+1; const imageId=font2+1;
  for(let i=0;i<pageCount;i+=1){pageIds.push(3+i*2);streamIds.push(4+i*2);}
  objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
  objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageCount} >>`;
  streams.forEach((stream,i)=>{
    objects[pageIds[i]]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${streamIds[i]} 0 R >>`;
    objects[streamIds[i]]=`<< /Length ${latin1Bytes(stream).length} >>\nstream\n${stream}endstream`;
  });
  objects[font1]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[font2]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objects[imageId]=`<< /Type /XObject /Subtype /Image /Width ${CERTIFICATE_MARK_JPEG.width} /Height ${CERTIFICATE_MARK_JPEG.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBinary.length} >>\nstream\n${imageBinary}\nendstream`;
  let pdf='%PDF-1.4\n%âãÏÓ\n'; const offsets=[0];
  for(let i=1;i<objects.length;i+=1){offsets[i]=latin1Bytes(pdf).length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=latin1Bytes(pdf).length; pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let i=1;i<objects.length;i+=1)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return latin1Bytes(pdf);
}
