# Changelog

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
