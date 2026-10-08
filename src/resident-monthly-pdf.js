const brl = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
const money = cents => brl.format((Number(cents) || 0) / 100);
const safeInt = value => { if (!Number.isSafeInteger(value)) throw new Error('VALOR_FINANCEIRO_INVALIDO'); return value; };

function latin1Text(value) {
  return String(value ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function escapePdf(value) {
  return latin1Text(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function bytes(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function wrap(value, maxChars = 86) {
  const words = latin1Text(value).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) { lines.push(current); current = word; }
    else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

function addWrapped(lines, value, { bold=false, size=9, maxChars=86 } = {}) {
  for (const part of wrap(value, maxChars)) lines.push({ text:part, bold, size });
}

function formatDate(value) {
  if (!value) return '-';
  const text = String(value).slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return text;
}

function categoryKey(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function isFixedExpense(item) {
  const category = categoryKey(item?.category);
  return category === 'agua' || category === 'energia' || category.includes('energisa');
}

function obligationCompetence(item) {
  if (item?.year && item?.month) return `${Number(item.year)}-${String(Number(item.month)).padStart(2,'0')}`;
  const due = String(item?.dueDate ?? '');
  return /^\d{4}-\d{2}/.test(due) ? due.slice(0,7) : '';
}

function remaining(item) {
  return Math.max(0, safeInt(item?.amountCents) - safeInt(item?.paidCents));
}

function paymentLinesOperational(payload, competence) {
  const monthlyIds = new Set(
    (payload.obligations ?? [])
      .filter(item => item.kind === 'monthly_contribution' && item.status !== 'cancelled')
      .map(item => String(item.id))
  );
  return (payload.payments ?? [])
    .filter(item => monthlyIds.has(String(item.obligationId)) && String(item.paidAt).slice(0, 7) === competence)
    .sort((a,b)=>String(a.paidAt).localeCompare(String(b.paidAt)))
    .map(item => ({ date:item.paidAt, description:item.description || 'Mensalidade', amountCents:safeInt(item.amountCents) }));
}

function paymentLinesHistorical(payload, competence, historicalPeriod) {
  if (!historicalPeriod) return [];
  return (historicalPeriod.revenues ?? [])
    .filter(item => String(item.unitId ?? '') === String(payload.unit?.id ?? '') && item.type === 'contribution')
    .map(item => ({ date:`${competence}-01`, description:'Mensalidade / contribuição registrada no histórico', amountCents:safeInt(item.amountCents) }));
}

export function residentMonthlySummary({ payload, competence, historicalPeriod=null, extraFeeRevenueCents=0 }) {
  if (!payload?.unit?.id || !payload?.residential?.name) throw new Error('DADOS_MORADOR_INVALIDOS');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(competence))) throw new Error('COMPETENCIA_INVALIDA');
  const closing = (payload.closings ?? []).find(item => item.competence === competence);
  if (!closing || closing.status === 'reopened') throw new Error('RESUMO_MENSAL_EXIGE_COMPETENCIA_FECHADA');

  let expenses = closing.expenses ?? [];
  let monthlyPayments = paymentLinesOperational(payload, competence);
  let extraReceived = safeInt(extraFeeRevenueCents);

  if (closing.source === 'historical_import') {
    if (!historicalPeriod || historicalPeriod.id !== competence) throw new Error('DETALHE_HISTORICO_MENSAL_INDISPONIVEL');
    expenses = historicalPeriod.expenses ?? [];
    monthlyPayments = paymentLinesHistorical(payload, competence, historicalPeriod);
    extraReceived = (historicalPeriod.revenues ?? [])
      .filter(item => item.type === 'extra_fee')
      .reduce((sum,item)=>sum + safeInt(item.amountCents), 0);
  }

  const pendingExtra = (payload.obligations ?? [])
    .filter(item => item.kind === 'extraordinary_fee' && item.status !== 'cancelled' && remaining(item) > 0)
    .filter(item => {
      const c = obligationCompetence(item);
      return !c || c <= competence;
    })
    .sort((a,b)=>String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? '')))
    .map(item => ({
      dueDate:item.dueDate || '',
      description:item.description || 'Taxa extraordinária',
      remainingCents:remaining(item),
    }));

  const normalizedExpenses = expenses.map(item => ({
    category:item.category || 'Outros',
    description:item.description || item.category || 'Despesa',
    amountCents:safeInt(item.amountCents),
  }));
  const fixedExpenses = normalizedExpenses.filter(isFixedExpense);
  const variableExpenses = normalizedExpenses.filter(item => !isFixedExpense(item));

  return Object.freeze({
    competence,
    closing,
    pendingExtra,
    monthlyPayments,
    extraFeeRevenueCents:extraReceived,
    fixedExpenses,
    variableExpenses,
    fixedExpenseCents:fixedExpenses.reduce((sum,item)=>sum + item.amountCents,0),
    variableExpenseCents:variableExpenses.reduce((sum,item)=>sum + item.amountCents,0),
  });
}

function bodyLines({ payload, summary, generatedAt }) {
  const lines=[];
  lines.push({text:'RESUMO',bold:true,size:11});
  addWrapped(lines, `Unidade: ${payload.unit?.label ?? payload.unit?.id ?? '-'}`, {bold:true});
  if (payload.unit?.responsibleName) addWrapped(lines, `Responsável: ${payload.unit.responsibleName}`);
  addWrapped(lines, `Competência: ${summary.competence}`);
  addWrapped(lines, `Gerado em: ${new Date(generatedAt).toLocaleString('pt-BR')}`);
  lines.push({text:''});

  lines.push({text:'OBRIGAÇÕES DA UNIDADE',bold:true,size:11});
  addWrapped(lines, 'Posição atual das taxas originadas até a competência, na data de geração.');
  if (!summary.pendingExtra.length) addWrapped(lines,'Nenhuma taxa extraordinária dessas competências permanece pendente.');
  for (const item of summary.pendingExtra) {
    addWrapped(lines, `${formatDate(item.dueDate)} - ${item.description} - Pendente: ${money(item.remainingCents)}`);
  }
  lines.push({text:''});

  lines.push({text:'PAGAMENTOS',bold:true,size:11});
  if (!summary.monthlyPayments.length) addWrapped(lines,'Nenhum pagamento de mensalidade recebido neste mês foi localizado para a unidade.');
  for (const item of summary.monthlyPayments) {
    addWrapped(lines, `${formatDate(item.date)} - ${item.description} - ${money(item.amountCents)}`);
  }
  lines.push({text:''});

  lines.push({text:'RESUMO DO CAIXA',bold:true,size:11});
  addWrapped(lines, `Saldo anterior do residencial: ${money(summary.closing.openingBalanceCents)}`);
  addWrapped(lines, `Receitas do período: ${money(summary.closing.revenueCents)}`);
  if (summary.extraFeeRevenueCents > 0) addWrapped(lines, `Taxas extraordinárias recebidas no período: ${money(summary.extraFeeRevenueCents)} (já incluídas nas receitas)`);
  lines.push({text:''});

  lines.push({text:'DESPESAS FIXAS',bold:true,size:10});
  if (!summary.fixedExpenses.length) addWrapped(lines,'Nenhuma despesa fixa discriminada.');
  for (const item of summary.fixedExpenses) addWrapped(lines, `${item.description} - ${money(item.amountCents)}`);
  addWrapped(lines, `Total de despesas fixas: ${money(summary.fixedExpenseCents)}`, {bold:true});
  lines.push({text:''});

  lines.push({text:'DESPESAS VARIÁVEIS',bold:true,size:10});
  if (!summary.variableExpenses.length) addWrapped(lines,'Nenhuma despesa variável discriminada.');
  for (const item of summary.variableExpenses) addWrapped(lines, `${item.description} - ${money(item.amountCents)}`);
  addWrapped(lines, `Total de despesas variáveis: ${money(summary.variableExpenseCents)}`, {bold:true});
  lines.push({text:''});

  addWrapped(lines, `Despesas totais do período: ${money(summary.closing.expenseCents)}`);
  addWrapped(lines, `Saldo final do mês do residencial: ${money(summary.closing.closingBalanceCents)}`, {bold:true});
  return lines;
}

function drawText(content,x,y,size,value,font='F1') {
  content.push(`BT /${font} ${size} Tf 0.08 0.15 0.25 rg ${x} ${y} Td (${escapePdf(value)}) Tj ET`);
}

function pageStream({payload,lines,pageNumber,pageCount}) {
  const content=[];
  content.push('1 1 1 rg 0 0 595.28 841.89 re f');
  content.push('0.04 0.18 0.32 rg 0 795 595.28 46 re f');
  content.push('0.10 0.55 0.34 rg 0 790 595.28 5 re f');
  drawText(content,42,750,18,payload.residential?.name || 'Residencial','F2');
  drawText(content,42,730,10.5,'Conta Certa - Resumo mensal do morador','F2');
  drawText(content,42,714,8.5,`${payload.unit?.label || 'Unidade'} - ${payload.unit?.responsibleName || ''}`,'F1');
  drawText(content,500,748,8,`Pág. ${pageNumber}/${pageCount}`,'F1');
  content.push('0.82 0.87 0.91 RG 0.6 w 38 692 m 557 692 l S');
  let y=670;
  for(const line of lines){
    if(!line.text){y-=8;continue;}
    drawText(content,42,y,line.size||9,line.text,line.bold?'F2':'F1');
    y-=line.bold?17:14;
  }
  content.push('0.82 0.87 0.91 RG 0.5 w 38 48 m 557 48 l S');
  drawText(content,38,34,7.2,'Resumo de consulta gerado pelo Conta Certa. Valores coletivos referem-se ao residencial.','F1');
  return `${content.join('\n')}\n`;
}

export function buildResidentMonthlyPdf({ payload, competence, historicalPeriod=null, extraFeeRevenueCents=0, generatedAt=new Date().toISOString() }) {
  const summary=residentMonthlySummary({payload,competence,historicalPeriod,extraFeeRevenueCents});
  const body=bodyLines({payload,summary,generatedAt});
  const MAX_LINES=39;
  const pages=[];
  for(let i=0;i<body.length;i+=MAX_LINES) pages.push(body.slice(i,i+MAX_LINES));
  if(!pages.length) pages.push([]);
  const streams=pages.map((lines,index)=>pageStream({payload,lines,pageNumber:index+1,pageCount:pages.length}));
  const pageCount=streams.length;
  const font1=3+pageCount*2;
  const font2=font1+1;
  const objects=[];
  const pageIds=[];
  const streamIds=[];
  for(let i=0;i<pageCount;i+=1){pageIds.push(3+i*2);streamIds.push(4+i*2);}
  objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
  objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageCount} >>`;
  streams.forEach((stream,i)=>{
    objects[pageIds[i]]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${streamIds[i]} 0 R >>`;
    objects[streamIds[i]]=`<< /Length ${bytes(stream).length} >>\nstream\n${stream}endstream`;
  });
  objects[font1]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[font2]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  const parts=[bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets=[0];
  let offset=parts[0].length;
  for(let id=1;id<objects.length;id+=1){
    const part=bytes(`${id} 0 obj\n${objects[id]}\nendobj\n`);
    offsets[id]=offset; parts.push(part); offset+=part.length;
  }
  const xrefOffset=offset;
  let xref=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let id=1;id<objects.length;id+=1) xref+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;
  const trailer=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(bytes(xref+trailer));
  return concat(parts);
}
