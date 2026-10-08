# Conta Certa — revisão de integridade financeira v0.12.4

Base revisada: commit `41cadf6` da main. Revisão em 08/10/2026.

## Correções implementadas

| Risco encontrado | Correção |
| --- | --- |
| Duas abas podiam registrar pagamentos usando o mesmo saldo antigo | Saldo relido e atualizado na mesma transação do pagamento; tela desatualizada e ID repetido recusados sem gravação parcial. |
| Lote de mensalidades podia sobrescrever registro existente | Inserção exclusiva e verificação do mês fechado na mesma transação. |
| Cancelamento antigo podia apagar o saldo pago | Releitura da obrigação e recusa de alteração incompatível. |
| Fechamento usava valores carregados antes de novos lançamentos | Recálculo dentro da transação; conferência de água, energia e saldo anterior; divergência exige recarregar. |
| Reabertura alterava o saldo de meses posteriores fechados | Reabrir do mês mais recente para o mais antigo; novo fechamento segue a ordem cronológica. Histórico importado não é reaberto operacionalmente. |
| Snapshot parcial podia apagar tabelas do servidor | Validação completa dos stores, IDs, referências, centavos, datas, soma dos pagamentos e totais fechados, antes da gravação. |
| Duas sincronizações podiam passar na checagem de versão | Versão conferida sob bloqueio transacional do residencial; cliente serializa envio e restauração, usando Web Locks quando disponível. |
| Restauração de base antiga podia apagar registros centrais | Recusa de desaparecimento de obrigações, pagamentos, movimentos, fechamentos e declarações. Pagamentos existentes não são reescritos pela sincronização. |
| Backup podia misturar momentos diferentes dos dados | Exportação em uma única transação de leitura; restauração incompleta ou com inconsistências financeiras é recusada antes de limpar dados. |
| Novo timestamp causava envio mesmo sem mudanças | Hash do conteúdo dos stores, sem a data de criação do envelope. |
| Troca de API podia reutilizar sessão/versão de outro servidor | Sessões e metadados de sincronização removidos quando o endereço muda; tempo limite de requisição. |
| Morador não conseguia recuperar cofre local inválido | Autenticação online explícita reconstrói o cofre; erro de autenticação do servidor não autoriza fallback local. Falha de rede permite contingência local. |
| Novo aparelho não tinha API configurada | Endereço padrão fixo do projeto, já registrado no repositório. Parâmetros da URL continuam sem poder trocar a API. |
| Credenciais removidas podiam voltar a funcionar com sessão/PIN antigos | Remoção/inativação revoga sessões, invalida códigos e limpa PIN; nova ativação também revoga sessões anteriores. |
| Valores inválidos podiam virar zero ou arredondar silenciosamente | Conversão explícita de reais e centavos; aceitação de formato brasileiro; datas impossíveis e totais inseguros recusados. |
| PDF mensal listava mensalidades recebidas em outro mês | Filtro pelo mês do recebimento, inclusive mensalidades de competências anteriores pagas no mês. |
| PDF podia apresentar detalhes diferentes dos totais | Prestação operacional verifica lançamentos contra o fechamento antes de gerar o arquivo. Datas de negócio mantêm o dia informado. |
| Texto de pendências parecia retratar o saldo histórico | PDF esclarece que mostra a posição atual das taxas originadas até a competência, na data de geração. |
| Cache não encontrava arquivos com query de versão offline | Correspondência de recursos ignora query; limpeza só remove caches do Conta Certa. |
| Sincronização não realizada podia aparecer como concluída | Mensagem explícita para resultado ignorado por ausência de sessão/configuração. |

## Validação executada

- 109 testes JavaScript aprovados, incluindo testes reais de transações com IndexedDB simulado, concorrência, duplicidade, rollback, fechamento, restauração, moeda, PDFs e sincronização.
- 17 testes Django aprovados com banco de testes isolado. Incluem autenticação, revogação, snapshots inválidos, conflitos de versão, preservação de registros e conciliação interna dos valores.
- `makemigrations --check --dry-run`: nenhuma migração pendente.
- Auditoria estática de conteúdo público sem falhas; não equivale a auditoria de segurança independente.
- Navegador Chromium desktop e viewport móvel: cadastro fictício, mensalidade de R$ 100,00, pagamento, saldo inicial de R$ 200,00, água/energia de R$ 25,00 cada, fechamento em R$ 250,00, PDF, sincronização com Django e SQLite isolados, ativação do morador e consulta do saldo.
- Recuperação de cofre local deliberadamente corrompido, seguida de login offline, confirmada no navegador. Sem erros de página nesse fluxo.
- Health check público consultado sem autenticação: API respondeu `200`, versão `0.12.0` antes desta entrega. Nenhum lançamento foi criado, alterado ou removido na produção durante os testes.

## Mudanças de uso

1. Se aparecer erro de saldo/tela desatualizada, recarregue e confira o lançamento existente antes de tentar novamente.
2. Para corrigir um mês antigo com meses posteriores fechados, reabra primeiro os posteriores, do mais recente para o mais antigo. Refaça os fechamentos em ordem cronológica.
3. Uma sincronização que removeria registros passa a ser recusada. Não substitua essa proteção por envio forçado. Preserve as duas bases e reconcilie o conflito.
4. Backups incompletos/inconsistentes não são restaurados automaticamente. O arquivo permanece disponível para análise e recuperação; os dados locais anteriores são preservados.

## Limites e pendências reais

- Não foi feita conciliação com extratos, recibos ou dados reais do condomínio. A validação comprova consistência interna dos cenários testados, não a exatidão da origem dos lançamentos.
- Não foram executados testes de escrita com credenciais administrativas na produção. PostgreSQL/Neon, volume real e concorrência entre dispositivos em produção ainda exigem acompanhamento após implantação; os testes locais de backend usaram SQLite.
- Base antiga que já contenha pagamentos inconsistentes será recusada pela nova validação. Não há correção automática de valores financeiros sem evidência documental.
- O projeto ainda não possui fluxo completo de estorno financeiro auditável. Pagamentos incorretos existentes precisam de tratamento específico; esta revisão não introduz exclusão ou reescrita silenciosa de recebimentos.
- Biometria/passkeys permanecem não implementadas. PIN e acesso online/offline foram mantidos e testados.
- A revogação remota depende de conexão. Um aparelho offline pode continuar acessando a última cópia autorizada; o aplicativo informa a data dessa cópia.
- Os dados administrativos locais continuam no IndexedDB. O bloqueio por senha da interface não equivale a cifrar todo o banco local; os backups exportados são criptografados.
- Declarações anuais, conformidade jurídica/LGPD, retenção, recuperação de desastre e monitoramento de produção não foram certificados por esta revisão.
- Nenhum software permite prometer risco zero. Atualizações, backups e conferência documental continuam necessários.
