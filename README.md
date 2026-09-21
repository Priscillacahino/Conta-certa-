# Conta Certa

**GestÃ£o compartilhada, contas transparentes.**

O **Conta Certa** Ã© uma PWA mobile-first e offline-first criada especialmente para **residenciais e condomÃ­nios pequenos**. O projeto foi pensado para facilitar o controle financeiro desses locais sem criar, quando a realidade e a complexidade da operaÃ§Ã£o nÃ£o justificarem, a necessidade de contratar uma empresa de administraÃ§Ã£o de condomÃ­nio e assumir mais um gasto fixo.

A proposta Ã© reunir em uma ferramenta simples o que pequenos residenciais normalmente controlam em planilhas: receitas, despesas discriminadas, contribuiÃ§Ãµes mensais, saldo, cobranÃ§as, projeÃ§Ãµes, prestaÃ§Ã£o de contas, backup e adimplÃªncia. O Conta Certa nÃ£o substitui apoio contÃ¡bil, jurÃ­dico ou administrativo quando ele for necessÃ¡rio; ele organiza a rotina financeira cotidiana e melhora a transparÃªncia entre os moradores.

> O projeto estÃ¡ em desenvolvimento e nÃ£o substitui assessoria contÃ¡bil, jurÃ­dica ou administrativa quando ela for necessÃ¡ria. O objetivo Ã© apoiar a gestÃ£o financeira cotidiana e a transparÃªncia entre os moradores.

## Perfis de uso

### UsuÃ¡rio nÃ£o administrador

A partir da v0.10.0 existe uma **Ã¡rea do morador separada e somente leitura**. A primeira ativaÃ§Ã£o usa um pacote criptografado individual da unidade e uma chave de ativaÃ§Ã£o gerados pelo administrador. Depois de ativado, o login cotidiano Ã© feito com o telefone cadastrado e um PIN numÃ©rico de 4 dÃ­gitos. A versÃ£o offline nÃ£o sincroniza automaticamente entre aparelhos: o administrador envia um novo pacote quando houver atualizaÃ§Ã£o dos dados.

### Administrador

O administrador controla cadastro e importaÃ§Ã£o de dados, receitas e despesas discriminadas, mensalidades e outras obrigaÃ§Ãµes, pagamentos, projeÃ§Ãµes, fechamento mensal, prestaÃ§Ã£o de contas, declaraÃ§Ãµes de adimplÃªncia, backup/restauraÃ§Ã£o e seguranÃ§a local.

## Objetivos do projeto

- tornar a gestÃ£o financeira compartilhada mais simples;
- permitir funcionamento no celular, inclusive offline;
- reduzir dependÃªncia de serviÃ§os pagos no MVP;
- manter histÃ³rico financeiro organizado e auditÃ¡vel;
- facilitar a prestaÃ§Ã£o de contas entre as unidades;
- apoiar decisÃµes de gastos com projeÃ§Ãµes baseadas no caixa disponÃ­vel;
- emitir declaraÃ§Ã£o anual de adimplÃªncia somente quando todas as obrigaÃ§Ãµes exigÃ­veis estiverem quitadas.

## Funcionalidades previstas

- cadastro do residencial e das unidades;
- contribuiÃ§Ã£o mensal configurÃ¡vel;
- controle de pagamentos por unidade;
- receitas e despesas por competÃªncia;
- saldo anterior, resultado do mÃªs e saldo acumulado;
- taxa extraordinÃ¡ria e simulaÃ§Ã£o de rateio;
- histÃ³rico financeiro;
- prestaÃ§Ã£o de contas;
- projeÃ§Ãµes de gastos e comparaÃ§Ã£o de orÃ§amentos;
- backup, restauraÃ§Ã£o e exportaÃ§Ã£o;
- funcionamento offline;
- controle de acesso local por PIN/senha;
- importaÃ§Ã£o separada do cadastro privado, sem sobrescrever o histÃ³rico;
- declaraÃ§Ã£o anual de adimplÃªncia com regras rÃ­gidas de integridade;
- inteligÃªncia financeira local sem dependÃªncia obrigatÃ³ria de API paga.

## Regra financeira central

```text
resultado do mÃªs = receitas - despesas
saldo final = saldo anterior + resultado do mÃªs
```

O saldo final de um perÃ­odo torna-se o saldo inicial do perÃ­odo seguinte.

## ProjeÃ§Ãµes de gastos e orÃ§amentos

Antes de contratar um serviÃ§o, o responsÃ¡vel poderÃ¡ criar uma **projeÃ§Ã£o** e registrar um ou mais orÃ§amentos recebidos.

Exemplo: manutenÃ§Ã£o ou pintura da fachada.

Para cada orÃ§amento o Conta Certa deverÃ¡ mostrar:

- valor atual disponÃ­vel em caixa;
- valor protegido como reserva mÃ­nima, quando configurado;
- valor efetivamente disponÃ­vel para o projeto;
- valor do orÃ§amento;
- quanto falta para contratar o serviÃ§o;
- quanto sobraria no caixa se o serviÃ§o for pago Ã  vista;
- percentual do orÃ§amento jÃ¡ coberto pelo caixa;
- sugestÃ£o matemÃ¡tica de rateio por unidade caso exista dÃ©ficit.

A sugestÃ£o de rateio Ã© apenas um cÃ¡lculo. A criaÃ§Ã£o de uma taxa extraordinÃ¡ria continua sendo uma decisÃ£o do responsÃ¡vel pela gestÃ£o.

## Livro de obrigaÃ§Ãµes

A partir da versÃ£o 0.5, o Conta Certa possui um **livro de obrigaÃ§Ãµes** prÃ³prio. Ele passa a ser a fonte oficial para mensalidades, taxas extraordinÃ¡rias, parcelamentos e outras cobranÃ§as exigÃ­veis por unidade.

Cada obrigaÃ§Ã£o registra valor, competÃªncia, vencimento, valor pago e situaÃ§Ã£o. Pagamento parcial nÃ£o encerra a obrigaÃ§Ã£o: o saldo continua pendente atÃ© a quitaÃ§Ã£o integral.

O sistema tambÃ©m pode gerar a mensalidade de uma competÃªncia para todas as unidades ativas de uma sÃ³ vez. Os valores continuam configurÃ¡veis e nÃ£o ficam presos ao cenÃ¡rio de demonstraÃ§Ã£o.

Parcelamentos recebem tratamento rigoroso. Cada parcela Ã© registrada individualmente e **qualquer parcelamento aberto bloqueia a declaraÃ§Ã£o de adimplÃªncia**, inclusive quando se originou de uma dÃ­vida anterior ao exercÃ­cio analisado. NÃ£o existe comando administrativo para forÃ§ar uma unidade como adimplente sem que as obrigaÃ§Ãµes estejam quitadas ou formalmente canceladas com histÃ³rico preservado.

Veja tambÃ©m: [`docs/OBRIGACOES.md`](docs/OBRIGACOES.md).

## AdimplÃªncia anual e declaraÃ§Ã£o protegida

A declaraÃ§Ã£o anual nÃ£o pode ser criada manualmente. O motor verifica todas as obrigaÃ§Ãµes exigÃ­veis do exercÃ­cio de cada unidade. Havendo qualquer pendÃªncia, a emissÃ£o Ã© bloqueada.

Na versÃ£o 0.6, o fluxo completo de emissÃ£o jÃ¡ possui PDF gerado localmente, ID Ãºnico, cÃ³digo de validaÃ§Ã£o, QR Code, SHA-256 do conteÃºdo, SHA-256 do arquivo PDF, histÃ³rico local e revogaÃ§Ã£o. O PDF original fica preservado no IndexedDB; qualquer arquivo alterado deixa de corresponder ao hash registrado.

Uma declaraÃ§Ã£o emitida nÃ£o Ã© reescrita. CorreÃ§Ãµes exigem revogaÃ§Ã£o do documento anterior e nova emissÃ£o, com outro identificador e novos hashes. O aplicativo tambÃ©m permite carregar um PDF recebido para comparar seu SHA-256 com o original preservado.

A data de fechamento anual Ã© configurÃ¡vel. Se a PWA estiver fechada no dia definido, nÃ£o hÃ¡ garantia de execuÃ§Ã£o em segundo plano; ao ser aberta na data ou depois, o sistema pode gerar em lote os documentos ainda nÃ£o emitidos para unidades elegÃ­veis.

A entrega usa a folha de compartilhamento nativa do celular. Envio completamente automÃ¡tico para um nÃºmero especÃ­fico de WhatsApp/SMS continua dependendo de um serviÃ§o externo de mensageria.

Veja tambÃ©m: [`docs/DECLARACOES_ADIMPLENCIA.md`](docs/DECLARACOES_ADIMPLENCIA.md).

## SeguranÃ§a e dados privados

A v0.8 adiciona proteÃ§Ã£o local por credencial derivada com PBKDF2/SHA-256 e sessÃ£o temporÃ¡ria, alÃ©m de um importador especÃ­fico para o cadastro privado do residencial. O cadastro real continua fora do repositÃ³rio pÃºblico. Veja [`docs/SEGURANCA_LOCAL.md`](docs/SEGURANCA_LOCAL.md) e [`docs/CADASTRO_PRIVADO.md`](docs/CADASTRO_PRIVADO.md).


## Backup, fechamento e prestaÃ§Ã£o de contas

A versÃ£o 0.9 acrescenta quatro blocos operacionais importantes antes da publicaÃ§Ã£o final da PWA:

- **backup criptografado e restauraÃ§Ã£o**, com PBKDF2/SHA-256 + AES-256-GCM e validaÃ§Ã£o contra arquivo adulterado;
- **fechamento mensal**, com transporte do saldo final para a competÃªncia seguinte e bloqueio de lanÃ§amentos apÃ³s o encerramento;
- **reabertura controlada**, obrigatoriamente justificada e registrada, com incremento da revisÃ£o no novo fechamento;
- **prestaÃ§Ã£o de contas mensal em PDF**, gerada localmente a partir de uma competÃªncia fechada e com suporte a mÃºltiplas pÃ¡ginas.

A Ã¡rea de projeÃ§Ãµes tambÃ©m passa a considerar compromissos jÃ¡ assumidos, margem de contingÃªncia e rateio exato dos centavos quando houver dÃ©ficit. O sistema continua sem escolher fornecedor automaticamente.

Veja [`docs/BACKUP_RESTAURACAO.md`](docs/BACKUP_RESTAURACAO.md), [`docs/FECHAMENTO_MENSAL.md`](docs/FECHAMENTO_MENSAL.md), [`docs/PRESTACAO_CONTAS.md`](docs/PRESTACAO_CONTAS.md) e [`docs/PROJECOES.md`](docs/PROJECOES.md).

Veja tambÃ©m: [`docs/MORADOR.md`](docs/MORADOR.md).

## Arquitetura do MVP

- PWA em HTML, CSS e JavaScript;
- interface mobile-first;
- Service Worker para experiÃªncia offline;
- IndexedDB para persistÃªncia local;
- motor financeiro determinÃ­stico com valores em centavos inteiros;
- mÃ³dulos de adimplÃªncia e projeÃ§Ãµes desacoplados da interface;
- dados pÃºblicos de demonstraÃ§Ã£o anonimizados;
- dados reais mantidos localmente ou importados de forma controlada.

## Caso de validaÃ§Ã£o inicial

Os testes automatizados utilizam um cenÃ¡rio de demonstraÃ§Ã£o com 5 unidades e contribuiÃ§Ã£o mensal de R$ 190,00 por unidade. Esses valores nÃ£o ficam fixos na arquitetura.

Exemplo financeiro validado:

```text
saldo anterior:   R$   932,23
receitas:         R$   950,00
despesas:         R$   623,51
resultado do mÃªs: R$   326,49
saldo final:      R$ 1.258,72
```


## MigraÃ§Ã£o histÃ³rica

A versÃ£o 0.4 aprofunda a conciliaÃ§Ã£o da planilha real, com **136 competÃªncias entre maio/2015 e agosto/2026**. O resultado atual da auditoria Ã©:

- **106 competÃªncias totalmente conciliadas**;
- **18 competÃªncias com diferenÃ§as explicadas e documentadas**;
- **12 competÃªncias classificadas como formato legado de 2019**, quando existia um controle auxiliar de fundo de reserva com lÃ³gica diferente da atual;
- **0 competÃªncias em revisÃ£o manual**. Maio/2023 e agosto/2023 passaram a ser tratados como ajustes explÃ­citos de transporte da prÃ³pria fonte histÃ³rica, sem criar receitas ou despesas fictÃ­cias.


### Fechamento da revisÃ£o histÃ³rica de 2023

A revisÃ£o da fonte original permitiu encerrar os dois pontos que permaneciam pendentes sem inventar lanÃ§amentos:

- **maio/2023:** a prÃ³pria planilha abre o mÃªs em R$ 0,00 depois de abril encerrar em -R$ 55,73. A diferenÃ§a de R$ 55,73 fica registrada como ajuste de transporte da fonte, e nÃ£o como receita;
- **agosto/2023:** a abertura de R$ 404,13 fica exatamente R$ 199,92 abaixo do fechamento de julho. Esse valor coincide com o campo histÃ³rico `SALDO PARA FUNDO DE RESERVA` de julho. A diferenÃ§a fica registrada como ajuste de transporte da fonte, sem ser convertida em despesa.

Essas classificaÃ§Ãµes explicam a estrutura aritmÃ©tica da fonte histÃ³rica; elas **nÃ£o afirmam uma movimentaÃ§Ã£o bancÃ¡ria externa que nÃ£o esteja documentada**.

A migraÃ§Ã£o tambÃ©m passou a reconhecer a seÃ§Ã£o separada de **taxa extraordinÃ¡ria de maio/2021**, que explica o saldo de R$ 5.205,25 transportado para junho daquele ano. Pequenas diferenÃ§as aritmÃ©ticas histÃ³ricas sÃ£o registradas como ajustes explÃ­citos, nunca apagadas.

O arquivo com os dados reais continua separado do cÃ³digo e fica na pasta local `private/`, ignorada pelo Git. Nomes, telefones, endereÃ§o e dados financeiros detalhados do residencial nÃ£o precisam ser publicados para que o aplicativo funcione.

### Regra reforÃ§ada para declaraÃ§Ãµes

O histÃ³rico importado Ã© tratado como **referÃªncia financeira**, e nÃ£o como prova automÃ¡tica suficiente de adimplÃªncia. Isso Ã© proposital: uma planilha antiga pode registrar pagamentos sem possuir um cadastro completo de todas as obrigaÃ§Ãµes, parcelamentos e taxas extraordinÃ¡rias exigÃ­veis.

A emissÃ£o anual serÃ¡ autorizada somente pelo **livro de obrigaÃ§Ãµes do Conta Certa**, no qual cada mensalidade, taxa extra ou parcelamento terÃ¡ situaÃ§Ã£o prÃ³pria. Qualquer obrigaÃ§Ã£o pendente bloqueia a declaraÃ§Ã£o.


## Sincronização PostgreSQL

A v0.11.0 adiciona uma camada opcional de sincronização com **Django + PostgreSQL**, mantendo o IndexedDB como cache/offline. O PostgreSQL não é acessado diretamente pelo navegador: toda comunicação passa por uma API HTTPS com autenticação e autorização por perfil.

O administrador pode manter a operação local durante a implantação e enviar uma cópia do banco para o servidor. O morador pode usar ativação online e, depois, entrar com telefone cadastrado + PIN de 4 dígitos. Consulte [docs/SINCRONIZACAO_POSTGRESQL.md](docs/SINCRONIZACAO_POSTGRESQL.md).
## Status

ðŸš§ **Em desenvolvimento â€” v0.11.0 (PostgreSQL, API Django e sincronização automática).**

A planilha histÃ³rica real serÃ¡ utilizada para validaÃ§Ã£o e migraÃ§Ã£o dos dados, sem expor nomes de moradores, telefones ou endereÃ§o completo nos dados pÃºblicos de demonstraÃ§Ã£o.

## ResponsÃ¡vel

**Priscilla Cahino**  
Projeto pessoal/acadÃªmico na interseÃ§Ã£o entre Contabilidade, gestÃ£o financeira e AnÃ¡lise e Desenvolvimento de Sistemas.


## VerificaÃ§Ã£o de seguranÃ§a e privacidade

A versÃ£o 0.9.1 inclui auditoria automatizada do pacote pÃºblico. Rode:

```bash
npm run verify
```

O comando executa toda a suÃ­te de testes e, em seguida, verifica regras de publicaÃ§Ã£o segura, exclusÃ£o de arquivos privados, CSP, polÃ­tica de referÃªncia, cache do Service Worker e padrÃµes comuns de credenciais acidentalmente publicadas. LimitaÃ§Ãµes e riscos residuais estÃ£o documentados em [`docs/AUDITORIA_SEGURANCA_PRIVACIDADE.md`](docs/AUDITORIA_SEGURANCA_PRIVACIDADE.md).

