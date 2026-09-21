# Changelog

## 0.11.0 — PostgreSQL e sincronização automática

- adiciona backend Django preparado para PostgreSQL/Neon;
- mantém IndexedDB como cache/offline;
- adiciona sincronização administrativa versionada e detecção de conflito;
- adiciona ativação online do morador por código temporário;
- mantém login cotidiano do morador por telefone + PIN de 4 dígitos;
- adiciona bloqueio de tentativas no servidor;
- impede acesso direto do navegador à credencial do PostgreSQL;
- adiciona página administrativa de configuração da sincronização;
- preserva o pacote .ccresident.json como contingência;
- adiciona testes do backend ao GitHub Actions.
## 0.10.0 â€” perfil do morador e data manual do pagamento

- pagamento passa a usar a data de recebimento informada pelo administrador;
- Ã¡rea do morador separada, somente leitura;
- primeira ativaÃ§Ã£o com pacote criptografado e chave aleatÃ³ria;
- login cotidiano com telefone cadastrado + PIN numÃ©rico de 4 dÃ­gitos;
- morador consulta suas obrigaÃ§Ãµes/pagamentos, fechamentos, despesas discriminadas e declaraÃ§Ãµes prÃ³prias;
- dados de outras unidades nÃ£o entram no pacote individual;
- atualizaÃ§Ã£o offline por novo pacote enviado pelo administrador;
- instalador e manifesto prÃ³prios para a Ã¡rea do morador.

## 0.9.7 â€” instalaÃ§Ã£o resiliente e distribuiÃ§Ã£o controlada

- forÃ§a atualizaÃ§Ã£o do Service Worker sem depender do cache HTTP;
- usa parÃ¢metro de versÃ£o nos arquivos crÃ­ticos da pÃ¡gina de instalaÃ§Ã£o e do aplicativo;
- abre o aplicativo com versÃ£o de navegaÃ§Ã£o atualizada;
- retira QR Codes e documentos com endereÃ§o de instalaÃ§Ã£o do repositÃ³rio pÃºblico;
- mantÃ©m o link e o QR Code para distribuiÃ§Ã£o privada pelo responsÃ¡vel do residencial;
- adiciona teste para impedir a republicaÃ§Ã£o acidental do endereÃ§o/QR na documentaÃ§Ã£o pÃºblica.

## 0.9.2
- revisÃ£o direta da planilha histÃ³rica concluiu maio/2023 e agosto/2023 sem criaÃ§Ã£o de lanÃ§amentos fictÃ­cios;
- maio/2023 classificado como `SOURCE_OPENING_RESET`;
- agosto/2023 classificado como `SOURCE_CARRYOVER_EXCLUDES_PRIOR_MONTH_MOVEMENT`;
- auditoria histÃ³rica passa a 106 competÃªncias `ok`, 18 `resolved`, 12 `legacy` e 0 `review`;
- teste de regressÃ£o garante que ajustes de transporte documentados nÃ£o voltam a exigir revisÃ£o manual.

## 0.9.1
- suÃ­te automatizada ampliada com cenÃ¡rios de seguranÃ§a, privacidade, backup, fechamento e sanitizaÃ§Ã£o;
- bloqueio temporÃ¡rio apÃ³s repetidas tentativas de PIN/senha;
- proteÃ§Ã£o visual imediata quando a PWA vai para segundo plano;
- sanitizaÃ§Ã£o reforÃ§ada de conteÃºdo dinÃ¢mico;
- minimizaÃ§Ã£o de campos no cadastro privado;
- validaÃ§Ã£o mais rÃ­gida do envelope de backup;
- Content Security Policy e `no-referrer`;
- Service Worker restrito a recursos estÃ¡ticos da mesma origem;
- auditoria pÃºblica executÃ¡vel com `npm run audit:privacy`.

## v0.9.0

- backup criptografado com PBKDF2/SHA-256 + AES-256-GCM;
- restauraÃ§Ã£o com validaÃ§Ã£o de integridade e preservaÃ§Ã£o da credencial local;
- livro de movimentaÃ§Ãµes de caixa;
- fechamento mensal com transporte de saldo;
- bloqueio de movimentos, pagamentos e novas obrigaÃ§Ãµes em competÃªncia fechada;
- reabertura justificada com trilha de eventos e revisÃ£o do fechamento;
- prestaÃ§Ã£o de contas mensal em PDF, com mÃºltiplas pÃ¡ginas quando necessÃ¡rio;
- projeÃ§Ãµes com compromissos assumidos, contingÃªncia e rateio exato em centavos;
- suÃ­te automatizada ampliada para 44 testes.

## v0.8.0

- proteÃ§Ã£o local por PIN/senha derivada com PBKDF2/SHA-256;
- sessÃ£o temporÃ¡ria e bloqueio por inatividade;
- importaÃ§Ã£o separada do cadastro privado do residencial.

