import { evaluateProject } from './projections.js';
import { getSetting, setSetting, saveProjection, listProjections, replaceImportedData, getImportMeta, getResidential, listUnits, listPeriods } from './db.js';
import { validateImportBundle, summarizeImport, summarizeByYear, importedYearCertificateStatus } from './migration.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = cents => brl.format((cents ?? 0) / 100);
const toCents = value => Math.round((Number(String(value).replace(',', '.')) || 0) * 100);
const $ = selector => document.querySelector(selector);
let importedPeriods = [];
let importedUnits = [];

function setView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('.nav-button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
}

document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));

function quoteRow(seed = {}) {
  const quoteList = $('#quote-list');
  const row = document.createElement('div');
  row.className = 'quote-row';
  row.innerHTML = `
    <label>Fornecedor / orçamento<input class="quote-supplier" value="${seed.supplier ?? ''}" placeholder="Ex.: Orçamento A"></label>
    <label>Valor (R$)<input class="quote-amount" type="number" min="0" step="0.01" value="${seed.amount ?? ''}" placeholder="0,00"></label>
    <button type="button" class="icon-button remove-quote" aria-label="Remover orçamento">×</button>`;
  row.querySelector('.remove-quote').addEventListener('click', () => { if (quoteList.children.length > 1) row.remove(); });
  quoteList.appendChild(row);
}

function readQuotes() {
  return [...document.querySelectorAll('.quote-row')].map((row, i) => ({
    id: `q-${i + 1}`,
    supplier: row.querySelector('.quote-supplier').value.trim() || `Orçamento ${i + 1}`,
    amountCents: toCents(row.querySelector('.quote-amount').value),
  })).filter(q => q.amountCents > 0);
}

function renderProjection(project) {
  const result = $('#projection-result');
  result.innerHTML = '';
  for (const q of project.quotes) {
    const card = document.createElement('article');
    card.className = `quote-result ${q.hasEnoughCash ? 'ok' : 'attention'}`;
    const coverage = (q.coverageBasisPoints / 100).toFixed(2).replace('.', ',');
    card.innerHTML = `<div class="quote-title"><strong>${q.supplier}</strong><span>${money(q.quoteCents)}</span></div>
      <div class="meter" aria-label="${coverage}% do orçamento coberto"><span style="width:${Math.min(100, q.coverageBasisPoints / 100)}%"></span></div>
      <dl><div><dt>Caixa atual</dt><dd>${money(q.cashBalanceCents)}</dd></div><div><dt>Reserva protegida</dt><dd>${money(q.protectedReserveCents)}</dd></div><div><dt>Disponível para o projeto</dt><dd>${money(q.availableForProjectCents)}</dd></div><div><dt>Cobertura</dt><dd>${coverage}%</dd></div><div><dt>${q.hasEnoughCash ? 'Sobra após pagamento' : 'Valor que falta'}</dt><dd>${q.hasEnoughCash ? money(q.projectedBalanceAfterPaymentCents) : money(q.gapCents)}</dd></div>${q.hasEnoughCash ? '' : `<div><dt>Rateio sugerido por unidade</dt><dd>${money(q.suggestedExtraPerUnitCents)}</dd></div>`}</dl>`;
    result.appendChild(card);
  }
}

async function renderProjectionHistory() {
  const history = $('#projection-history');
  const items = (await listProjections()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!items.length) { history.innerHTML = '<p class="muted">Nenhuma projeção salva ainda.</p>'; return; }
  history.innerHTML = items.slice(0, 5).map(item => `<article class="history-item"><strong>${item.name}</strong><span>${new Date(item.createdAt).toLocaleString('pt-BR')}</span><small>${item.quotes.length} orçamento(s) registrado(s)</small></article>`).join('');
}

async function calculateProjection(save = false) {
  const quotes = readQuotes();
  if (!quotes.length) { $('#projection-result').innerHTML = '<p class="warning">Informe pelo menos um orçamento com valor maior que zero.</p>'; return; }
  const name = $('#project-name').value.trim() || 'Projeto sem nome';
  const cashBalanceCents = toCents($('#cash-balance').value);
  const protectedReserveCents = toCents($('#protected-reserve').value);
  const activeUnits = Number($('#active-units').value);
  const project = evaluateProject({ name, cashBalanceCents, protectedReserveCents, activeUnits, quotes });
  renderProjection(project);
  await Promise.all([setSetting('cashBalanceCents', cashBalanceCents), setSetting('protectedReserveCents', protectedReserveCents), setSetting('activeUnits', activeUnits)]);
  if (save) {
    await saveProjection({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), name, cashBalanceCents, protectedReserveCents, activeUnits, quotes });
    await renderProjectionHistory();
    $('#save-feedback').textContent = 'Projeção salva no dispositivo.';
    setTimeout(() => { $('#save-feedback').textContent = ''; }, 2500);
  }
}

function renderUnits(units) {
  const box = $('#units-list');
  if (!units.length) { box.innerHTML = '<p class="muted">Nenhuma unidade cadastrada.</p>'; return; }
  box.innerHTML = units.map(unit => {
    const phones = unit.contacts?.filter(c => c.type === 'phone')?.length ?? (unit.phone ? 1 : 0);
    return `<article class="unit-row"><div><strong>${unit.label ?? `Apartamento ${unit.id}`}</strong><span>${unit.responsibleName ?? 'Responsável não informado'}</span></div><small>${phones} telefone(s) cadastrado(s)</small></article>`;
  }).join('');
}

function renderHistory(periods) {
  const box = $('#history-table');
  if (!periods.length) { box.innerHTML = '<p class="muted">Nenhum histórico importado.</p>'; return; }
  const rows = summarizeByYear(periods);
  box.innerHTML = `<div class="responsive-table"><table><thead><tr><th>Ano</th><th>Meses</th><th>Receitas</th><th>Despesas</th><th>Saldo final</th><th>Conciliação</th></tr></thead><tbody>${rows.map(r => {
    const details = [r.ok ? `${r.ok} ok` : '', r.resolved ? `${r.resolved} explicada(s)` : '', r.legacy ? `${r.legacy} legado` : '', r.review ? `${r.review} revisar` : ''].filter(Boolean).join(' • ');
    return `<tr><td>${r.year}</td><td>${r.months}</td><td>${money(r.revenuesCents)}</td><td>${money(r.expensesCents)}</td><td>${money(r.closingBalanceCents)}</td><td><span class="status-badge ${r.review ? 'attention' : 'ok'}">${r.review ? `${r.review} revisão manual` : 'Classificado'}</span><small class="table-note">${details}</small></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderCompliance(periods, units) {
  const select = $('#compliance-year');
  const years = [...new Set(periods.map(p => p.year))].sort((a,b)=>b-a);
  if (!years.length) { select.innerHTML = ''; $('#compliance-list').innerHTML = '<p class="muted">Nenhum histórico importado.</p>'; return; }
  const current = Number(select.value) || years[0];
  select.innerHTML = years.map(y => `<option value="${y}" ${y===current?'selected':''}>${y}</option>`).join('');
  const year = Number(select.value);
  const results = units.map(unit => ({ unit, status: importedYearCertificateStatus({ periods, year, unitId: unit.id }) }));
  $('#compliance-list').innerHTML = results.map(({unit,status}) => {
    const label = status.reason === 'HISTORICO_REFERENCIAL'
      ? 'Histórico de referência — emissão automática desabilitada'
      : status.eligible
        ? 'Elegível'
        : status.reason === 'ANO_INCOMPLETO'
          ? 'Bloqueada: ano incompleto'
          : status.reason === 'IMPORTACAO_REQUER_REVISAO'
            ? 'Bloqueada: há evidência não validada'
            : 'Bloqueada: pagamento não comprovado';
    return `<article class="compliance-row"><div><strong>${unit.label ?? unit.id}</strong><span>${unit.responsibleName ?? ''}</span></div><span class="status-badge ${status.eligible?'ok':'attention'}">${label}</span></article>`;
  }).join('');
}

async function refreshImportedData() {
  const [meta, residential, units, periods] = await Promise.all([getImportMeta(), getResidential(), listUnits(), listPeriods()]);
  importedPeriods = periods.sort((a,b)=>a.id.localeCompare(b.id));
  importedUnits = units.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  if (!meta) {
    $('#import-state').textContent = 'Sem importação';
    return;
  }
  $('#import-state').textContent = 'Base importada'; $('#import-state').className = 'status-badge ok';
  $('#kpi-balance').textContent = money(meta.latestBalanceCents);
  $('#kpi-balance-period').textContent = meta.latestPeriodId ?? '—';
  $('#kpi-periods').textContent = meta.periodCount;
  $('#kpi-range').textContent = `${meta.startPeriodId ?? '—'} até ${meta.latestPeriodId ?? '—'}`;
  $('#kpi-reconciled').textContent = meta.classifiedCount ?? meta.reconciledCount;
  $('#kpi-review').textContent = `${meta.reviewCount} revisão manual • ${meta.resolvedCount ?? 0} explicada(s) • ${meta.legacyCount ?? 0} legado`;
  $('#kpi-units').textContent = units.length;
  renderUnits(units); renderHistory(periods); renderCompliance(periods, units);
  if (meta.latestBalanceCents != null) $('#cash-balance').value = (meta.latestBalanceCents/100).toFixed(2);
  $('#active-units').value = units.filter(u => u.active !== false).length || 5;
  if (residential?.name) document.title = `Conta Certa — ${residential.name}`;
}

async function importSelectedFile() {
  const file = $('#import-file').files?.[0];
  if (!file) { $('#import-feedback').textContent = 'Selecione o arquivo JSON de importação.'; return; }
  try {
    const bundle = JSON.parse(await file.text());
    validateImportBundle(bundle);
    const summary = summarizeImport(bundle);
    await replaceImportedData(bundle, summary);
    $('#import-feedback').textContent = `Importação concluída: ${summary.periodCount} competências, ${summary.classifiedCount} classificadas e ${summary.reviewCount} em revisão manual.`;
    await refreshImportedData();
  } catch (error) {
    $('#import-feedback').textContent = `Importação não realizada: ${error.message}`;
  }
}

async function init() {
  quoteRow({ supplier: 'Orçamento A' });
  $('#cash-balance').value = ((await getSetting('cashBalanceCents', 125872)) / 100).toFixed(2);
  $('#protected-reserve').value = ((await getSetting('protectedReserveCents', 0)) / 100).toFixed(2);
  $('#active-units').value = await getSetting('activeUnits', 5);
  await renderProjectionHistory();
  await refreshImportedData();
  $('#add-quote').addEventListener('click', () => quoteRow());
  $('#calculate').addEventListener('click', () => calculateProjection(false));
  $('#save-projection').addEventListener('click', () => calculateProjection(true));
  $('#import-button').addEventListener('click', importSelectedFile);
  $('#compliance-year').addEventListener('change', () => renderCompliance(importedPeriods, importedUnits));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
