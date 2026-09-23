import { evaluateProject } from './projections.js';
import {
  getSetting, setSetting, saveProjection, listProjections,
  replaceImportedData, getImportMeta, getResidential, listUnits, listPeriods,
  saveObligation, saveObligations, listObligations, registerObligationPayment,
  listCertificates, saveIssuedCertificate, revokeStoredCertificate, replacePrivateProfile,
  listPayments, listTransactions, saveTransaction, listMonthClosings, saveMonthClosing, reopenMonthClosing,
  exportDatabaseSnapshot, restoreDatabaseSnapshot, syncHistoricalClosings,
} from './db.js';
import { validateImportBundle, summarizeImport, summarizeByYear } from './migration.js';
import { evaluateAnnualCompliance, lastWeekdayOfYear } from './compliance.js';
import { issueCertificateArtifact, verifyCertificateRecord, base64ToBytes } from './certificates.js';
import { createSecurityCredential, verifySecurityCredential, nextSessionDeadline, unlockThrottleStatus, recordUnlockFailure, resetUnlockThrottle, SECURITY_DEFAULTS } from './security.js';
import { normalizePrivateProfile, privateProfileSummary } from './private-profile.js';
import { encryptSnapshot, decryptSnapshot } from './backup.js';
import { normalizeMovement, summarizeCompetence, createClosingRecord, reopenClosingRecord, previousCompetence, requiredExpenseStatus } from './closing.js';
import { buildMonthlyStatementPdf } from './statement-pdf.js';
import { escapeHtml } from './sanitize.js';
import {
  normalizeObligation, ledgerSummary, createMonthlyObligations,
  applyPayment, outstandingCents, cancelObligation, paymentTimestampFromDate,
} from './obligations.js';
import { buildResidentPayload, createActivationToken, encryptResidentPayload } from './resident-access.js';
import { startAdminAutoSync, getAdminSyncStatus } from './sync-client.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = cents => brl.format((cents ?? 0) / 100);
const toCents = value => Math.round((Number(String(value).replace(',', '.')) || 0) * 100);
const currentCompetenceKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const localDateValue = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const $ = selector => document.querySelector(selector);
let importedPeriods = [];
let importedUnits = [];
let ledger = [];
let residentialData = null;
let certificates = [];
let securityCredential = null;
let unlockedUntil = 0;
let securityTimer = null;
let hiddenAt = null;
let securitySetupMode = false;
let unlockThrottle = resetUnlockThrottle();
let payments = [];
let movements = [];
let monthClosings = [];

function normalDocumentTitle() {
  return residentialData?.name ? `Conta Certa — ${residentialData.name}` : 'Conta Certa';
}

function renderAdminSyncStatus(detail = {}) {
  const badge = $('#sync-status-badge');
  const description = $('#sync-status-detail');
  if (!badge || !description) return;
  const state = getAdminSyncStatus();
  let label = 'Local';
  let className = 'status-badge neutral';
  let text = 'Servidor não configurado';

  if (!navigator.onLine || detail.offline) {
    label = 'Offline';
    className = 'status-badge attention';
    text = 'Alterações ficam salvas neste aparelho';
  } else if (!state.apiConfigured || detail.reason === 'not-configured') {
    label = 'Local';
    text = 'Servidor não configurado';
  } else if (!state.authenticated || detail.reason === 'login-required') {
    label = 'Login necessário';
    className = 'status-badge attention';
    text = 'Abra Sincronização para autenticar';
  } else if (detail.syncing) {
    label = 'Sincronizando';
    className = 'status-badge attention';
    text = 'Enviando alterações ao servidor';
  } else if (detail.conflict) {
    label = 'Conflito';
    className = 'status-badge attention';
    text = 'Servidor possui uma versão mais nova';
  } else if (detail.ok === false) {
    label = 'Erro de sync';
    className = 'status-badge attention';
    text = detail.error || 'Não foi possível sincronizar';
  } else if (detail.ok || state.lastSyncAt) {
    label = 'Sincronizado';
    className = 'status-badge ok';
    const when = state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString('pt-BR') : '';
    text = when ? `Última sincronização: ${when}` : 'Dados enviados ao servidor';
  } else {
    label = 'Conectado';
    className = 'status-badge neutral';
    text = 'Aguardando primeira sincronização';
  }

  badge.textContent = label;
  badge.className = className;
  description.textContent = text;
}

function setupAdminSyncStatus() {
  window.addEventListener('conta-certa-sync', event => renderAdminSyncStatus(event.detail ?? {}));
  window.addEventListener('online', () => renderAdminSyncStatus({}));
  window.addEventListener('offline', () => renderAdminSyncStatus({ offline:true }));
  renderAdminSyncStatus({});
}

function hideSensitiveSnapshot() {
  document.body.classList.add('privacy-screen');
  document.title = 'Conta Certa';
}

function showSensitiveSnapshot() {
  if (unlockedUntil) document.body.classList.remove('privacy-screen');
  document.title = unlockedUntil ? normalDocumentTitle() : 'Conta Certa — Bloqueado';
}

function updateSecurityDeadline() {
  if (!unlockedUntil) return;
  unlockedUntil = nextSessionDeadline(Date.now(), SECURITY_DEFAULTS.sessionTtlMs);
  clearTimeout(securityTimer);
  securityTimer = setTimeout(() => lockApplication('Sessão encerrada por inatividade.'), SECURITY_DEFAULTS.sessionTtlMs + 50);
}

function setSecurityGate({ setup = false, message = '' } = {}) {
  securitySetupMode = setup;
  $('#security-title').textContent = setup ? 'Criar proteção do Conta Certa' : 'Conta Certa protegido';
  $('#security-help').textContent = setup
    ? 'Crie um PIN ou senha com pelo menos 6 caracteres. Ele será necessário para abrir os dados neste aparelho.'
    : 'Informe seu PIN ou senha para acessar os dados financeiros.';
  $('#security-submit').textContent = setup ? 'Criar proteção e entrar' : 'Desbloquear';
  $('#security-confirm-wrap').hidden = !setup;
  $('#security-secret').autocomplete = setup ? 'new-password' : 'current-password';
  $('#security-secret').value = '';
  $('#security-confirm').value = '';
  $('#security-feedback').textContent = message;
  $('#security-gate').hidden = false;
  document.body.classList.add('app-locked');
  document.body.classList.remove('privacy-screen');
  document.title = 'Conta Certa — Bloqueado';
  setTimeout(() => $('#security-secret').focus(), 50);
}

function unlockApplication() {
  unlockedUntil = nextSessionDeadline(Date.now(), SECURITY_DEFAULTS.sessionTtlMs);
  document.body.classList.remove('app-locked');
  document.body.classList.remove('privacy-screen');
  document.title = normalDocumentTitle();
  $('#security-gate').hidden = true;
  $('#security-feedback').textContent = '';
  updateSecurityDeadline();
}

function lockApplication(message = 'Aplicativo bloqueado.') {
  unlockedUntil = 0;
  clearTimeout(securityTimer);
  setSecurityGate({ setup: false, message });
}

async function handleSecuritySubmit(event) {
  event.preventDefault();
  const secret = $('#security-secret').value;
  $('#security-feedback').textContent = '';
  if (securitySetupMode) {
    if (secret !== $('#security-confirm').value) {
      $('#security-feedback').textContent = 'As duas entradas não conferem.';
      return;
    }
    try {
      securityCredential = await createSecurityCredential(secret);
      await setSetting('securityCredential', securityCredential);
      unlockApplication();
    } catch (error) {
      $('#security-feedback').textContent = error.message === 'SEGREDO_MUITO_CURTO'
        ? 'Use pelo menos 6 caracteres.' : `Não foi possível criar a proteção: ${error.message}`;
    }
    return;
  }
  const throttle = unlockThrottleStatus(unlockThrottle);
  if (throttle.blocked) {
    $('#security-feedback').textContent = `Muitas tentativas. Aguarde ${Math.ceil(throttle.remainingMs / 1000)} segundos.`;
    return;
  }
  const ok = await verifySecurityCredential(secret, securityCredential);
  if (!ok) {
    unlockThrottle = recordUnlockFailure(unlockThrottle, Date.now(), { maxAttempts: SECURITY_DEFAULTS.maxUnlockAttempts, cooldownMs: SECURITY_DEFAULTS.unlockCooldownMs });
    await setSetting('securityUnlockThrottle', { failedAttempts: unlockThrottle.failedAttempts, blockedUntil: unlockThrottle.blockedUntil });
    $('#security-feedback').textContent = unlockThrottle.blocked
      ? `Muitas tentativas incorretas. Acesso temporariamente bloqueado por ${Math.ceil(unlockThrottle.remainingMs / 1000)} segundos.`
      : `PIN ou senha incorretos. Tentativa ${unlockThrottle.failedAttempts} de ${SECURITY_DEFAULTS.maxUnlockAttempts}.`;
    $('#security-secret').select();
    return;
  }
  unlockThrottle = resetUnlockThrottle();
  await setSetting('securityUnlockThrottle', { failedAttempts: 0, blockedUntil: 0 });
  unlockApplication();
}

async function initializeSecurity() {
  securityCredential = await getSetting('securityCredential', null);
  unlockThrottle = unlockThrottleStatus(await getSetting('securityUnlockThrottle', { failedAttempts: 0, blockedUntil: 0 }));
  $('#security-form').addEventListener('submit', handleSecuritySubmit);
  const touch = () => { if (unlockedUntil) updateSecurityDeadline(); };
  ['pointerdown','keydown','touchstart'].forEach(name => document.addEventListener(name, touch, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      hideSensitiveSnapshot();
    } else {
      if (hiddenAt && Date.now() - hiddenAt >= SECURITY_DEFAULTS.backgroundGraceMs && unlockedUntil) lockApplication('Aplicativo bloqueado após ficar em segundo plano.');
      else showSensitiveSnapshot();
      hiddenAt = null;
    }
  });
  $('#lock-app').addEventListener('click', () => lockApplication());
  $('#lock-app-card').addEventListener('click', () => lockApplication());
  $('#change-security-secret').addEventListener('click', () => setSecurityGate({ setup: true, message: 'Defina a nova credencial. A alteração só vale neste aparelho.' }));
  if (securityCredential) setSecurityGate();
  else setSecurityGate({ setup: true });
  return new Promise(resolve => {
    const observer = new MutationObserver(() => {
      if ($('#security-gate').hidden) { observer.disconnect(); resolve(); }
    });
    observer.observe($('#security-gate'), { attributes: true, attributeFilter: ['hidden'] });
  });
}

async function importPrivateProfileFile() {
  const file = $('#private-profile-file').files?.[0];
  if (!file) { $('#private-profile-feedback').textContent = 'Selecione o arquivo privado do residencial.'; return; }
  try {
    const normalized = normalizePrivateProfile(JSON.parse(await file.text()));
    await replacePrivateProfile(normalized);
    const summary = privateProfileSummary(normalized);
    $('#private-profile-feedback').textContent = `Cadastro privado importado: ${summary.unitCount} unidade(s) e ${summary.phoneCount} telefone(s).`;
    $('#private-profile-state').textContent = 'Carregado';
    $('#private-profile-state').className = 'status-badge ok';
    await refreshImportedData();
  } catch (error) {
    $('#private-profile-feedback').textContent = `Cadastro privado não importado: ${error.message}`;
  }
}


function downloadJson(value, fileName) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function createEncryptedBackup() {
  const passphrase = $('#backup-passphrase').value;
  const confirmation = $('#backup-confirm').value;
  if (passphrase !== confirmation) { $('#backup-feedback').textContent = 'As senhas do backup não conferem.'; return; }
  try {
    const snapshot = await exportDatabaseSnapshot('0.11.0');
    const envelope = await encryptSnapshot(snapshot, passphrase);
    const stamp = new Date().toISOString().slice(0,10);
    downloadJson(envelope, `Conta_Certa_backup_${stamp}.ccbackup.json`);
    $('#backup-feedback').textContent = 'Backup criptografado gerado. Guarde o arquivo e a senha em locais seguros e separados.';
  } catch (error) {
    $('#backup-feedback').textContent = error.message === 'SENHA_BACKUP_MUITO_CURTA' ? 'Use pelo menos 8 caracteres para proteger o backup.' : `Backup não gerado: ${error.message}`;
  }
}

async function restoreEncryptedBackup() {
  const file = $('#restore-backup-file').files?.[0];
  const passphrase = $('#backup-passphrase').value;
  if (!file) { $('#backup-feedback').textContent = 'Selecione um arquivo .ccbackup.json.'; return; }
  if (!window.confirm('A restauração substituirá os dados locais do Conta Certa neste aparelho. A credencial de acesso atual será preservada. Continuar?')) return;
  try {
    const envelope = JSON.parse(await file.text());
    const snapshot = await decryptSnapshot(envelope, passphrase);
    await restoreDatabaseSnapshot(snapshot);
    $('#backup-feedback').textContent = 'Backup restaurado e validado. Recarregando os dados locais...';
    setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    $('#backup-feedback').textContent = error.message === 'BACKUP_SENHA_OU_INTEGRIDADE_INVALIDA'
      ? 'Restauração recusada: senha incorreta ou arquivo alterado/corrompido.'
      : `Restauração não realizada: ${error.message}`;
  }
}

function previousBalanceFor(competence) {
  const prior = previousCompetence(competence);
  const closing = monthClosings.find(c => c.competence === prior);
  if (closing?.status === 'reopened') return { blocked: true, source: 'reopened', competence: prior };
  if (closing?.status === 'closed') return { value: closing.closingBalanceCents, source: 'closing', competence: prior };
  const period = importedPeriods.find(p => p.id === prior);
  if (period?.calculated?.closingBalanceCents != null) return { value: period.calculated.closingBalanceCents, source: 'history', competence: prior };
  return { value: null, source: 'manual', competence: prior };
}

function movementRowsFor(competence) {
  const pay = payments.filter(p => String(p.paidAt ?? '').startsWith(competence)).map(p => ({
    kind: 'income', date: p.paidAt, description: p.description || `Pagamento - unidade ${p.unitId}`, amountCents: p.amountCents, source: 'Pagamento'
  }));
  const manual = movements.filter(m => m.competence === competence).map(m => ({...m, category: m.category, source: m.kind === 'income' ? 'Receita manual' : 'Despesa'}));
  return [...pay, ...manual].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}


const expenseLabelForCompetence = competence => {
  const [year, month] = String(competence).split('-').map(Number);
  const names = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${names[month - 1] ?? month}/${year}`;
};

function categoryKey(value) {
  return String(value ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().toLowerCase();
}

function findRequiredExpense(competence, category) {
  const wanted = categoryKey(category);
  return movements.find(m => m.competence === competence && m.kind === 'expense' && (
    categoryKey(m.category) === wanted ||
    (wanted === 'energia' && categoryKey(m.category).includes('energisa'))
  )) ?? null;
}

function renderRequiredExpenseForm({ disabled = false } = {}) {
  const competence = $('#closing-competence').value;
  if (!competence) return;
  const configs = [
    { category:'Água', amount:'#water-expense-amount', date:'#water-expense-date', status:'#water-expense-status', button:'#save-water-expense' },
    { category:'Energia', amount:'#energy-expense-amount', date:'#energy-expense-date', status:'#energy-expense-status', button:'#save-energy-expense' },
  ];

  for (const cfg of configs) {
    const item = findRequiredExpense(competence, cfg.category);
    const amount = $(cfg.amount);
    const date = $(cfg.date);
    const status = $(cfg.status);
    const button = $(cfg.button);
    if (!amount || !date || !status || !button) continue;
    amount.value = item ? (item.amountCents / 100).toFixed(2) : '';
    date.value = item?.date?.slice(0,10) || `${competence}-01`;
    status.textContent = item ? `Registrada • ${money(item.amountCents)}` : 'Pendente';
    status.className = `status-badge ${item ? 'ok' : 'attention'}`;
    amount.disabled = disabled;
    date.disabled = disabled;
    button.disabled = disabled;
    button.textContent = item ? `Atualizar ${cfg.category}` : `Registrar ${cfg.category}`;
  }

  for (const id of ['#other-expense-date','#other-expense-description','#other-expense-amount','#add-other-expense']) {
    const el = $(id);
    if (el) el.disabled = disabled;
  }
  const otherDate = $('#other-expense-date');
  if (otherDate && !otherDate.value) otherDate.value = `${competence}-01`;
}

async function saveRequiredExpense(category) {
  const competence = $('#closing-competence').value;
  const isWater = category === 'Água';
  const date = $(isWater ? '#water-expense-date' : '#energy-expense-date').value;
  const amountCents = toCents($(isWater ? '#water-expense-amount' : '#energy-expense-amount').value);
  if (!competence || !date || amountCents <= 0) {
    $('#closing-feedback').textContent = `Informe data e valor de ${category}.`;
    return;
  }
  try {
    const movement = normalizeMovement({
      id: `required-expense-${categoryKey(category)}-${competence}`,
      competence,
      date,
      kind: 'expense',
      category,
      description: `${category} — ${expenseLabelForCompetence(competence)}`,
      amountCents,
    });
    await saveTransaction(movement);
    $('#closing-feedback').textContent = `${category} registrada. Se corrigir o valor antes do fechamento, salve novamente para atualizar a mesma despesa.`;
    await refreshCashbook();
  } catch (error) {
    $('#closing-feedback').textContent = `Despesa não registrada: ${error.message}`;
  }
}

async function addOtherExpense() {
  const competence = $('#closing-competence').value;
  const date = $('#other-expense-date').value;
  const description = $('#other-expense-description').value.trim();
  const amountCents = toCents($('#other-expense-amount').value);
  if (!competence || !date || !description || amountCents <= 0) {
    $('#closing-feedback').textContent = 'Em Outras despesas, informe data, descrição e valor.';
    return;
  }
  try {
    const movement = normalizeMovement({
      id: crypto.randomUUID(),
      competence,
      date,
      kind: 'expense',
      category: 'Outros',
      description,
      amountCents,
    });
    await saveTransaction(movement);
    $('#other-expense-description').value = '';
    $('#other-expense-amount').value = '';
    $('#closing-feedback').textContent = 'Outra despesa adicionada. Você pode adicionar quantas forem necessárias nesta competência.';
    await refreshCashbook();
  } catch (error) {
    $('#closing-feedback').textContent = `Despesa não registrada: ${error.message}`;
  }
}

function renderClosingView() {
  const competence = $('#closing-competence').value;
  if (!competence) return;
  const existing = monthClosings.find(c => c.competence === competence) ?? null;
  const historical = existing?.status === 'closed' && existing?.source === 'historical_import';
  const openingInput = $('#closing-opening-balance');

  if (historical) {
    openingInput.value = (existing.openingBalanceCents / 100).toFixed(2);
    openingInput.readOnly = true;
    $('#opening-balance-source').textContent = 'Fechamento preservado da base histórica importada.';
    $('#closing-opening').textContent = money(existing.openingBalanceCents);
    $('#closing-revenue').textContent = money(existing.revenueCents);
    $('#closing-expense').textContent = money(existing.expenseCents);
    $('#closing-result').textContent = money(existing.resultCents);
    $('#closing-balance').textContent = money(existing.closingBalanceCents);
    const state = $('#closing-state');
    state.textContent = 'Fechado (histórico)';
    state.className = 'status-badge ok';
    $('#close-month').disabled = true;
    $('#reopen-month').disabled = true;
    $('#download-statement').disabled = true;
    $('#save-movement').disabled = true;
    renderRequiredExpenseForm({ disabled: true });
    $('#closing-movements').innerHTML = '<p class="muted">Competência encerrada no histórico importado. Consulte a aba Histórico para os detalhes da fonte original.</p>';
    $('#closing-feedback').textContent = 'Competência histórica bloqueada para novos lançamentos. Correções devem ser feitas na fonte histórica e reimportadas.';
    return;
  }

  const prior = previousBalanceFor(competence);
  if (prior.blocked) {
    openingInput.value = '';
    openingInput.readOnly = true;
    $('#closing-feedback').textContent = \`Não é possível fechar \${competence}: a competência anterior (\${prior.competence}) está reaberta.\`;
  } else if (prior.value != null) {
    openingInput.value = (prior.value / 100).toFixed(2);
    openingInput.readOnly = true;
    $('#opening-balance-source').textContent = prior.source === 'closing' ? \`Transportado do fechamento de \${prior.competence}\` : \`Transportado do histórico de \${prior.competence}\`;
  } else {
    if (!openingInput.value) openingInput.value = '0.00';
    openingInput.readOnly = false;
    $('#opening-balance-source').textContent = 'Sem competência anterior encontrada: informe o saldo inicial uma única vez.';
  }

  const summary = summarizeCompetence({competence, openingBalanceCents: toCents(openingInput.value), payments, movements});
  $('#closing-opening').textContent = money(summary.openingBalanceCents);
  $('#closing-revenue').textContent = money(summary.revenueCents);
  $('#closing-expense').textContent = money(summary.expenseCents);
  $('#closing-result').textContent = money(summary.resultCents);
  $('#closing-balance').textContent = money(summary.closingBalanceCents);
  const state = $('#closing-state');
  state.textContent = existing?.status === 'closed' ? \`Fechado - rev. \${existing.revision}\` : existing?.status === 'reopened' ? \`Reaberto - rev. \${existing.revision}\` : 'Em aberto';
  state.className = \`status-badge \${existing?.status === 'closed' ? 'ok' : existing?.status === 'reopened' ? 'attention' : 'neutral'}\`;
  const locked = existing?.status === 'closed';
  $('#close-month').disabled = Boolean(locked || prior.blocked);
  $('#reopen-month').disabled = existing?.status !== 'closed';
  $('#download-statement').disabled = existing?.status !== 'closed';
  $('#save-movement').disabled = locked;
  renderRequiredExpenseForm({ disabled: locked });

  const rows = movementRowsFor(competence);
  $('#closing-movements').innerHTML = rows.length ? rows.map(r => \`<article class="cash-row"><div><strong>\${escapeHtml(r.description)}</strong><small>\${escapeHtml(String(r.date).slice(0,10))} • \${escapeHtml(r.source)}\${r.category ? \` • \${escapeHtml(r.category)}\` : ''}</small></div><span class="\${r.kind === 'expense' ? 'negative' : 'positive'}">\${r.kind === 'expense' ? '-' : '+'} \${money(r.amountCents)}</span></article>\`).join('') : '<p class="muted">Nenhuma movimentação financeira nesta competência.</p>';
}

async function refreshCashbook() {
  [payments, movements, monthClosings] = await Promise.all([listPayments(), listTransactions(), listMonthClosings()]);
  movements = movements.map(normalizeMovement);
  monthClosings.sort((a,b)=>String(a.competence).localeCompare(String(b.competence)));
  renderClosingView();
}

async function addCashMovement() {
  const competence = $('#closing-competence').value;
  try {
    const movement = normalizeMovement({
      id: crypto.randomUUID(), competence,
      date: $('#movement-date').value,
      kind: $('#movement-kind').value,
      category: $('#movement-category').value,
      description: $('#movement-description').value,
      amountCents: toCents($('#movement-amount').value),
    });
    await saveTransaction(movement);
    $('#closing-feedback').textContent = movement.kind === 'expense' ? 'Despesa registrada.' : 'Receita registrada.';
    $('#movement-description').value = ''; $('#movement-amount').value = '';
    await refreshCashbook();
  } catch (error) { $('#closing-feedback').textContent = `Movimento não registrado: ${error.message}`; }
}

async function closeSelectedMonth() {
  const competence = $('#closing-competence').value;
  const required = requiredExpenseStatus(movements, competence);
  if (!required.complete) {
    $('#closing-feedback').textContent = `Fechamento bloqueado. Despesas obrigatórias ausentes: ${required.missing.join(' e ')}.`;
    return;
  }
  const prior = previousBalanceFor(competence);
  if (prior.blocked) { renderClosingView(); return; }
  try {
    const summary = summarizeCompetence({competence, openingBalanceCents: toCents($('#closing-opening-balance').value), payments, movements});
    const previousRecord = monthClosings.find(c => c.competence === competence) ?? null;
    const record = createClosingRecord({summary, previousRecord});
    await saveMonthClosing(record);
    $('#closing-feedback').textContent = `Competência ${competence} fechada. O saldo final ${money(record.closingBalanceCents)} será a abertura do mês seguinte.`;
    await refreshCashbook();
  } catch (error) { $('#closing-feedback').textContent = `Fechamento não realizado: ${error.message}`; }
}

async function reopenSelectedMonth() {
  const competence = $('#closing-competence').value;
  const current = monthClosings.find(c => c.competence === competence);
  if (!current) return;
  const reason = window.prompt('Informe o motivo da reabertura. O evento ficará registrado no histórico:');
  if (reason == null) return;
  try {
    await reopenMonthClosing(reopenClosingRecord(current, reason));
    $('#closing-feedback').textContent = `Competência ${competence} reaberta. Após a correção, feche novamente para criar uma nova revisão.`;
    await refreshCashbook();
  } catch (error) { $('#closing-feedback').textContent = `Reabertura não realizada: ${error.message}`; }
}

function downloadMonthlyStatement() {
  const competence = $('#closing-competence').value;
  const closing = monthClosings.find(c => c.competence === competence && c.status === 'closed');
  if (!closing) { $('#closing-feedback').textContent = 'A prestação de contas só pode ser gerada após o fechamento.'; return; }
  try {
    const bytes = buildMonthlyStatementPdf({residential: residentialData, closing, payments, movements});
    downloadBytes(bytes, `Conta_Certa_Prestacao_${competence}_rev${closing.revision}.pdf`);
    $('#closing-feedback').textContent = 'Prestação de contas mensal gerada em PDF.';
  } catch (error) { $('#closing-feedback').textContent = `PDF não gerado: ${error.message}`; }
}


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
    <label>Fornecedor / orçamento<input class="quote-supplier" value="${escapeHtml(seed.supplier ?? '')}" placeholder="Ex.: Orçamento A"></label>
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
  const comparison = $('#projection-comparison');
  if (comparison) comparison.textContent = project.quotes.length > 1
    ? `Diferença entre o menor e o maior custo planejado: ${money(project.comparison.spreadCents)}. O Conta Certa compara os cenários, mas não escolhe fornecedor.`
    : 'Adicione mais de um orçamento para comparar cenários sem escolher automaticamente um fornecedor.';
  for (const q of project.quotes) {
    const card = document.createElement('article');
    card.className = `quote-result ${q.canHireWithoutTouchingReserve ? 'ok' : 'attention'}`;
    const coverage = (q.coverageBasisPoints / 100).toFixed(2).replace('.', ',');
    const splitValues = [...new Set(q.suggestedSplitCents)].sort((a,b)=>b-a);
    const splitText = q.gapCents === 0 ? 'Não necessário' : splitValues.length === 1
      ? `${money(splitValues[0])} por unidade`
      : `${money(splitValues.at(-1))} a ${money(splitValues[0])} por unidade (soma exata ${money(q.suggestedSplitTotalCents)})`;
    card.innerHTML = `<div class="quote-title"><strong>${escapeHtml(q.supplier)}</strong><span>${money(q.plannedQuoteCents)}</span></div>
      <div class="meter" aria-label="${coverage}% do orçamento coberto"><span style="width:${Math.min(100, q.coverageBasisPoints / 100)}%"></span></div>
      <dl><div><dt>Preço informado</dt><dd>${money(q.quoteCents)}</dd></div><div><dt>Margem de contingência</dt><dd>${money(q.contingencyCents)}</dd></div><div><dt>Custo planejado</dt><dd>${money(q.plannedQuoteCents)}</dd></div><div><dt>Caixa atual</dt><dd>${money(q.cashBalanceCents)}</dd></div><div><dt>Reserva protegida</dt><dd>${money(q.protectedReserveCents)}</dd></div><div><dt>Compromissos já assumidos</dt><dd>${money(q.committedCents)}</dd></div><div><dt>Disponível para o projeto</dt><dd>${money(q.availableForProjectCents)}</dd></div><div><dt>Cobertura</dt><dd>${coverage}%</dd></div><div><dt>Saldo após pagamento</dt><dd>${money(q.projectedBalanceAfterPaymentCents)}</dd></div><div><dt>${q.gapCents ? 'Déficit a cobrir' : 'Situação'}</dt><dd>${q.gapCents ? money(q.gapCents) : 'Cabe no caixa disponível'}</dd></div><div><dt>Rateio de referência</dt><dd>${splitText}</dd></div></dl>`;
    result.appendChild(card);
  }
}

async function renderProjectionHistory() {
  const history = $('#projection-history');
  const items = (await listProjections()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!items.length) { history.innerHTML = '<p class="muted">Nenhuma projeção salva ainda.</p>'; return; }
  history.innerHTML = items.slice(0, 5).map(item => `<article class="history-item"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(new Date(item.createdAt).toLocaleString('pt-BR'))}</span><small>${Number(item.quotes?.length ?? 0)} orçamento(s) registrado(s)</small></article>`).join('');
}

async function calculateProjection(save = false) {
  const quotes = readQuotes();
  if (!quotes.length) { $('#projection-result').innerHTML = '<p class="warning">Informe pelo menos um orçamento com valor maior que zero.</p>'; return; }
  const name = $('#project-name').value.trim() || 'Projeto sem nome';
  const cashBalanceCents = toCents($('#cash-balance').value);
  const protectedReserveCents = toCents($('#protected-reserve').value);
  const committedCents = toCents($('#committed-amount').value);
  const contingencyBasisPoints = Math.round((Number($('#contingency-percent').value) || 0) * 100);
  const activeUnits = Number($('#active-units').value);
  const project = evaluateProject({ name, cashBalanceCents, protectedReserveCents, committedCents, contingencyBasisPoints, activeUnits, quotes });
  renderProjection(project);
  await Promise.all([setSetting('cashBalanceCents', cashBalanceCents), setSetting('protectedReserveCents', protectedReserveCents), setSetting('committedCents', committedCents), setSetting('contingencyBasisPoints', contingencyBasisPoints), setSetting('activeUnits', activeUnits)]);
  if (save) {
    await saveProjection({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), name, cashBalanceCents, protectedReserveCents, committedCents, contingencyBasisPoints, activeUnits, quotes });
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
    return `<article class="unit-row"><div><strong>${escapeHtml(unit.label ?? `Apartamento ${unit.id}`)}</strong><span>${escapeHtml(unit.responsibleName ?? 'Responsável não informado')}</span></div><small>${phones} telefone(s) cadastrado(s)</small></article>`;
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
  const options = importedUnits.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.label ?? `Apartamento ${u.id}`)}</option>`).join('');
  $('#obligation-unit').innerHTML = options || '<option value="">Importe/cadastre as unidades</option>';
  const residentSelect = $('#resident-access-unit');
  if (residentSelect) residentSelect.innerHTML = options || '<option value="">Importe/cadastre as unidades</option>';
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
    const cancellation = o.status === 'cancelled' && o.cancellationReason ? \`<small>Cancelamento: \${escapeHtml(o.cancellationReason)}</small>\` : '';
    const canCancel = o.status === 'open' && (o.paidCents ?? 0) === 0;
    return \`<article class="obligation-row">
      <div class="obligation-main"><strong>\${escapeHtml(unit?.label ?? \`Unidade \${o.unitId}\`)} • \${escapeHtml(kindLabel(o.kind))}</strong><span>\${escapeHtml(o.description ?? '')}</span><small>Vencimento: \${escapeHtml(o.dueDate ?? 'não informado')} • Total: \${money(o.amountCents)}\${o.paidCents ? \` • Pago: \${money(o.paidCents)}\` : ''}</small>\${cancellation}</div>
      <div class="obligation-actions"><span class="status-badge \${o.status === 'paid' ? 'ok' : o.status === 'cancelled' ? 'neutral' : 'attention'}">\${escapeHtml(statusLabel)}\${pending ? \` • falta \${money(pending)}\` : ''}</span>\${o.status !== 'paid' && o.status !== 'cancelled' ? \`<button type="button" class="small-button pay-obligation" data-id="\${escapeHtml(o.id)}">Registrar pagamento</button>\` : ''}\${canCancel ? \`<button type="button" class="small-button danger-button cancel-obligation" data-id="\${escapeHtml(o.id)}">Cancelar obrigação</button>\` : ''}</div>
    </article>\`;
  }).join('');
  document.querySelectorAll('.pay-obligation').forEach(button => button.addEventListener('click', () => payObligation(button.dataset.id)));
  document.querySelectorAll('.cancel-obligation').forEach(button => button.addEventListener('click', () => cancelObligationUi(button.dataset.id)));
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
  const receivedDate = window.prompt('Informe a data em que o pagamento foi recebido (AAAA-MM-DD):', '');
  if (receivedDate == null) return;
  const paymentCents = toCents(answer);
  try {
    const paidAt = paymentTimestampFromDate(receivedDate);
    const updated = applyPayment(obligation, paymentCents, paidAt);
    await registerObligationPayment({
      obligation: updated,
      payment: { id: crypto.randomUUID(), obligationId: id, unitId: obligation.unitId, amountCents: paymentCents, paidAt },
    });
    $('#obligation-feedback').textContent = updated.status === 'paid' ? 'Obrigação quitada na data informada.' : 'Pagamento parcial registrado na data informada.';
    await refreshLedger();
    await refreshCashbook();
  } catch (error) {
    $('#obligation-feedback').textContent = error.message === 'DATA_PAGAMENTO_INVALIDA'
      ? 'Pagamento não registrado: informe uma data válida no formato AAAA-MM-DD.'
      : `Pagamento não registrado: ${error.message}`;
  }
}

async function cancelObligationUi(id) {
  const obligation = ledger.find(o => o.id === id);
  if (!obligation) return;
  const reason = window.prompt('Informe o motivo do cancelamento. O registro continuará no histórico:', 'Lançamento de teste');
  if (reason == null) return;
  if (!window.confirm(\`Cancelar esta obrigação de \${money(obligation.amountCents)}? O registro ficará marcado como CANCELADO.\`)) return;
  try {
    const updated = cancelObligation(obligation, reason);
    await saveObligation(updated);
    $('#obligation-feedback').textContent = 'Obrigação cancelada. Ela deixou de compor as pendências e permaneceu registrada no histórico.';
    await refreshLedger();
  } catch (error) {
    $('#obligation-feedback').textContent = error.message === 'OBRIGACAO_COM_PAGAMENTO_NAO_PODE_SER_CANCELADA'
      ? 'Esta obrigação já possui pagamento. Para corrigi-la, será necessário um fluxo de estorno.'
      : error.message === 'COMPETENCIA_FECHADA'
        ? 'A competência desta obrigação está fechada e não pode ser alterada.'
        : error.message === 'MOTIVO_CANCELAMENTO_OBRIGATORIO'
          ? 'Informe um motivo com pelo menos 5 caracteres.'
          : \`Cancelamento não realizado: \${error.message}\`;
  }
}

async function generateResidentAccessPackage() {
  const unitId = $('#resident-access-unit').value;
  const unit = importedUnits.find(item => String(item.id) === String(unitId));
  if (!unit || !residentialData) {
    $('#resident-access-feedback').textContent = 'Importe o cadastro privado e selecione uma unidade.';
    return;
  }
  try {
    const payload = buildResidentPayload({
      residential: residentialData,
      unit,
      closings: monthClosings,
      movements,
      obligations: ledger,
      payments,
      certificates,
    });
    const activationToken = createActivationToken();
    const envelope = await encryptResidentPayload(payload, activationToken);
    const safeUnit = String(unit.label ?? unit.id).replace(/[^A-Za-z0-9_-]+/g, '_');
    downloadJson(envelope, `Conta_Certa_Morador_${safeUnit}_${localDateValue()}.ccresident.json`);
    $('#resident-access-token').textContent = activationToken;
    $('#resident-access-feedback').textContent = 'Arquivo criptografado gerado. Envie o arquivo e a chave de ativação diretamente ao morador. O acesso diário será feito com telefone cadastrado + PIN de 4 dígitos.';
  } catch (error) {
    $('#resident-access-feedback').textContent = error.message === 'UNIDADE_SEM_TELEFONE_AUTORIZADO'
      ? 'Esta unidade não possui telefone ativo no cadastro privado.'
      : `Pacote do morador não gerado: ${error.message}`;
  }
}

async function copyResidentActivationToken() {
  const token = $('#resident-access-token').textContent.trim();
  if (!token || token === '—') return;
  try {
    await navigator.clipboard.writeText(token);
    $('#resident-access-feedback').textContent = 'Chave de ativação copiada. Quando possível, envie a chave separadamente do arquivo.';
  } catch {
    $('#resident-access-feedback').textContent = 'Não foi possível copiar automaticamente. Selecione e copie a chave exibida.';
  }
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
  const privateMeta = await getSetting('privateProfileMeta', null);
  if (privateMeta && residential) {
    $('#private-profile-state').textContent = 'Carregado';
    $('#private-profile-state').className = 'status-badge ok';
  } else {
    $('#private-profile-state').textContent = 'Não carregado';
    $('#private-profile-state').className = 'status-badge neutral';
  }
  importedPeriods = periods.sort((a,b)=>a.id.localeCompare(b.id));
  await syncHistoricalClosings(importedPeriods, currentCompetenceKey());
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
  if (unlockedUntil) document.title = normalDocumentTitle();
  await refreshLedger();
}

async function importSelectedFile() {
  const file = $('#import-file').files?.[0];
  if (!file) { $('#import-feedback').textContent = 'Selecione o arquivo JSON de importação.'; return; }
  try {
    const bundle = JSON.parse(await file.text());
    validateImportBundle(bundle);
    const summary = summarizeImport(bundle);
    const privateMeta = await getSetting('privateProfileMeta', null);
    if (privateMeta) {
      const [currentResidential, currentUnits] = await Promise.all([getResidential(), listUnits()]);
      await replaceImportedData({ ...bundle, residential: currentResidential ?? bundle.residential, units: currentUnits.length ? currentUnits : bundle.units }, summary);
    } else {
      await replaceImportedData(bundle, summary);
    }
    $('#import-feedback').textContent = `Importação concluída: ${summary.periodCount} competências, ${summary.classifiedCount} classificadas e ${summary.reviewCount} em revisão manual.${privateMeta ? ' O cadastro privado foi preservado.' : ''}`;
    await refreshImportedData();
    await refreshCashbook();
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
  $('#closing-competence').value = competence;
  $('#movement-date').value = `${competence}-01`;
  $('#water-expense-date').value = `${competence}-01`;
  $('#energy-expense-date').value = `${competence}-01`;
  $('#other-expense-date').value = `${competence}-01`;
}

async function init() {
  await initializeSecurity();
  quoteRow({ supplier: 'Orçamento A' });
  initializeDates();
  $('#cash-balance').value = ((await getSetting('cashBalanceCents', 125872)) / 100).toFixed(2);
  $('#protected-reserve').value = ((await getSetting('protectedReserveCents', 0)) / 100).toFixed(2);
  $('#committed-amount').value = ((await getSetting('committedCents', 0)) / 100).toFixed(2);
  $('#contingency-percent').value = ((await getSetting('contingencyBasisPoints', 0)) / 100).toFixed(2);
  $('#active-units').value = await getSetting('activeUnits', 5);
  await renderProjectionHistory();
  await refreshImportedData();
  $('#add-quote').addEventListener('click', () => quoteRow());
  $('#calculate').addEventListener('click', () => calculateProjection(false));
  $('#save-projection').addEventListener('click', () => calculateProjection(true));
  $('#import-button').addEventListener('click', importSelectedFile);
  $('#private-profile-import').addEventListener('click', importPrivateProfileFile);
  $('#create-backup').addEventListener('click', createEncryptedBackup);
  $('#restore-backup').addEventListener('click', restoreEncryptedBackup);
  $('#closing-competence').addEventListener('change', async () => { const c=$('#closing-competence').value; $('#movement-date').value=`${c}-01`; $('#water-expense-date').value=`${c}-01`; $('#energy-expense-date').value=`${c}-01`; $('#other-expense-date').value=`${c}-01`; renderClosingView(); });
  $('#closing-opening-balance').addEventListener('input', renderClosingView);
  $('#save-movement').addEventListener('click', addCashMovement);
  $('#save-water-expense').addEventListener('click', () => saveRequiredExpense('Água'));
  $('#save-energy-expense').addEventListener('click', () => saveRequiredExpense('Energia'));
  $('#add-other-expense').addEventListener('click', addOtherExpense);
  $('#close-month').addEventListener('click', closeSelectedMonth);
  $('#reopen-month').addEventListener('click', reopenSelectedMonth);
  $('#download-statement').addEventListener('click', downloadMonthlyStatement);
  $('#save-obligation').addEventListener('click', addObligation);
  $('#generate-monthly').addEventListener('click', generateMonthlyBatch);
  $('#generate-resident-access').addEventListener('click', generateResidentAccessPackage);
  $('#copy-resident-token').addEventListener('click', copyResidentActivationToken);
  $('#compliance-year').addEventListener('change', async () => { renderLedgerCompliance(); await syncClosingDate(); });
  $('#save-closing-date').addEventListener('click', saveClosingDate);
  $('#issue-eligible').addEventListener('click', issueEligibleBatch);
  $('#validate-certificate').addEventListener('click', validateCertificateFile);
  await refreshCashbook();
  await syncClosingDate();
  await maybeAutoIssueCurrentYear();
  setupAdminSyncStatus();
  startAdminAutoSync();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(() => {});
  }
}

init();

