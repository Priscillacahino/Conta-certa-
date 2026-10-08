import {
  captureApiBaseUrlFromLocation, getApiBaseUrl, setApiBaseUrl,
  healthCheck, adminLogin, syncAdminNow, pullAdminNow, issueResidentActivation,
  clearAdminRemoteSession, listRemoteSessions, revokeRemoteSession,
} from './sync-client.js';

const $ = s => document.querySelector(s);
captureApiBaseUrlFromLocation();
$('#sync-api-url').value = getApiBaseUrl();

async function saveAndTest() {
  try {
    setApiBaseUrl($('#sync-api-url').value);
    const health = await healthCheck();
    $('#sync-feedback').textContent = `API disponível: ${health.service} ${health.version}.`;
  } catch (error) {
    $('#sync-feedback').textContent = `Não foi possível conectar: ${error.message}`;
  }
}

async function login() {
  try {
    setApiBaseUrl($('#sync-api-url').value);
    await adminLogin($('#sync-username').value, $('#sync-password').value);
    $('#sync-password').value = '';
    $('#sync-feedback').textContent = 'Administrador autenticado no servidor.';
    await loadSessions();
  } catch (error) {
    $('#sync-password').value = '';
    const retry = Number(error.data?.retryAfterSeconds || 0);
    $('#sync-feedback').textContent = error.status === 429 && retry
      ? `Login temporariamente bloqueado. Tente novamente em cerca de ${Math.ceil(retry / 60)} minuto(s).`
      : `Login não realizado: ${error.message}`;
  }
}

async function logout() {
  await clearAdminRemoteSession();
  $('#sync-feedback').textContent = 'Sessão remota encerrada também no servidor.';
  renderSessions([]);
}

async function sync() {
  try {
    const result = await syncAdminNow({ force:true });
    $('#sync-feedback').textContent = result.skipped
      ? 'Sincronização não realizada. Configure a API e autentique o administrador.'
      : `Sincronização concluída. Versão do servidor: ${result.syncVersion}.`;
  } catch (error) {
    $('#sync-feedback').textContent = error.status === 409
      ? 'O servidor possui uma versão mais nova. Não sobrescreva os dados antes de revisar o conflito.'
      : `Sincronização não concluída: ${error.message}`;
  }
}

async function pullFromServer() {
  if (!window.confirm('Restaurar a base central neste aparelho? A credencial local do administrador será preservada.')) return;
  try {
    const result = await pullAdminNow({ residentialId: $('#sync-residential-id').value.trim() });
    $('#sync-feedback').textContent = `Base restaurada do servidor. Versão: ${result.syncVersion}. Recarregando...`;
    setTimeout(() => window.location.href = './', 600);
  } catch (error) {
    $('#sync-feedback').textContent = `Restauração remota não concluída: ${error.message}`;
  }
}

async function activation() {
  try {
    const result = await issueResidentActivation({
      residentialId: $('#sync-residential-id').value,
      unitId: $('#sync-unit-id').value,
      phone: $('#sync-phone').value,
    });
    $('#activation-code').textContent = result.activationCode;
    $('#activation-feedback').textContent = `Código válido até ${new Date(result.expiresAt).toLocaleString('pt-BR')}. Gerar outro código invalida o anterior.`;
  } catch (error) {
    $('#activation-feedback').textContent = `Código não gerado: ${error.message}`;
  }
}

function renderSessions(items) {
  const box = $('#session-list');
  box.replaceChildren();
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Nenhuma sessão ativa carregada.';
    box.appendChild(p);
    return;
  }

  for (const item of items) {
    const article = document.createElement('article');
    article.className = 'resident-row';

    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.role === 'admin' ? `Administrador: ${item.actor || '—'}` : `Morador: ${item.actor || item.unitId || '—'}`;
    const meta = document.createElement('small');
    meta.textContent = `Criada em ${new Date(item.createdAt).toLocaleString('pt-BR')} • expira em ${new Date(item.expiresAt).toLocaleString('pt-BR')}${item.current ? ' • sessão atual' : ''}`;
    info.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'amount';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = item.current ? 'Revogar esta sessão' : 'Revogar';
    button.addEventListener('click', async () => {
      if (!window.confirm('Revogar esta sessão? O aparelho precisará autenticar novamente.')) return;
      try {
        await revokeRemoteSession(item.id);
        if (item.current) {
          await clearAdminRemoteSession({ revoke:false });
          $('#sync-feedback').textContent = 'Sessão atual revogada.';
          renderSessions([]);
        } else {
          await loadSessions();
        }
      } catch (error) {
        $('#sessions-feedback').textContent = `Não foi possível revogar: ${error.message}`;
      }
    });
    actions.appendChild(button);
    article.append(info, actions);
    box.appendChild(article);
  }
}

async function loadSessions() {
  try {
    const data = await listRemoteSessions();
    renderSessions(data.sessions || []);
    $('#sessions-feedback').textContent = `${(data.sessions || []).length} sessão(ões) ativa(s).`;
  } catch (error) {
    renderSessions([]);
    $('#sessions-feedback').textContent = `Sessões não carregadas: ${error.message}`;
  }
}

$('#sync-save-test').addEventListener('click', saveAndTest);
$('#sync-login').addEventListener('click', login);
$('#sync-now').addEventListener('click', sync);
$('#sync-pull').addEventListener('click', pullFromServer);
$('#sync-logout').addEventListener('click', logout);
$('#generate-online-activation').addEventListener('click', activation);
$('#refresh-sessions').addEventListener('click', loadSessions);
