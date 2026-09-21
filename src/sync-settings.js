import {
  captureApiBaseUrlFromLocation, getApiBaseUrl, setApiBaseUrl,
  healthCheck, adminLogin, syncAdminNow, pullAdminNow, issueResidentActivation,
  clearAdminRemoteSession,
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
    $('#sync-feedback').textContent = 'Administrador autenticado no servidor.';
  } catch (error) {
    $('#sync-feedback').textContent = `Login não realizado: ${error.message}`;
  }
}

async function sync() {
  try {
    const result = await syncAdminNow({ force:true });
    $('#sync-feedback').textContent = `Sincronização concluída. Versão do servidor: ${result.syncVersion}.`;
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
    $('#activation-feedback').textContent = `Código válido até ${new Date(result.expiresAt).toLocaleString('pt-BR')}.`;
  } catch (error) {
    $('#activation-feedback').textContent = `Código não gerado: ${error.message}`;
  }
}

$('#sync-save-test').addEventListener('click', saveAndTest);
$('#sync-login').addEventListener('click', login);
$('#sync-now').addEventListener('click', sync);
$('#sync-pull').addEventListener('click', pullFromServer);
$('#sync-logout').addEventListener('click', () => {
  clearAdminRemoteSession();
  $('#sync-feedback').textContent = 'Sessão remota removida deste navegador.';
});
$('#generate-online-activation').addEventListener('click', activation);
