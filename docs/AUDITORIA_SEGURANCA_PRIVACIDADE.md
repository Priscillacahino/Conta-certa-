# Auditoria de segurança e privacidade — v0.9.1

Esta revisão é voltada ao MVP local/offline do Conta Certa. Ela reduz riscos previsíveis, mas não transforma uma PWA local em cofre criptográfico contra um atacante com controle total do aparelho ou do perfil do navegador.

## Controles revisados e reforçados

- credencial administrativa derivada com PBKDF2-SHA-256 e salt aleatório; a senha/PIN não é armazenada em texto puro;
- limitação de tentativas incorretas com bloqueio temporário após repetidas falhas;
- sessão com expiração por inatividade e bloqueio ao permanecer em segundo plano;
- tela sensível escondida imediatamente quando o aplicativo vai para segundo plano, reduzindo exposição no alternador de aplicativos;
- cadastro privado com minimização de dados: campos extras não previstos são descartados na normalização;
- saída HTML dinâmica escapada nas áreas que exibem dados importados ou digitados pelo usuário;
- Content Security Policy local, política `no-referrer` e ausência de scripts externos;
- Service Worker restrito à mesma origem e aos recursos estáticos conhecidos, sem cache de arquivos privados;
- backups criptografados com AES-256-GCM e PBKDF2-SHA-256, com verificação de parâmetros e integridade;
- `securityCredential` excluída do backup e preservada no aparelho durante a restauração;
- `private/` e `*.private.json` continuam ignorados pelo Git;
- auditoria automatizada do pacote público disponível em `npm run audit:privacy`.

## Riscos residuais conhecidos

1. **Acesso físico/técnico ao aparelho:** quem controla o perfil do navegador, ferramentas de desenvolvedor ou armazenamento do aparelho pode tentar extrair o IndexedDB. O PIN do aplicativo é uma barreira de acesso local, não criptografia integral do banco em repouso.
2. **Limpeza dos dados do navegador:** remover os dados do site apaga a base local. Por isso o backup criptografado continua obrigatório para operação real.
3. **Mensageria externa:** compartilhamento de PDF usa recursos do aparelho; envio automático por WhatsApp/SMS não faz parte do núcleo offline.
4. **Hospedagem:** cabeçalhos HTTP adicionais (por exemplo HSTS e `frame-ancestors`) devem ser configurados no provedor de hospedagem quando a PWA for publicada. `frame-ancestors` não é efetivo via meta tag.
5. **Dispositivo comprometido:** malware, root/jailbreak ou extensões maliciosas ficam fora do modelo de proteção do MVP.

## Critério para seguir à implantação

Antes da v1.0, executar `npm run verify`, publicar apenas o pacote público, instalar em HTTPS e realizar teste real de bloqueio, funcionamento offline, backup/restauração e recuperação após limpeza de dados do navegador.
