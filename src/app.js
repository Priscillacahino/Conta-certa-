import { evaluateProject } from './projections.js';
import {
  getSetting, setSetting, saveProjection, listProjections,
  replaceImportedData, getImportMeta, getResidential, listUnits, listPeriods,
  saveObligation, saveObligations, listObligations, registerObligationPayment,
  listCertificates, saveIssuedCertificate, revokeStoredCertificate,
} from './db.js';
import { validateImportBundle, summarizeImport, summarizeByYear } from './migration.js';
import { evaluateAnnualCompliance, lastWeekdayOfYear } from './compliance.js';
import { issueCertificateArtifact, verifyCertificateRecord, base64ToBytes } from './certificates.js';
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
let residentialData = null;
let certificates = [];

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
  [ledger, certificates] = await Promise.all([
    listObligations().then(items => items.map(normalizeObligation)),
    listCertificates(),
  ]);
  renderObligations();
  renderCertificateHistory();
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function activeCertificate(unitId, year) {
  return certificates.find(c => String(c.unitId) === String(unitId) && Number(c.year) === Number(year) && c.status === 'VALID') ?? null;
}

function certificatePhones(unit) {
  return (unit?.contacts ?? []).filter(c => c.type === 'phone' && c.active !== false && c.purpose !== 'disabled').map(c => c.value);
}

function downloadBytes(bytes, fileName, mime = 'application/pdf') {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function downloadCertificate(certificateId) {
  const record = certificates.find(c => c.certificateId === certificateId);
  if (!record) return;
  downloadBytes(base64ToBytes(record.pdfBase64), record.fileName);
}

async function shareCertificate(certificateId) {
  const record = certificates.find(c => c.certificateId === certificateId);
  if (!record) return;
  const unit = importedUnits.find(u => String(u.id) === String(record.unitId));
  const phones = certificatePhones(unit);
  const bytes = base64ToBytes(record.pdfBase64);
  const file = new File([bytes], record.fileName, { type: 'application/pdf' });
  const text = `Declaração de adimplência ${record.year} - ${record.unitLabel}. Destino cadastrado: ${phones.join(' / ') || 'sem telefone cadastrado'}.`;
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title: 'Conta Certa - Declaração de adimplência', text, files: [file] });
      $('#certificate-feedback').textContent = 'Compartilhamento aberto no aparelho. Confirme o aplicativo e o destinatário.';
    } else {
      downloadBytes(bytes, record.fileName);
      $('#certificate-feedback').textContent = 'Seu navegador não permite compartilhar o PDF diretamente. O arquivo foi baixado.';
    }
  } catch (error) {
    if (error?.name !== 'AbortError') $('#certificate-feedback').textContent = `Compartilhamento não concluído: ${error.message}`;
  }
}

function renderCertificateHistory() {
  const box = $('#certificate-history');
  const validation = $('#validation-certificate');
  const ordered = [...certificates].sort((a,b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
  validation.innerHTML = ordered.length ? ordered.map(c => `<option value="${escapeHtml(c.certificateId)}">${escapeHtml(c.unitLabel)} - ${c.year} - ${escapeHtml(c.certificateId)}</option>`).join('') : '<option value="">Nenhuma declaração</option>';
  if (!ordered.length) { box.innerHTML = '<p class="muted">Nenhuma declaração emitida.</p>'; return; }
  box.innerHTML = ordered.map(c => {
    const unit = importedUnits.find(u => String(u.id) === String(c.unitId));
    const phones = certificatePhones(unit);
    const revoked = c.status === 'REVOKED';
    return `<article class="certificate-row">
      <div class="certificate-main"><strong>${escapeHtml(c.unitLabel)} • ${c.year}</strong><span>${escapeHtml(c.certificateId)}</span><small>Emitida: ${new Date(c.issuedAt).toLocaleString('pt-BR')} • Validação: ${escapeHtml(c.verificationCode)}</small><small>Destinatário(s): ${escapeHtml(phones.join(' / ') || 'telefone não cadastrado')}</small>${revoked ? `<small class="revoked-note">Revogada: ${escapeHtml(c.revocationReason)} • ${new Date(c.revokedAt).toLocaleString('pt-BR')}</small>` : ''}</div>
      <div class="certificate-actions"><span class="status-badge ${revoked ? 'attention' : 'ok'}">${revoked ? 'REVOGADA' : 'VÁLIDA'}</span><button class="small-button download-certificate" data-id="${escapeHtml(c.certificateId)}" type="button">Baixar PDF</button>${revoked ? '' : `<button class="small-button share-certificate" data-id="${escapeHtml(c.certificateId)}" type="button">Compartilhar</button><button class="small-button danger-button revoke-certificate" data-id="${escapeHtml(c.certificateId)}" type="button">Revogar</button>`}</div>
    </article>`;
  }).join('');
  document.querySelectorAll('.download-certificate').forEach(b => b.addEventListener('click', () => downloadCertificate(b.dataset.id)));
  document.querySelectorAll('.share-certificate').forEach(b => b.addEventListener('click', () => shareCertificate(b.dataset.id)));
  document.querySelectorAll('.revoke-certificate').forEach(b => b.addEventListener('click', () => revokeCertificateUi(b.dataset.id)));
}

async function issueCertificateForUnit(unitId, year, { download = true } = {}) {
  const unit = importedUnits.find(u => String(u.id) === String(unitId));
  if (!residentialData || !unit) throw new Error('DADOS_CADASTRAIS_INCOMPLETOS');
  if (activeCertificate(unitId, year)) throw new Error('DECLARACAO_VALIDA_JA_EXISTE');
  const obligations = ledger.filter(o => String(o.unitId) === String(unitId));
  const { record, pdfBytes } = await issueCertificateArtifact({
    residential: residentialData,
    unit: { id: unit.id, label: unit.label ?? `Apartamento ${unit.id}` },
    responsible: { name: unit.responsibleName ?? 'Responsável cadastrado' },
    year: Number(year), issuedAt: new Date().toISOString(), obligations,
  });
  await saveIssuedCertificate(record);
  certificates = await listCertificates();
  renderCertificateHistory();
  renderLedgerCompliance();
  if (download) downloadBytes(pdfBytes, record.fileName);
  return record;
}

async function revokeCertificateUi(certificateId) {
  const reason = window.prompt('Informe o motivo da revogação. O PDF original continuará registrado e não será editado:');
  if (reason == null) return;
  try {
    await revokeStoredCertificate(certificateId, reason);
    certificates = await listCertificates();
    renderCertificateHistory(); renderLedgerCompliance();
    $('#certificate-feedback').textContent = 'Declaração revogada. Para corrigir, faça uma nova emissão após ajustar os dados.';
  } catch (error) {
    $('#certificate-feedback').textContent = `Revogação não realizada: ${error.message}`;
  }
}

async function issueEligibleBatch() {
  const year = Number($('#compliance-year').value);
  if (!year) return;
  let issued = 0; let blocked = 0; let existing = 0;
  for (const unit of importedUnits) {
    if (activeCertificate(unit.id, year)) { existing += 1; continue; }
    const obligations = ledger.filter(o => String(o.unitId) === String(unit.id));
    const status = evaluateAnnualCompliance({ obligations, year });
    if (!status.eligible) { blocked += 1; continue; }
    try { await issueCertificateForUnit(unit.id, year, { download: false }); issued += 1; }
    catch { blocked += 1; }
  }
  $('#certificate-feedback').textContent = `${issued} declaração(ões) gerada(s), ${existing} já existente(s) e ${blocked} unidade(s) bloqueada(s). Use o histórico para baixar ou compartilhar cada PDF.`;
}

async function syncClosingDate() {
  const year = Number($('#compliance-year').value);
  if (!year) { $('#annual-closing-date').value = ''; return; }
  const saved = await getSetting(`annualClosingDate:${year}`, lastWeekdayOfYear(year));
  $('#annual-closing-date').value = saved;
}

async function saveClosingDate() {
  const year = Number($('#compliance-year').value);
  const date = $('#annual-closing-date').value;
  if (!year || !date) return;
  await setSetting(`annualClosingDate:${year}`, date);
  $('#certificate-feedback').textContent = `Fechamento anual de ${year} configurado para ${date}. Se o aplicativo for aberto nessa data ou depois, as unidades elegíveis poderão ser geradas em lote.`;
}

async function maybeAutoIssueCurrentYear() {
  const year = new Date().getFullYear();
  if (!ledger.some(o => Number(o.year) === year)) return;
  const closing = await getSetting(`annualClosingDate:${year}`, lastWeekdayOfYear(year));
  const today = new Date().toISOString().slice(0,10);
  if (today < closing) return;
  const previous = $('#compliance-year').value;
  $('#compliance-year').value = String(year);
  await issueEligibleBatch();
  if (previous) $('#compliance-year').value = previous;
}

async function validateCertificateFile() {
  const id = $('#validation-certificate').value;
  const file = $('#validation-file').files?.[0];
  const record = certificates.find(c => c.certificateId === id);
  if (!record || !file) { $('#validation-feedback').textContent = 'Selecione a declaração e o PDF recebido.'; return; }
  const check = await verifyCertificateRecord(record, new Uint8Array(await file.arrayBuffer()));
  if (check.valid) $('#validation-feedback').textContent = 'ÍNTEGRO E VÁLIDO: o arquivo corresponde ao PDF emitido e o registro não está revogado.';
  else if (record.status === 'REVOKED') $('#validation-feedback').textContent = 'ARQUIVO REGISTRADO, MAS DECLARAÇÃO REVOGADA. Não deve ser aceita como válida.';
  else if (check.fileIntegrity === false) $('#validation-feedback').textContent = 'FALHA DE INTEGRIDADE: o PDF não corresponde ao hash do arquivo originalmente emitido.';
  else $('#validation-feedback').textContent = 'FALHA DE INTEGRIDADE DO REGISTRO. A declaração não deve ser aceita.';
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
    const existing = activeCertificate(unit.id, year);
    let label = existing ? `Emitida: ${existing.certificateId}` : 'Elegível para emissão';
    if (!status.completeYear) label = 'Bloqueada: exercício incompleto no livro';
    else if (status.pending.length) label = `Bloqueada: ${status.pending.length} obrigação(ões) pendente(s)`;
    return `<article class="compliance-row"><div><strong>${escapeHtml(unit.label ?? unit.id)}</strong><span>${escapeHtml(unit.responsibleName ?? '')}</span></div><div class="compliance-actions"><span class="status-badge ${status.eligible?'ok':'attention'}">${escapeHtml(label)}</span>${status.eligible && !existing ? `<button class="small-button issue-certificate" data-unit="${escapeHtml(unit.id)}" data-year="${year}" type="button">Emitir PDF</button>` : ''}</div></article>`;
  }).join('');
  document.querySelectorAll('.issue-certificate').forEach(button => button.addEventListener('click', async () => {
    try {
      const record = await issueCertificateForUnit(button.dataset.unit, Number(button.dataset.year));
      $('#certificate-feedback').textContent = `Declaração ${record.certificateId} emitida e baixada. O original ficou preservado no histórico local.`;
    } catch (error) { $('#certificate-feedback').textContent = `Emissão bloqueada: ${error.message}`; }
  }));
}

async function refreshImportedData() {
  const [meta, residential, units, periods] = await Promise.all([getImportMeta(), getResidential(), listUnits(), listPeriods()]);
  residentialData = residential;
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
  $('#compliance-year').addEventListener('change', async () => { renderLedgerCompliance(); await syncClosingDate(); });
  $('#save-closing-date').addEventListener('click', saveClosingDate);
  $('#issue-eligible').addEventListener('click', issueEligibleBatch);
  $('#validate-certificate').addEventListener('click', validateCertificateFile);
  await syncClosingDate();
  await maybeAutoIssueCurrentYear();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
