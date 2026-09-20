import { evaluateProject } from './projections.js';
import {
  getSetting, setSetting, saveProjection, listProjections,
  replaceImportedData, getImportMeta, getResidential, listUnits, listPeriods,
  saveObligation, saveObligations, listObligations, registerObligationPayment,
} from './db.js';
import { validateImportBundle, summarizeImport, summarizeByYear } from './migration.js';
import { evaluateAnnualCompliance } from './compliance.js';
import {
  normalizeObligation, ledgerSummary, createMonthlyObligations,
  applyPayment, outstandingCents,
} from './obligations.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = cents => brl.format((cents ?? 0) / 100);
const toCents = value => Math.round((Number(String(value).replace(',', '.')) || 0) * 100);
const $ = selector => document.querySelector(selector);
let importedPeriods = [];
let importedUnits = [];
let ledger = [];

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

function fillUnitSelectors() {
  const options = importedUnits.map(u => `<option value="${u.id}">${u.label ?? `Apartamento ${u.id}`}</option>`).join('');
  $('#obligation-unit').innerHTML = options || '<option value="">Importe/cadastre as unidades</option>';
}

const kindLabel = kind => ({
  monthly_contribution: 'Mensalidade', extraordinary_fee: 'Taxa extraordinária', installment: 'Parcelamento', other: 'Outra obrigação'
}[kind] ?? kind);

function renderObligations() {
  const summary = ledgerSummary(ledger);
  $('#obligation-total').textContent = summary.count;
  $('#obligation-pending').textContent = summary.pendingCount;
  $('#obligation-outstanding').textContent = money(summary.outstandingCents);
  const box = $('#obligation-list');
  if (!ledger.length) { box.innerHTML = '<p class="muted">Nenhuma obrigação registrada.</p>'; return; }
  const unitsById = new Map(importedUnits.map(u => [String(u.id), u]));
  const ordered = [...ledger].sort((a,b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? '') || String(a.unitId).localeCompare(String(b.unitId)));
  box.innerHTML = ordered.map(o => {
    const unit = unitsById.get(String(o.unitId));
    const pending = outstandingCents(o);
    const statusLabel = o.status === 'paid' ? 'Quitada' : o.status === 'partial' ? 'Parcial' : o.status === 'cancelled' ? 'Cancelada' : 'Em aberto';
    return `<article class="obligation-row">
      <div class="obligation-main"><strong>${unit?.label ?? `Unidade ${o.unitId}`} • ${kindLabel(o.kind)}</strong><span>${o.description ?? ''}</span><small>Vencimento: ${o.dueDate ?? 'não informado'} • Total: ${money(o.amountCents)}${o.paidCents ? ` • Pago: ${money(o.paidCents)}` : ''}</small></div>
      <div class="obligation-actions"><span class="status-badge ${o.status === 'paid' ? 'ok' : o.status === 'cancelled' ? 'neutral' : 'attention'}">${statusLabel}${pending ? ` • falta ${money(pending)}` : ''}</span>${o.status !== 'paid' && o.status !== 'cancelled' ? `<button type="button" class="small-button pay-obligation" data-id="${o.id}">Registrar pagamento</button>` : ''}</div>
    </article>`;
  }).join('');
  document.querySelectorAll('.pay-obligation').forEach(button => button.addEventListener('click', () => payObligation(button.dataset.id)));
}

async function refreshLedger() {
  ledger = (await listObligations()).map(normalizeObligation);
  renderObligations();
  renderLedgerCompliance();
}

async function addObligation() {
  const unitId = $('#obligation-unit').value;
  const kind = $('#obligation-kind').value;
  const amountCents = toCents($('#obligation-amount').value);
  const dueDate = $('#obligation-due').value;
  const [year, month] = ($('#obligation-competence').value || '').split('-').map(Number);
  if (!unitId || !amountCents || !dueDate || !year || !month) {
    $('#obligation-feedback').textContent = 'Preencha unidade, competência, vencimento e valor.';
    return;
  }
  const obligation = normalizeObligation({
    id: crypto.randomUUID(), unitId, kind,
    description: $('#obligation-description').value.trim() || kindLabel(kind),
    amountCents, paidCents: 0, dueDate, year, month, required: true,
  });
  await saveObligation(obligation);
  $('#obligation-feedback').textContent = 'Obrigação registrada.';
  $('#obligation-amount').value = '';
  await refreshLedger();
}

async function generateMonthlyBatch() {
  const competence = $('#monthly-competence').value;
  const amountCents = toCents($('#monthly-amount').value);
  const dueDate = $('#monthly-due').value;
  const [year, month] = competence.split('-').map(Number);
  if (!year || !month || !amountCents || !dueDate || !importedUnits.length) {
    $('#obligation-feedback').textContent = 'Informe competência, vencimento e valor e tenha unidades cadastradas.';
    return;
  }
  const newItems = createMonthlyObligations({ units: importedUnits, year, month, amountCents, dueDate });
  const existingIds = new Set(ledger.map(o => o.id));
  const unique = newItems.filter(o => !existingIds.has(o.id));
  if (!unique.length) { $('#obligation-feedback').textContent = 'As mensalidades dessa competência já existem.'; return; }
  await saveObligations(unique);
  $('#obligation-feedback').textContent = `${unique.length} mensalidade(s) gerada(s).`;
  await refreshLedger();
}

async function payObligation(id) {
  const obligation = ledger.find(o => o.id === id);
  if (!obligation) return;
  const openCents = outstandingCents(obligation);
  const answer = window.prompt(`Saldo pendente: ${money(openCents)}\nInforme o valor recebido (R$):`, (openCents / 100).toFixed(2));
  if (answer == null) return;
  const paymentCents = toCents(answer);
  try {
    const updated = applyPayment(obligation, paymentCents);
    await registerObligationPayment({
      obligation: updated,
      payment: { id: crypto.randomUUID(), obligationId: id, unitId: obligation.unitId, amountCents: paymentCents, paidAt: new Date().toISOString() },
    });
    $('#obligation-feedback').textContent = updated.status === 'paid' ? 'Obrigação quitada.' : 'Pagamento parcial registrado.';
    await refreshLedger();
  } catch (error) {
    $('#obligation-feedback').textContent = `Pagamento não registrado: ${error.message}`;
  }
}

function renderLedgerCompliance() {
  const select = $('#compliance-year');
  const years = [...new Set(ledger.map(o => Number(o.year)).filter(Boolean))].sort((a,b)=>b-a);
  if (!years.length || !importedUnits.length) {
    select.innerHTML = '';
    $('#compliance-list').innerHTML = '<p class="muted">Cadastre obrigações mensais para iniciar a avaliação oficial de adimplência.</p>';
    return;
  }
  const current = Number(select.value) || years[0];
  select.innerHTML = years.map(y => `<option value="${y}" ${y===current?'selected':''}>${y}</option>`).join('');
  const year = Number(select.value);
  $('#compliance-list').innerHTML = importedUnits.map(unit => {
    const obligations = ledger.filter(o => String(o.unitId) === String(unit.id));
    const status = evaluateAnnualCompliance({ obligations, year });
    let label = 'Elegível para emissão';
    if (!status.completeYear) label = 'Bloqueada: exercício incompleto no livro';
    else if (status.pending.length) label = `Bloqueada: ${status.pending.length} obrigação(ões) pendente(s)`;
    return `<article class="compliance-row"><div><strong>${unit.label ?? unit.id}</strong><span>${unit.responsibleName ?? ''}</span></div><span class="status-badge ${status.eligible?'ok':'attention'}">${label}</span></article>`;
  }).join('');
}

async function refreshImportedData() {
  const [meta, residential, units, periods] = await Promise.all([getImportMeta(), getResidential(), listUnits(), listPeriods()]);
  importedPeriods = periods.sort((a,b)=>a.id.localeCompare(b.id));
  importedUnits = units.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  fillUnitSelectors();
  if (!meta) {
    $('#import-state').textContent = 'Sem importação';
    renderUnits(units);
    await refreshLedger();
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
  renderUnits(units); renderHistory(periods);
  if (meta.latestBalanceCents != null) $('#cash-balance').value = (meta.latestBalanceCents/100).toFixed(2);
  $('#active-units').value = units.filter(u => u.active !== false).length || 5;
  if (residential?.name) document.title = `Conta Certa — ${residential.name}`;
  await refreshLedger();
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

function initializeDates() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const competence = `${y}-${m}`;
  $('#obligation-competence').value = competence;
  $('#monthly-competence').value = competence;
  $('#obligation-due').value = `${competence}-10`;
  $('#monthly-due').value = `${competence}-10`;
  $('#monthly-amount').value = '190.00';
}

async function init() {
  quoteRow({ supplier: 'Orçamento A' });
  initializeDates();
  $('#cash-balance').value = ((await getSetting('cashBalanceCents', 125872)) / 100).toFixed(2);
  $('#protected-reserve').value = ((await getSetting('protectedReserveCents', 0)) / 100).toFixed(2);
  $('#active-units').value = await getSetting('activeUnits', 5);
  await renderProjectionHistory();
  await refreshImportedData();
  $('#add-quote').addEventListener('click', () => quoteRow());
  $('#calculate').addEventListener('click', () => calculateProjection(false));
  $('#save-projection').addEventListener('click', () => calculateProjection(true));
  $('#import-button').addEventListener('click', importSelectedFile);
  $('#save-obligation').addEventListener('click', addObligation);
  $('#generate-monthly').addEventListener('click', generateMonthlyBatch);
  $('#compliance-year').addEventListener('change', renderLedgerCompliance);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
