# Revisão histórica de 2023

A revisão da fonte original encerrou os dois pontos de transporte de saldo que permaneciam em conferência manual.

## Maio/2023

- fechamento anterior: **-R$ 55,73**;
- abertura registrada na competência seguinte: **R$ 0,00**;
- tratamento: `SOURCE_OPENING_RESET`;
- ajuste de transporte documentado: **+R$ 55,73**.

O ajuste existe somente para representar fielmente a transição registrada na fonte. Ele não é classificado como receita e não recebe causa econômica que não esteja documentada.

## Agosto/2023

- abertura de julho: **R$ 404,13**;
- movimento de julho registrado como `SALDO PARA FUNDO DE RESERVA`: **R$ 199,92**;
- fechamento de julho: **R$ 604,05**;
- abertura de agosto: **R$ 404,13**;
- tratamento: `SOURCE_CARRYOVER_EXCLUDES_PRIOR_MONTH_MOVEMENT`;
- ajuste de transporte documentado: **-R$ 199,92**.

A diferença é exatamente igual ao movimento registrado no campo histórico de julho. Na migração, ela é preservada como ajuste de transporte da fonte e não como despesa.

## Resultado

A auditoria histórica fica com **136 competências classificadas**, sendo 106 `ok`, 18 `resolved`, 12 `legacy` e 0 `review`. O histórico continua sendo referência financeira e não substitui o livro de obrigações para fins de declaração de adimplência.
