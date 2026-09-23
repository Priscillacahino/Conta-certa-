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
  button.textContent = 'Aplicativo já instalado';
  button.disabled = true;
  feedback.textContent = 'Abra o Conta Certa pela tela inicial.';
} else if (isIOS) {
  button.textContent = 'Como instalar no iPhone';
  button.disabled = false;
  iosHelp.hidden = false;
  feedback.textContent = 'No iPhone, use o menu Compartilhar do Safari.';
} else {
  button.textContent = 'Instalar Conta Certa — Morador';
  button.disabled = true;
  if (isAndroid) androidHelp.hidden = false;
  feedback.textContent = 'Aguardando o navegador disponibilizar a instalação…';
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
  feedback.textContent = 'Instalação concluída.';
});

button.addEventListener('click', async () => {
  if (isIOS) { iosHelp.hidden = false; iosHelp.scrollIntoView({ behavior:'smooth', block:'center' }); return; }
  if (!deferredPrompt) {
    feedback.textContent = isAndroid ? 'Abra o menu do Chrome e escolha “Instalar app” ou “Adicionar à tela inicial”.' : 'Use a opção de instalação do navegador.';
    return;
  }
  const prompt = deferredPrompt;
  deferredPrompt = null;
  button.disabled = true;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  feedback.textContent = choice.outcome === 'accepted' ? 'Instalação confirmada.' : 'Instalação cancelada.';
  if (choice.outcome !== 'accepted') button.disabled = false;
});

openApp.addEventListener('click', () => { window.location.href = './morador.html?v=0111'; });

setTimeout(() => {
  if (!isStandalone && !isIOS && !deferredPrompt) {
    button.disabled = false;
    button.textContent = 'Instalar / ver instruções';
  }
}, 1800);

