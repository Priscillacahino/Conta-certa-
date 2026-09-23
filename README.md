# Conta Certa

**Gestão compartilhada, contas transparentes.**

O **Conta Certa** é uma PWA mobile-first e offline-first criada especialmente para **residenciais e condomínios pequenos**. O projeto foi pensado para facilitar o controle financeiro desses locais sem criar, quando a realidade e a complexidade da operação não justificarem, a necessidade de contratar uma empresa de administração de condomínio e assumir mais um gasto fixo.

A proposta é reunir em uma ferramenta simples o que pequenos residenciais normalmente controlam em planilhas: receitas, despesas discriminadas, contribuições mensais, saldo, cobranças, projeções, prestação de contas, backup e adimplência. O Conta Certa não substitui apoio contábil, jurídico ou administrativo quando ele for necessário; ele organiza a rotina financeira cotidiana e melhora a transparência entre os moradores.

> O projeto está em desenvolvimento e não substitui assessoria contábil, jurídica ou administrativa quando ela for necessária. O objetivo é apoiar a gestão financeira cotidiana e a transparência entre os moradores.

## Perfis de uso

### Usuário não administrador

A partir da v0.10.0 existe uma **área do morador separada e somente leitura**. A primeira ativação usa um pacote criptografado individual da unidade e uma chave de ativação gerados pelo administrador. Depois de ativado, o login cotidiano é feito com o telefone cadastrado e um PIN numérico de 4 dígitos. A versão offline não sincroniza automaticamente entre aparelhos: o administrador envia um novo pacote quando houver atualização dos dados.

### Administrador

O administrador controla cadastro e importação de dados, receitas e despesas discriminadas, mensalidades e outras obrigações, pagamentos, projeções, fechamento mensal, prestação de contas, declarações de adimplência, backup/restauração e segurança local.

## Objetivos do projeto

- tornar a gestão financeira compartilhada mais simples;
- permitir funcionamento no celular, inclusive offline;
- reduzir dependência de serviços pagos no MVP;
- manter histórico financeiro organizado e auditável;
- facilitar a prestação de contas entre as unidades;
- apoiar decisões de gastos com projeções baseadas no caixa disponível;
- emitir declaração anual de adimplência somente quando todas as obrigações exigíveis estiverem quitadas.

## Funcionalidades previstas

- cadastro do residencial e das unidades;
- contribuição mensal configurável;
- controle de pagamentos por unidade;
- receitas e despesas por competência;
- saldo anterior, resultado do mês e saldo acumulado;
- taxa extraordinária e simulação de rateio;
- histórico financeiro;
- prestação de contas;
- projeções de gastos e comparação de orçamentos;
- backup, restauração e exportação;
- funcionamento offline;
- controle de acesso local por PIN/senha;
- importação separada do cadastro privado, sem sobrescrever o histórico;
- declaração anual de adimplência com regras rígidas de integridade;
- inteligência financeira local sem dependência obrigatória de API paga.

## Regra financeira central

```text
resultado do mês = receitas - despesas
saldo final = saldo anterior + resultado do mês
```

O saldo final de um período torna-se o saldo inicial do período seguinte.

## Projeções de gastos e orçamentos

Antes de contratar um serviço, o responsável poderá criar uma **projeção** e registrar um ou mais orçamentos recebidos.

Exemplo: manutenção ou pintura da fachada.

Para cada orçamento o Conta Certa deverá mostrar:

- valor atual disponível em caixa;
- valor protegido como reserva mínima, quando configurado;
- valor efetivamente disponível para o projeto;
- valor do orçamento;
- quanto falta para contratar o serviço;
- quanto sobraria no caixa se o serviço for pago à vista;
- percentual do orçamento já coberto pelo caixa;
- sugestão matemática de rateio por unidade caso exista déficit.

A sugestão de rateio é apenas um cálculo. A criação de uma taxa extraordinária continua sendo uma decisão do responsável pela gestão.

## Livro de obrigações

A partir da versão 0.5, o Conta Certa possui um **livro de obrigações** próprio. Ele passa a ser a fonte oficial para mensalidades, taxas extraordinárias, parcelamentos e outras cobranças exigíveis por unidade.

Cada obrigação registra valor, competência, vencimento, valor pago e situação. Pagamento parcial não encerra a obrigação: o saldo continua pendente até a quitação integral.

O sistema também pode gerar a mensalidade de uma competência para todas as unidades ativas de uma só vez. Os valores continuam configuráveis e não ficam presos ao cenário de demonstração.

Parcelamentos recebem tratamento rigoroso. Cada parcela é registrada individualmente e **qualquer parcelamento aberto bloqueia a declaração de adimplência**, inclusive quando se originou de uma dívida anterior ao exercício analisado. Não existe comando administrativo para forçar uma unidade como adimplente sem que as obrigações estejam quitadas ou formalmente canceladas com histórico preservado.

Veja também: [`docs/OBRIGACOES.md`](docs/OBRIGACOES.md).

## Adimplência anual e declaração protegida

A declaração anual não pode ser criada manualmente. O motor verifica todas as obrigações exigíveis do exercício de cada unidade. Havendo qualquer pendência, a emissão é bloqueada.

Na versão 0.6, o fluxo completo de emissão já possui PDF gerado localmente, ID único, código de validação, QR Code, SHA-256 do conteúdo, SHA-256 do arquivo PDF, histórico local e revogação. O PDF original fica preservado no IndexedDB; qualquer arquivo alterado deixa de corresponder ao hash registrado.

Uma declaração emitida não é reescrita. Correções exigem revogação do documento anterior e nova emissão, com outro identificador e novos hashes. O aplicativo também permite carregar um PDF recebido para comparar seu SHA-256 com o original preservado.

A data de fechamento anual é configurável. Se a PWA estiver fechada no dia definido, não há garantia de execução em segundo plano; ao ser aberta na data ou depois, o sistema pode gerar em lote os documentos ainda não emitidos para unidades elegíveis.

A entrega usa a folha de compartilhamento nativa do celular. Envio completamente automático para um número específico de WhatsApp/SMS continua dependendo de um serviço externo de mensageria.

Veja também: [`docs/DECLARACOES_ADIMPLENCIA.md`](docs/DECLARACOES_ADIMPLENCIA.md).

## Segurança e dados privados

A v0.8 adiciona proteção local por credencial derivada com PBKDF2/SHA-256 e sessão temporária, além de um importador específico para o cadastro privado do residencial. O cadastro real continua fora do repositório público. Veja [`docs/SEGURANCA_LOCAL.md`](docs/SEGURANCA_LOCAL.md) e [`docs/CADASTRO_PRIVADO.md`](docs/CADASTRO_PRIVADO.md).


## Backup, fechamento e prestação de contas

A versão 0.9 acrescenta quatro blocos operacionais importantes antes da publicação final da PWA:

- **backup criptografado e restauração**, com PBKDF2/SHA-256 + AES-256-GCM e validação contra arquivo adulterado;
- **fechamento mensal**, com transporte do saldo final para a competência seguinte e bloqueio de lançamentos após o encerramento;
- **reabertura controlada**, obrigatoriamente justificada e registrada, com incremento da revisão no novo fechamento;
- **prestação de contas mensal em PDF**, gerada localmente a partir de uma competência fechada e com suporte a múltiplas páginas.

A área de projeções também passa a considerar compromissos já assumidos, margem de contingência e rateio exato dos centavos quando houver déficit. O sistema continua sem escolher fornecedor automaticamente.

Veja [`docs/BACKUP_RESTAURACAO.md`](docs/BACKUP_RESTAURACAO.md), [`docs/FECHAMENTO_MENSAL.md`](docs/FECHAMENTO_MENSAL.md), [`docs/PRESTACAO_CONTAS.md`](docs/PRESTACAO_CONTAS.md) e [`docs/PROJECOES.md`](docs/PROJECOES.md).

Veja também: [`docs/MORADOR.md`](docs/MORADOR.md).

## Arquitetura do MVP

- PWA em HTML, CSS e JavaScript;
- interface mobile-first;
- Service Worker para experiência offline;
- IndexedDB para persistência local;
- motor financeiro determinístico com valores em centavos inteiros;
- módulos de adimplência e projeções desacoplados da interface;
- dados públicos de demonstração anonimizados;
- dados reais mantidos localmente ou importados de forma controlada.

## Caso de validação inicial

Os testes automatizados utilizam um cenário de demonstração com 5 unidades e contribuição mensal de R$ 190,00 por unidade. Esses valores não ficam fixos na arquitetura.

Exemplo financeiro validado:

```text
saldo anterior:   R$   932,23
receitas:         R$   950,00
despesas:         R$   623,51
resultado do mês: R$   326,49
saldo final:      R$ 1.258,72
```


## Migração histórica

A versão 0.4 aprofunda a conciliação da planilha real, com **136 competências entre maio/2015 e agosto/2026**. O resultado atual da auditoria é:

- **106 competências totalmente conciliadas**;
- **18 competências com diferenças explicadas e documentadas**;
- **12 competências classificadas como formato legado de 2019**, quando existia um controle auxiliar de fundo de reserva com lógica diferente da atual;
- **0 competências em revisão manual**. Maio/2023 e agosto/2023 passaram a ser tratados como ajustes explícitos de transporte da própria fonte histórica, sem criar receitas ou despesas fictícias.


### Fechamento da revisão histórica de 2023

A revisão da fonte original permitiu encerrar os dois pontos que permaneciam pendentes sem inventar lançamentos:

- **maio/2023:** a própria planilha abre o mês em R$ 0,00 depois de abril encerrar em -R$ 55,73. A diferença de R$ 55,73 fica registrada como ajuste de transporte da fonte, e não como receita;
- **agosto/2023:** a abertura de R$ 404,13 fica exatamente R$ 199,92 abaixo do fechamento de julho. Esse valor coincide com o campo histórico `SALDO PARA FUNDO DE RESERVA` de julho. A diferença fica registrada como ajuste de transporte da fonte, sem ser convertida em despesa.

Essas classificações explicam a estrutura aritmética da fonte histórica; elas **não afirmam uma movimentação bancária externa que não esteja documentada**.

A migração também passou a reconhecer a seção separada de **taxa extraordinária de maio/2021**, que explica o saldo de R$ 5.205,25 transportado para junho daquele ano. Pequenas diferenças aritméticas históricas são registradas como ajustes explícitos, nunca apagadas.

O arquivo com os dados reais continua separado do código e fica na pasta local `private/`, ignorada pelo Git. Nomes, telefones, endereço e dados financeiros detalhados do residencial não precisam ser publicados para que o aplicativo funcione.

### Regra reforçada para declarações

O histórico importado é tratado como **referência financeira**, e não como prova automática suficiente de adimplência. Isso é proposital: uma planilha antiga pode registrar pagamentos sem possuir um cadastro completo de todas as obrigações, parcelamentos e taxas extraordinárias exigíveis.

A emissão anual será autorizada somente pelo **livro de obrigações do Conta Certa**, no qual cada mensalidade, taxa extra ou parcelamento terá situação própria. Qualquer obrigação pendente bloqueia a declaração.


## Sincronização PostgreSQL

A v0.11.0 adiciona uma camada opcional de sincronização com **Django + PostgreSQL**, mantendo o IndexedDB como cache/offline. O PostgreSQL não é acessado diretamente pelo navegador: toda comunicação passa por uma API HTTPS com autenticação e autorização por perfil.

O administrador pode manter a operação local durante a implantação e enviar uma cópia do banco para o servidor. O morador pode usar ativação online e, depois, entrar com telefone cadastrado + PIN de 4 dígitos. Consulte [docs/SINCRONIZACAO_POSTGRESQL.md](docs/SINCRONIZACAO_POSTGRESQL.md).
## Status

🚧 **Em desenvolvimento — v0.11.1 (PostgreSQL, API Django e sincronização automática).**

A planilha histórica real será utilizada para validação e migração dos dados, sem expor nomes de moradores, telefones ou endereço completo nos dados públicos de demonstração.

## Responsável

**Priscilla Cahino**  
Projeto pessoal/acadêmico na interseção entre Contabilidade, gestão financeira e Análise e Desenvolvimento de Sistemas.


## Verificação de segurança e privacidade

A versão 0.9.1 inclui auditoria automatizada do pacote público. Rode:

```bash
npm run verify
```

O comando executa toda a suíte de testes e, em seguida, verifica regras de publicação segura, exclusão de arquivos privados, CSP, política de referência, cache do Service Worker e padrões comuns de credenciais acidentalmente publicadas. Limitações e riscos residuais estão documentados em [`docs/AUDITORIA_SEGURANCA_PRIVACIDADE.md`](docs/AUDITORIA_SEGURANCA_PRIVACIDADE.md).

