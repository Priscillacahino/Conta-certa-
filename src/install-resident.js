import { captureApiBaseUrlFromLocation } from './sync-client.js';
captureApiBaseUrlFromLocation();
let deferredPrompt = null;
const button = document.querySelector('#resident-install-button');
const feedback = document.querySelector('#resident-install-feedback');
const iosHelp = document.querySelector('#resident-ios-help');
const androidHelp = document.querySelector('#resident-android-help');
const openApp = document.querySelector('#resident-open-app');
const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => registration.update()).catch(() => {});
}

if (isStandalone) {
  button.textContent = 'Aplicativo jÃ¡ instalado';
  button.disabled = true;
  feedback.textContent = 'Abra o Conta Certa pela tela inicial.';
} else if (isIOS) {
  button.textContent = 'Como instalar no iPhone';
  button.disabled = false;
  iosHelp.hidden = false;
  feedback.textContent = 'No iPhone, use o menu Compartilhar do Safari.';
} else {
  button.textContent = 'Instalar Conta Certa â€” Morador';
  button.disabled = true;
  if (isAndroid) androidHelp.hidden = false;
  feedback.textContent = 'Aguardando o navegador disponibilizar a instalaÃ§Ã£oâ€¦';
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  button.disabled = false;
  feedback.textContent = 'Pronto para instalar.';
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  button.textContent = 'Instalado';
  button.disabled = true;
  feedback.textContent = 'InstalaÃ§Ã£o concluÃ­da.';
});

button.addEventListener('click', async () => {
  if (isIOS) { iosHelp.hidden = false; iosHelp.scrollIntoView({ behavior:'smooth', block:'center' }); return; }
  if (!deferredPrompt) {
    feedback.textContent = isAndroid ? 'Abra o menu do Chrome e escolha â€œInstalar appâ€ ou â€œAdicionar Ã  tela inicialâ€.' : 'Use a opÃ§Ã£o de instalaÃ§Ã£o do navegador.';
    return;
  }
  const prompt = deferredPrompt;
  deferredPrompt = null;
  button.disabled = true;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  feedback.textContent = choice.outcome === 'accepted' ? 'InstalaÃ§Ã£o confirmada.' : 'InstalaÃ§Ã£o cancelada.';
  if (choice.outcome !== 'accepted') button.disabled = false;
});

openApp.addEventListener('click', () => { window.location.href = './morador.html?v=0110'; });

setTimeout(() => {
  if (!isStandalone && !isIOS && !deferredPrompt) {
    button.disabled = false;
    button.textContent = 'Instalar / ver instruÃ§Ãµes';
  }
}, 1800);

