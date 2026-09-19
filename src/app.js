import { evaluateProject } from './projections.js';
import { getSetting, setSetting, saveProjection, listProjections } from './db.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = cents => brl.format(cents / 100);
const toCents = value => Math.round((Number(String(value).replace(',', '.')) || 0) * 100);

const $ = selector => document.querySelector(selector);
const quoteList = $('#quote-list');
const result = $('#projection-result');
const history = $('#projection-history');

function quoteRow(seed = {}) {
  const row = document.createElement('div');
  row.className = 'quote-row';
  row.innerHTML = `
    <label>Fornecedor / orçamento
      <input class="quote-supplier" value="${seed.supplier ?? ''}" placeholder="Ex.: Orçamento A">
    </label>
    <label>Valor (R$)
      <input class="quote-amount" type="number" min="0" step="0.01" value="${seed.amount ?? ''}" placeholder="0,00">
    </label>
    <button type="button" class="icon-button remove-quote" aria-label="Remover orçamento">×</button>
  `;
  row.querySelector('.remove-quote').addEventListener('click', () => {
    if (quoteList.children.length > 1) row.remove();
  });
  quoteList.appendChild(row);
}

function readQuotes() {
  return [...document.querySelectorAll('.quote-row')]
    .map((row, i) => ({
      id: `q-${i + 1}`,
      supplier: row.querySelector('.quote-supplier').value.trim() || `Orçamento ${i + 1}`,
      amountCents: toCents(row.querySelector('.quote-amount').value),
    }))
    .filter(q => q.amountCents > 0);
}

function renderProjection(project) {
  result.innerHTML = '';
  for (const q of project.quotes) {
    const card = document.createElement('article');
    card.className = `quote-result ${q.hasEnoughCash ? 'ok' : 'attention'}`;
    const coverage = (q.coverageBasisPoints / 100).toFixed(2).replace('.', ',');
    card.innerHTML = `
      <div class="quote-title"><strong>${q.supplier}</strong><span>${money(q.quoteCents)}</span></div>
      <div class="meter" aria-label="${coverage}% do orçamento coberto"><span style="width:${Math.min(100, q.coverageBasisPoints / 100)}%"></span></div>
      <dl>
        <div><dt>Caixa atual</dt><dd>${money(q.cashBalanceCents)}</dd></div>
        <div><dt>Reserva protegida</dt><dd>${money(q.protectedReserveCents)}</dd></div>
        <div><dt>Disponível para o projeto</dt><dd>${money(q.availableForProjectCents)}</dd></div>
        <div><dt>Cobertura</dt><dd>${coverage}%</dd></div>
        <div><dt>${q.hasEnoughCash ? 'Sobra após pagamento' : 'Valor que falta'}</dt><dd>${q.hasEnoughCash ? money(q.projectedBalanceAfterPaymentCents) : money(q.gapCents)}</dd></div>
        ${q.hasEnoughCash ? '' : `<div><dt>Rateio sugerido por unidade</dt><dd>${money(q.suggestedExtraPerUnitCents)}</dd></div>`}
      </dl>
    `;
    result.appendChild(card);
  }
}

async function renderHistory() {
  const items = (await listProjections()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!items.length) {
    history.innerHTML = '<p class="muted">Nenhuma projeção salva ainda.</p>';
    return;
  }
  history.innerHTML = items.slice(0, 5).map(item => `
    <article class="history-item">
      <strong>${item.name}</strong>
      <span>${new Date(item.createdAt).toLocaleString('pt-BR')}</span>
      <small>${item.quotes.length} orçamento(s) registrado(s)</small>
    </article>
  `).join('');
}

async function calculate(save = false) {
  const quotes = readQuotes();
  if (!quotes.length) {
    result.innerHTML = '<p class="warning">Informe pelo menos um orçamento com valor maior que zero.</p>';
    return;
  }

  const name = $('#project-name').value.trim() || 'Projeto sem nome';
  const cashBalanceCents = toCents($('#cash-balance').value);
  const protectedReserveCents = toCents($('#protected-reserve').value);
  const activeUnits = Number($('#active-units').value);

  const project = evaluateProject({ name, cashBalanceCents, protectedReserveCents, activeUnits, quotes });
  renderProjection(project);

  await Promise.all([
    setSetting('cashBalanceCents', cashBalanceCents),
    setSetting('protectedReserveCents', protectedReserveCents),
    setSetting('activeUnits', activeUnits),
  ]);

  if (save) {
    await saveProjection({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name,
      cashBalanceCents,
      protectedReserveCents,
      activeUnits,
      quotes,
    });
    await renderHistory();
    $('#save-feedback').textContent = 'Projeção salva no dispositivo.';
    setTimeout(() => { $('#save-feedback').textContent = ''; }, 2500);
  }
}

async function init() {
  quoteRow({ supplier: 'Orçamento A' });
  $('#cash-balance').value = ((await getSetting('cashBalanceCents', 125872)) / 100).toFixed(2);
  $('#protected-reserve').value = ((await getSetting('protectedReserveCents', 0)) / 100).toFixed(2);
  $('#active-units').value = await getSetting('activeUnits', 5);
  await renderHistory();

  $('#add-quote').addEventListener('click', () => quoteRow());
  $('#calculate').addEventListener('click', () => calculate(false));
  $('#save-projection').addEventListener('click', () => calculate(true));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
