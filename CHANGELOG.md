# Changelog

## 0.11.1 — estabilidade da sincronização

- corrige BOM UTF-8 e textos com codificação corrompida;
- adiciona auditoria automática contra regressão de encoding;
- completa a ativação online do morador por código temporário;
- mantém pacote criptografado como contingência offline;
- adiciona atualização do morador ao reconectar, focar ou retornar ao aplicativo;
- reutiliza sessão remota do morador para consultar o snapshot sem criar login a cada atualização;
- exibe estado da sincronização no painel administrativo;
- atualiza o cache da PWA e amplia os testes de contrato da sincronização.


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
## 0.10.0 — perfil do morador e data manual do pagamento

- pagamento passa a usar a data de recebimento informada pelo administrador;
- área do morador separada, somente leitura;
- primeira ativação com pacote criptografado e chave aleatória;
- login cotidiano com telefone cadastrado + PIN numérico de 4 dígitos;
- morador consulta suas obrigações/pagamentos, fechamentos, despesas discriminadas e declarações próprias;
- dados de outras unidades não entram no pacote individual;
- atualização offline por novo pacote enviado pelo administrador;
- instalador e manifesto próprios para a área do morador.

## 0.9.7 — instalação resiliente e distribuição controlada

- força atualização do Service Worker sem depender do cache HTTP;
- usa parâmetro de versão nos arquivos críticos da página de instalação e do aplicativo;
- abre o aplicativo com versão de navegação atualizada;
- retira QR Codes e documentos com endereço de instalação do repositório público;
- mantém o link e o QR Code para distribuição privada pelo responsável do residencial;
- adiciona teste para impedir a republicação acidental do endereço/QR na documentação pública.

## 0.9.2
- revisão direta da planilha histórica concluiu maio/2023 e agosto/2023 sem criação de lançamentos fictícios;
- maio/2023 classificado como `SOURCE_OPENING_RESET`;
- agosto/2023 classificado como `SOURCE_CARRYOVER_EXCLUDES_PRIOR_MONTH_MOVEMENT`;
- auditoria histórica passa a 106 competências `ok`, 18 `resolved`, 12 `legacy` e 0 `review`;
- teste de regressão garante que ajustes de transporte documentados não voltam a exigir revisão manual.

## 0.9.1
- suíte automatizada ampliada com cenários de segurança, privacidade, backup, fechamento e sanitização;
- bloqueio temporário após repetidas tentativas de PIN/senha;
- proteção visual imediata quando a PWA vai para segundo plano;
- sanitização reforçada de conteúdo dinâmico;
- minimização de campos no cadastro privado;
- validação mais rígida do envelope de backup;
- Content Security Policy e `no-referrer`;
- Service Worker restrito a recursos estáticos da mesma origem;
- auditoria pública executável com `npm run audit:privacy`.

## v0.9.0

- backup criptografado com PBKDF2/SHA-256 + AES-256-GCM;
- restauração com validação de integridade e preservação da credencial local;
- livro de movimentações de caixa;
- fechamento mensal com transporte de saldo;
- bloqueio de movimentos, pagamentos e novas obrigações em competência fechada;
- reabertura justificada com trilha de eventos e revisão do fechamento;
- prestação de contas mensal em PDF, com múltiplas páginas quando necessário;
- projeções com compromissos assumidos, contingência e rateio exato em centavos;
- suíte automatizada ampliada para 44 testes.

## v0.8.0

- proteção local por PIN/senha derivada com PBKDF2/SHA-256;
- sessão temporária e bloqueio por inatividade;
- importação separada do cadastro privado do residencial.

