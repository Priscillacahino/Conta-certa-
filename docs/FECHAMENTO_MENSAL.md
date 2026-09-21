# Fechamento mensal

A versão 0.9 introduz um fluxo próprio para encerramento de competências.

## Regra financeira

```text
resultado do mês = receitas - despesas
saldo final = saldo anterior + resultado do mês
```

Quando existir a competência imediatamente anterior fechada, o saldo final é transportado automaticamente para o saldo inicial do mês seguinte. O histórico importado também pode servir de ponto de partida para a primeira competência operacional do aplicativo.

## Receitas

O fechamento considera como receitas:

- pagamentos efetivamente registrados no mês, independentemente da competência original da obrigação;
- receitas adicionais lançadas manualmente no caixa.

Essa regra mantém o demonstrativo mensal com visão de fluxo financeiro efetivamente recebido.

## Despesas

Despesas são registradas com data, categoria, descrição e valor. Valores monetários permanecem em centavos inteiros na lógica do sistema.

## Bloqueio após fechamento

Depois que uma competência é fechada:

- novos movimentos de caixa daquela competência são recusados;
- pagamentos com data dentro daquela competência são recusados;
- o saldo final fica preservado como base do mês seguinte;
- a prestação de contas pode ser gerada a partir do fechamento.

## Reabertura controlada

Uma competência fechada pode ser reaberta somente com justificativa. O evento é preservado. Ao fechar novamente, a revisão do fechamento é incrementada, sem apagar o registro da reabertura.

## Fechamentos históricos importados

Competências provenientes da base histórica e anteriores à competência operacional atual são materializadas como `closed` com origem `historical_import`. Elas preservam os totais da fonte conciliada, ficam bloqueadas para novos lançamentos e não são reabertas pela interface operacional.

Esse mecanismo evita que meses históricos já encerrados apareçam incorretamente como “Em aberto”. Correções nesses períodos devem ser feitas na fonte histórica e reimportadas.

## Despesas obrigatórias e discriminação

No fluxo operacional mensal, Água e Energia são despesas recorrentes obrigatórias. O fechamento é bloqueado enquanto uma delas não estiver registrada.

A seção “Outras despesas” permite adicionar vários itens independentes no mesmo mês, por exemplo dedetização, cupinização, conserto de vazamento ou qualquer outro gasto. Cada despesa possui data, descrição e valor próprios e aparece separadamente na prestação de contas mensal.
