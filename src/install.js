let deferredPrompt = null;

const $ = selector => document.querySelector(selector);
const installButton = $('#install-button');
const feedback = $('#install-feedback');
const iosHelp = $('#ios-help');
const androidHelp = $('#android-help');
const alreadyInstalled = $('#already-installed');
const openApp = $('#open-app');

const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function showInstalled() {
  installButton.hidden = true;
  alreadyInstalled.hidden = false;
  feedback.textContent = 'O aplicativo já está instalado neste aparelho.';
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(registration => registration.update())
    .catch(() => {});
}

if (isStandalone) {
  showInstalled();
} else if (isIOS) {
  installButton.textContent = 'Como instalar no iPhone';
  installButton.disabled = false;
  iosHelp.hidden = false;
  feedback.textContent = 'No iPhone, a instalação é feita pelo menu Compartilhar do Safari.';
} else {
  installButton.textContent = 'Instalar Conta Certa';
  installButton.disabled = true;
  if (isAndroid) androidHelp.hidden = false;
  feedback.textContent = 'Aguardando o navegador disponibilizar a instalação…';
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.hidden = false;
  installButton.disabled = false;
  installButton.textContent = 'Instalar Conta Certa';
  feedback.textContent = 'Pronto para instalar.';
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  showInstalled();
});

installButton.addEventListener('click', async () => {
  if (isIOS) {
    iosHelp.hidden = false;
    iosHelp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!deferredPrompt) {
    feedback.textContent = isAndroid
      ? 'Abra o menu do Chrome e escolha “Instalar app” ou “Adicionar à tela inicial”.'
      : 'Use a opção de instalação disponível no menu do seu navegador.';
    if (isAndroid) androidHelp.hidden = false;
    return;
  }

  installButton.disabled = true;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;

  if (choice.outcome === 'accepted') {
    feedback.textContent = 'Instalação confirmada. O Conta Certa aparecerá na tela inicial.';
  } else {
    feedback.textContent = 'Instalação cancelada. Você pode tentar novamente pelo menu do navegador.';
    installButton.disabled = false;
  }
});

openApp.addEventListener('click', () => {
  window.location.href = './?v=0100';
});

setTimeout(() => {
  if (!isStandalone && !isIOS && !deferredPrompt) {
    installButton.disabled = false;
    installButton.textContent = 'Instalar / ver instruções';
    feedback.textContent = isAndroid
      ? 'Se o botão nativo não apareceu, use o menu do Chrome para instalar.'
      : 'Use a opção de instalação do seu navegador.';
  }
}, 1800);
