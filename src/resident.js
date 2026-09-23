import { decryptResidentPackage, createResidentVault, openResidentVault, residentOutstandingCents, normalizePhoneDigits, validateResidentPin } from './resident-access.js';
import { getResidentVault, setResidentVault, clearResidentAccess } from './resident-store.js';
import { escapeHtml } from './sanitize.js';
import { captureApiBaseUrlFromLocation, activateResidentRemote, refreshResidentRemote, getApiBaseUrl, clearResidentRemoteSession } from './sync-client.js';

const $ = selector => document.querySelector(selector);
captureApiBaseUrlFromLocation();
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = cents => brl.format((Number(cents) || 0) / 100);
const LOGIN_THROTTLE_KEY = 'conta-certa-resident-login-throttle';
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 5 * 60 * 1000;
let residentPayload = null;
let unlockedPhone = '';
let unlockedPin = '';
let hiddenAt = null;
const BACKGROUND_GRACE_MS = 2 * 60 * 1000;
const RESIDENT_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
let residentRefreshing = false;
let residentAutoRefreshTimer = null;

function formatDate(value) {
  const text = String(value ?? '').slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text || '—';
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
}

function kindLabel(kind) {
  return ({ monthly_contribution:'Mensalidade', extraordinary_fee:'Taxa extraordinária', installment:'Parcelamento', other:'Outra obrigação' })[kind] ?? kind;
}

function statusLabel(status) {
  return ({ paid:'Quitada', partial:'Parcial', open:'Em aberto', cancelled:'Cancelada' })[status] ?? status;
}

function readThrottle() {
  try { return JSON.parse(localStorage.getItem(LOGIN_THROTTLE_KEY) || '{}'); } catch { return {}; }
}

function throttleStatus(now = Date.now()) {
  const state = readThrottle();
  const blockedUntil = Number(state.blockedUntil) || 0;
  if (blockedUntil > now) return { blocked:true, remainingMs:blockedUntil-now, failedAttempts:Number(state.failedAttempts)||0 };
  return { blocked:false, remainingMs:0, failedAttempts:blockedUntil ? 0 : Number(state.failedAttempts)||0 };
}

function recordFailure() {
  const current = throttleStatus();
  if (current.blocked) return current;
  const failedAttempts = current.failedAttempts + 1;
  const blockedUntil = failedAttempts >= MAX_ATTEMPTS ? Date.now() + COOLDOWN_MS : 0;
  const next = { failedAttempts, blockedUntil };
  localStorage.setItem(LOGIN_THROTTLE_KEY, JSON.stringify(next));
  return throttleStatus();
}

function resetThrottle() { localStorage.removeItem(LOGIN_THROTTLE_KEY); }

function showGate(mode) {
  document.body.classList.add('resident-locked');
  $('#resident-gate').hidden = false;
  $('#resident-login-panel').hidden = mode !== 'login';
  $('#resident-activation-panel').hidden = mode !== 'activate';
}

function unlockUi() {
  document.body.classList.remove('resident-locked');
  document.body.classList.remove('resident-privacy-screen');
  $('#resident-gate').hidden = true;
  renderAll();
  startResidentAutoRefresh();
}

function lockUi(message = '') {
  stopResidentAutoRefresh();
  residentPayload = null;
  unlockedPhone = '';
  unlockedPin = '';
  document.body.classList.add('resident-locked');
  document.body.classList.remove('resident-privacy-screen');
  $('#resident-gate').hidden = false;
  $('#resident-login-panel').hidden = false;
  $('#resident-activation-panel').hidden = true;
  $('#resident-login-pin').value = '';
  $('#resident-login-feedback').textContent = message;
}

function setResidentView(name) {
  document.querySelectorAll('.resident-view').forEach(view => view.classList.toggle('active', view.id === `resident-view-${name}`));
  document.querySelectorAll('.resident-nav-button').forEach(button => button.classList.toggle('active', button.dataset.view === name));
}

function renderHome() {
  const closings = [...(residentPayload.closings ?? [])].sort((a,b) => String(a.competence).localeCompare(String(b.competence)));
  const latest = closings.at(-1) ?? null;
  const outstanding = residentOutstandingCents(residentPayload);
  $('#resident-header-unit').textContent = residentPayload.unit.label;
  $('#resident-welcome').textContent = residentPayload.unit.responsibleName ? `Olá, ${residentPayload.unit.responsibleName}` : residentPayload.unit.label;
  $('#resident-residential-name').textContent = `${residentPayload.residential.name} • ${residentPayload.unit.label}`;
  $('#resident-updated-at').textContent = `Dados gerados pelo administrador em ${formatDateTime(residentPayload.generatedAt)}.`;
  $('#resident-latest-balance').textContent = latest ? money(latest.closingBalanceCents) : '—';
  $('#resident-latest-period').textContent = latest ? `Competência ${latest.competence}` : 'Sem competência fechada';
  $('#resident-outstanding').textContent = money(outstanding);
  $('#resident-status').textContent = outstanding > 0 ? 'Há pendência' : 'Sem pendência no pacote';
  $('#resident-status').className = outstanding > 0 ? 'resident-status-pending' : 'resident-status-ok';
}

function renderObligations() {
  const box = $('#resident-obligations');
  const obligations = [...(residentPayload.obligations ?? [])].sort((a,b) => String(b.dueDate).localeCompare(String(a.dueDate)));
  if (!obligations.length) { box.innerHTML = '<p class="muted">Nenhuma obrigação disponibilizada para esta unidade.</p>'; return; }
  box.innerHTML = `<div class="resident-list">${obligations.map(item => {
    const outstanding = item.status === 'cancelled' ? 0 : Math.max(0, (item.amountCents || 0) - (item.paidCents || 0));
    return `<article class="resident-row"><div><strong>${escapeHtml(kindLabel(item.kind))}</strong><span>${escapeHtml(item.description || '')}</span><small>Vencimento: ${escapeHtml(formatDate(item.dueDate))} • ${escapeHtml(statusLabel(item.status))}${item.paidCents ? ` • Pago: ${money(item.paidCents)}` : ''}</small></div><div class="amount"><strong>${money(item.amountCents)}</strong>${outstanding ? `<small>Falta ${money(outstanding)}</small>` : ''}</div></article>`;
  }).join('')}</div>`;
}

function renderClosingSelector() {
  const select = $('#resident-closing-select');
  const closings = [...(residentPayload.closings ?? [])].sort((a,b) => String(b.competence).localeCompare(String(a.competence)));
  if (!closings.length) {
    select.innerHTML = '<option value="">Sem competências fechadas</option>';
    renderClosing(null);
    return;
  }
  const previous = select.value;
  select.innerHTML = closings.map(item => `<option value="${escapeHtml(item.competence)}">${escapeHtml(item.competence)}</option>`).join('');
  if (previous && closings.some(item => item.competence === previous)) select.value = previous;
  renderClosing(closings.find(item => item.competence === select.value) ?? closings[0]);
}

function renderClosing(closing) {
  for (const [id,value] of [
    ['#resident-opening', closing?.openingBalanceCents], ['#resident-revenue', closing?.revenueCents],
    ['#resident-expense', closing?.expenseCents], ['#resident-result', closing?.resultCents], ['#resident-closing-balance', closing?.closingBalanceCents]
  ]) $(id).textContent = closing ? money(value) : '—';
  const box = $('#resident-expenses');
  if (!closing) { box.innerHTML = '<p class="muted">Nenhuma competência fechada.</p>'; return; }
  const expenses = closing.expenses ?? [];
  if (!expenses.length) {
    box.innerHTML = closing.source === 'historical_import'
      ? '<p class="muted">A competência histórica possui os totais preservados, mas a discriminação dos itens não estava disponível no banco operacional.</p>'
      : '<p class="muted">Nenhuma despesa discriminada nesta competência.</p>';
    return;
  }
  box.innerHTML = `<div class="resident-list">${expenses.map(item => `<article class="resident-row"><div><strong>${escapeHtml(item.category || 'Despesa')}</strong><span>${escapeHtml(item.description || '')}</span><small>${escapeHtml(formatDate(item.date))}</small></div><div class="amount"><strong>${money(item.amountCents)}</strong></div></article>`).join('')}</div>`;
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

function downloadCertificate(certificateId) {
  const record = (residentPayload.certificates ?? []).find(item => item.certificateId === certificateId);
  if (!record?.pdfBase64) return;
  const blob = new Blob([base64ToBytes(record.pdfBase64)], { type:'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = record.fileName || `${certificateId}.pdf`; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function renderDocuments() {
  const box = $('#resident-documents');
  const docs = [...(residentPayload.certificates ?? [])].sort((a,b) => Number(b.year)-Number(a.year));
  if (!docs.length) { box.innerHTML = '<p class="muted">Nenhuma declaração disponibilizada para esta unidade.</p>'; return; }
  box.innerHTML = `<div class="resident-list">${docs.map(item => `<article class="resident-row"><div><strong>Declaração ${escapeHtml(String(item.year))}</strong><span>${escapeHtml(item.certificateId)}</span><small>${escapeHtml(item.status === 'VALID' ? 'Válida' : 'Revogada')} • emitida em ${escapeHtml(formatDate(item.issuedAt))}</small></div><div class="amount">${item.pdfBase64 ? `<button type="button" class="secondary resident-doc-button" data-certificate="${escapeHtml(item.certificateId)}">Baixar PDF</button>` : ''}</div></article>`).join('')}</div>`;
  document.querySelectorAll('[data-certificate]').forEach(button => button.addEventListener('click', () => downloadCertificate(button.dataset.certificate)));
}

function renderAll() {
  if (!residentPayload) return;
  renderHome();
  renderObligations();
  renderClosingSelector();
  renderDocuments();
}

async function refreshResidentFromServer({ silent = true } = {}) {
  if (residentRefreshing || !residentPayload || !unlockedPhone || !unlockedPin) return false;
  if (!getApiBaseUrl() || !navigator.onLine) {
    if (!silent && $('#resident-online-feedback')) {
      $('#resident-online-feedback').textContent = getApiBaseUrl()
        ? 'Sem conexão com a internet. Os últimos dados permanecem disponíveis no aparelho.'
        : 'Servidor online ainda não configurado neste aparelho.';
    }
    return false;
  }
  residentRefreshing = true;
  try {
    const fresh = await refreshResidentRemote({ phone: unlockedPhone, pin: unlockedPin });
    if (String(fresh?.unit?.id ?? '') !== String(residentPayload?.unit?.id ?? '')) {
      throw new Error('ATUALIZACAO_DE_OUTRA_UNIDADE');
    }
    const freshVault = await createResidentVault(fresh, unlockedPhone, unlockedPin);
    await setResidentVault(freshVault);
    residentPayload = fresh;
    renderAll();
    if (!silent && $('#resident-online-feedback')) {
      $('#resident-online-feedback').textContent = 'Dados atualizados com o servidor.';
    }
    return true;
  } catch (error) {
    if (!silent && $('#resident-online-feedback')) {
      $('#resident-online-feedback').textContent = `Atualização online não concluída: ${error.message}`;
    }
    return false;
  } finally {
    residentRefreshing = false;
  }
}

function stopResidentAutoRefresh() {
  if (residentAutoRefreshTimer) clearInterval(residentAutoRefreshTimer);
  residentAutoRefreshTimer = null;
}

function startResidentAutoRefresh() {
  stopResidentAutoRefresh();
  residentAutoRefreshTimer = setInterval(() => {
    if (!document.hidden) refreshResidentFromServer({ silent:true });
  }, RESIDENT_REFRESH_INTERVAL_MS);
}

async function activateResident(event) {
  event.preventDefault();
  const file = $('#resident-package-file').files?.[0];
  const onlineCode = $('#resident-online-code')?.value.trim() || '';
  const token = $('#resident-activation-token').value.trim();
  const phone = $('#resident-activation-phone').value;
  const pin = $('#resident-new-pin').value;
  const confirm = $('#resident-confirm-pin').value;
  if (pin !== confirm) { $('#resident-activation-feedback').textContent = 'As senhas de 4 dígitos não conferem.'; return; }
  try {
    validateResidentPin(pin);
    const normalizedPhone = normalizePhoneDigits(phone);
    let payload;
    if (onlineCode && getApiBaseUrl()) {
      payload = await activateResidentRemote({ phone: normalizedPhone, activationCode: onlineCode, pin });
    } else {
      if (!file) { $('#resident-activation-feedback').textContent = 'Selecione o arquivo de acesso ou informe um código de ativação online.'; return; }
      payload = await decryptResidentPackage(JSON.parse(await file.text()), token);
    }
    const vault = await createResidentVault(payload, normalizedPhone, pin);
    await setResidentVault(vault);
    resetThrottle();
    residentPayload = payload;
    unlockedPhone = normalizedPhone;
    unlockedPin = pin;
    $('#resident-activation-feedback').textContent = '';
    unlockUi();
  } catch (error) {
    const message = ({
      TELEFONE_NAO_AUTORIZADO:'Este telefone não consta como autorizado no cadastro desta unidade.',
      PIN_MORADOR_INVALIDO:'A senha deve ter exatamente 4 números.',
      PACOTE_MORADOR_CHAVE_INVALIDA:'Arquivo ou chave de ativação inválidos.',
      TOKEN_ATIVACAO_INVALIDO:'Chave de ativação inválida.',
      ATIVACAO_INVALIDA:'Código de ativação online inválido ou expirado.',
    })[error.message] ?? `Ativação não concluída: ${error.message}`;
    $('#resident-activation-feedback').textContent = message;
  }
}
async function loginResident(event) {
  event.preventDefault();
  const throttle = throttleStatus();
  if (throttle.blocked) {
    $('#resident-login-feedback').textContent = `Muitas tentativas incorretas. Aguarde ${Math.ceil(throttle.remainingMs / 60000)} minuto(s).`;
    return;
  }
  try {
    const vault = await getResidentVault();
    if (!vault) { showGate('activate'); return; }
    const phone = normalizePhoneDigits($('#resident-login-phone').value);
    const pin = validateResidentPin($('#resident-login-pin').value);
    residentPayload = await openResidentVault(vault, phone, pin);
    unlockedPhone = phone;
    unlockedPin = pin;
    resetThrottle();
    $('#resident-login-feedback').textContent = '';
    unlockUi();
    await refreshResidentFromServer({ silent:true });
  } catch (error) {
    const state = recordFailure();
    $('#resident-login-feedback').textContent = state.blocked
      ? 'Acesso temporariamente bloqueado após 5 tentativas incorretas. Tente novamente em 5 minutos.'
      : `Telefone ou senha incorretos. Tentativa ${state.failedAttempts} de ${MAX_ATTEMPTS}.`;
  }
}

async function updateResidentData(event) {
  event.preventDefault();
  const file = $('#resident-update-file').files?.[0];
  const token = $('#resident-update-token').value.trim();
  const phone = $('#resident-update-phone').value;
  const pin = $('#resident-update-pin').value;
  if (!file) { $('#resident-update-feedback').textContent = 'Selecione o novo arquivo enviado pelo administrador.'; return; }
  try {
    const currentVault = await getResidentVault();
    await openResidentVault(currentVault, phone, pin);
    const payload = await decryptResidentPackage(JSON.parse(await file.text()), token);
    if (String(payload.unit.id) !== String(residentPayload.unit.id)) throw new Error('PACOTE_DE_OUTRA_UNIDADE');
    const newVault = await createResidentVault(payload, phone, pin);
    await setResidentVault(newVault);
    residentPayload = payload;
    unlockedPhone = normalizePhoneDigits(phone);
    unlockedPin = pin;
    $('#resident-update-feedback').textContent = 'Dados atualizados com sucesso.';
    renderAll();
  } catch (error) {
    $('#resident-update-feedback').textContent = error.message === 'PACOTE_DE_OUTRA_UNIDADE'
      ? 'O arquivo pertence a outra unidade.'
      : `Atualização não concluída: ${error.message}`;
  }
}

async function clearAccess() {
  if (!window.confirm('Remover o acesso do morador e os dados locais deste aparelho? Para usar novamente será necessária uma nova ativação.')) return;
  await clearResidentAccess();
  clearResidentRemoteSession();
  resetThrottle();
  residentPayload = null;
  unlockedPhone = '';
  unlockedPin = '';
  showGate('activate');
}

async function init() {
  document.querySelectorAll('.resident-nav-button').forEach(button => button.addEventListener('click', () => setResidentView(button.dataset.view)));
  $('#resident-activation-form').addEventListener('submit', activateResident);
  $('#resident-login-form').addEventListener('submit', loginResident);
  $('#resident-update-form').addEventListener('submit', updateResidentData);
  $('#resident-clear-access').addEventListener('click', clearAccess);
  $('#resident-lock').addEventListener('click', () => lockUi('Acesso bloqueado.'));
  $('#resident-refresh-online')?.addEventListener('click', () => refreshResidentFromServer({ silent:false }));
  window.addEventListener('online', () => refreshResidentFromServer({ silent:true }));
  window.addEventListener('focus', () => refreshResidentFromServer({ silent:true }));
  $('#resident-closing-select').addEventListener('change', () => renderClosing((residentPayload?.closings ?? []).find(item => item.competence === $('#resident-closing-select').value) ?? null));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      document.body.classList.add('resident-privacy-screen');
    } else {
      document.body.classList.remove('resident-privacy-screen');
      if (hiddenAt && Date.now() - hiddenAt >= BACKGROUND_GRACE_MS && residentPayload) lockUi('Aplicativo bloqueado após ficar em segundo plano.');
      else if (residentPayload) refreshResidentFromServer({ silent:true });
      hiddenAt = null;
    }
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { updateViaCache:'none' }).then(registration => registration.update()).catch(() => {});
  const vault = await getResidentVault();
  showGate(vault ? 'login' : 'activate');
}

init();

