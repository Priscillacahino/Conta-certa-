# Publicação e instalação da PWA

O Conta Certa pode ser publicado gratuitamente via GitHub Pages e servido por HTTPS.

## Publicação

O workflow `.github/workflows/pages.yml` executa `npm run verify` antes de publicar. Se os testes ou a auditoria de privacidade falharem, a publicação é interrompida.

O pacote publicado contém somente os arquivos de execução necessários:
- `index.html`
- `styles.css`
- `manifest.webmanifest`
- `sw.js`
- `assets/`
- `icons/`
- `src/`

Dados privados não são incluídos.

## URL esperada

Após a primeira publicação, a URL padrão tende a ser:

`https://priscillacahino.github.io/Conta-certa-/`

## Instalação no celular

### Android / Chrome
1. Abra a URL publicada.
2. Abra o menu do navegador.
3. Toque em **Instalar app** ou **Adicionar à tela inicial**.
4. Confirme.

### iPhone / Safari
1. Abra a URL no Safari.
2. Toque em **Compartilhar**.
3. Escolha **Adicionar à Tela de Início**.
4. Confirme.

## Funcionamento offline

Depois que a PWA é carregada, o Service Worker mantém os recursos essenciais em cache. Os dados financeiros permanecem no IndexedDB local do navegador/aparelho.

A primeira abertura precisa de conexão para baixar a aplicação publicada. Depois disso, o núcleo foi projetado para continuar operando offline.
