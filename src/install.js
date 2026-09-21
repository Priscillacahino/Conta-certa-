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
  feedback.textContent = 'O aplicativo jÃ¡ estÃ¡ instalado neste aparelho.';
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
  feedback.textContent = 'No iPhone, a instalaÃ§Ã£o Ã© feita pelo menu Compartilhar do Safari.';
} else {
  installButton.textContent = 'Instalar Conta Certa';
  installButton.disabled = true;
  if (isAndroid) androidHelp.hidden = false;
  feedback.textContent = 'Aguardando o navegador disponibilizar a instalaÃ§Ã£oâ€¦';
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
      ? 'Abra o menu do Chrome e escolha â€œInstalar appâ€ ou â€œAdicionar Ã  tela inicialâ€.'
      : 'Use a opÃ§Ã£o de instalaÃ§Ã£o disponÃ­vel no menu do seu navegador.';
    if (isAndroid) androidHelp.hidden = false;
    return;
  }

  installButton.disabled = true;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;

  if (choice.outcome === 'accepted') {
    feedback.textContent = 'InstalaÃ§Ã£o confirmada. O Conta Certa aparecerÃ¡ na tela inicial.';
  } else {
    feedback.textContent = 'InstalaÃ§Ã£o cancelada. VocÃª pode tentar novamente pelo menu do navegador.';
    installButton.disabled = false;
  }
});

openApp.addEventListener('click', () => {
  window.location.href = './?v=0110';
});

setTimeout(() => {
  if (!isStandalone && !isIOS && !deferredPrompt) {
    installButton.disabled = false;
    installButton.textContent = 'Instalar / ver instruÃ§Ãµes';
    feedback.textContent = isAndroid
      ? 'Se o botÃ£o nativo nÃ£o apareceu, use o menu do Chrome para instalar.'
      : 'Use a opÃ§Ã£o de instalaÃ§Ã£o do seu navegador.';
  }
}, 1800);

