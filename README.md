# Conta Certa

**Gestão compartilhada, contas transparentes.**

O **Conta Certa** é uma PWA mobile-first e offline-first para gestão financeira de pequenos condomínios e residenciais. O projeto nasceu de uma necessidade real: em um condomínio pequeno, com uma rotina financeira objetiva e gestão compartilhada, não foi identificada a necessidade de contratar uma empresa de grande porte apenas para administrar receitas, despesas, orçamentos e prestações de contas. A proposta do Conta Certa é oferecer o suporte necessário para essa realidade de forma simples, organizada, transparente e de baixo custo.

O sistema foi pensado para substituir controles manuais em planilhas sem perder a simplicidade que funciona bem em condomínios pequenos. Ele concentra contribuições mensais, pagamentos por unidade, receitas, despesas, saldo acumulado, taxas extraordinárias, prestação de contas, projeções de gastos, backup e adimplência anual.

> O projeto está em desenvolvimento e não substitui assessoria contábil, jurídica ou administrativa quando ela for necessária. O objetivo é apoiar a gestão financeira cotidiana e a transparência entre os moradores.

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
- **16 competências com diferenças explicadas e documentadas**;
- **12 competências classificadas como formato legado de 2019**, quando existia um controle auxiliar de fundo de reserva com lógica diferente da atual;
- **2 competências ainda em revisão manual**: maio/2023 e agosto/2023, por diferenças de transporte de saldo sem lançamento explicativo identificado.

A migração também passou a reconhecer a seção separada de **taxa extraordinária de maio/2021**, que explica o saldo de R$ 5.205,25 transportado para junho daquele ano. Pequenas diferenças aritméticas históricas são registradas como ajustes explícitos, nunca apagadas.

O arquivo com os dados reais continua separado do código e fica na pasta local `private/`, ignorada pelo Git. Nomes, telefones, endereço e dados financeiros detalhados do residencial não precisam ser publicados para que o aplicativo funcione.

### Regra reforçada para declarações

O histórico importado é tratado como **referência financeira**, e não como prova automática suficiente de adimplência. Isso é proposital: uma planilha antiga pode registrar pagamentos sem possuir um cadastro completo de todas as obrigações, parcelamentos e taxas extraordinárias exigíveis.

A emissão anual será autorizada somente pelo **livro de obrigações do Conta Certa**, no qual cada mensalidade, taxa extra ou parcelamento terá situação própria. Qualquer obrigação pendente bloqueia a declaração.

## Status

🚧 **Em desenvolvimento — v0.6 (emissão, integridade, validação e revogação de declarações).**

A planilha histórica real será utilizada para validação e migração dos dados, sem expor nomes de moradores, telefones ou endereço completo nos dados públicos de demonstração.

## Responsável

**Priscilla Cahino**  
Projeto pessoal/acadêmico na interseção entre Contabilidade, gestão financeira e Análise e Desenvolvimento de Sistemas.
