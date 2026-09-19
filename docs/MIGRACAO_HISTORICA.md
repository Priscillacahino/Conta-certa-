# Migração histórica — Conta Certa

A planilha histórica é convertida para um arquivo JSON privado e importada localmente no aplicativo. O Excel original permanece inalterado.

## Estado atual da análise

- período identificado: maio/2015 a agosto/2026;
- 136 competências mensais identificadas;
- 106 competências totalmente conciliadas;
- 16 competências com divergências explicadas e tratadas de forma explícita;
- 12 competências de 2019 classificadas como **formato legado**, pois a planilha utilizava um controle auxiliar de fundo de reserva com semântica diferente do modelo atual;
- apenas 2 competências permanecem em **revisão manual** por existir diferença de transporte de saldo sem lançamento explicativo identificado: maio/2023 e agosto/2023;
- saldo final da última competência disponível (agosto/2026): R$ 1.258,72.

O Conta Certa não apaga a diferença original. Quando um erro ou regra antiga é compreendido, o arquivo de migração preserva o valor de origem, o cálculo reconstruído e a explicação usada para classificar a competência.

## Principais correções de interpretação

### 2019 — controle legado de fundo de reserva
Os campos `SALDO PARA FUNDO DE RESERVA` e `RESULTADO DO MÊS` não representam a mesma lógica usada atualmente. A planilha mantinha um controle auxiliar de fundo de reserva, inclusive com um saldo total de R$ 101,41 que explica a abertura de janeiro/2020. Esses meses permanecem identificados como legado em vez de serem apresentados como erros atuais.

### Maio/2021 — taxa extraordinária em seção separada
A planilha registra R$ 3.200,00 de taxa extraordinária fora do quadro principal do mês. Esse valor foi incorporado à migração como receita extraordinária efetivamente recebida, explicando o saldo de R$ 5.205,25 transportado para junho/2021.

### Pequenas inconsistências aritméticas
Diferenças de R$ 0,10 em fevereiro/2021, R$ 1,00 em novembro/2021 e R$ 0,02 em novembro/2025 foram registradas como ajustes históricos explícitos. Os itens originais continuam preservados.

### Campos digitados com outra semântica
Alguns meses possuem o campo de movimento mensal preenchido com o saldo final, valor sem sinal negativo ou outro total intermediário. Quando o saldo final e os lançamentos permitem identificar o comportamento com segurança, a competência é classificada como `resolved` e a divergência permanece documentada.

## Pontos que ainda exigem confirmação

### Maio/2023
Abril/2023 encerra em -R$ 55,73, enquanto maio/2023 começa em R$ 0,00. Não foi localizado lançamento que explique o ajuste de R$ 55,73.

### Agosto/2023
Julho/2023 encerra em R$ 604,05, enquanto agosto/2023 começa em R$ 404,13. Não foi localizado lançamento que explique a redução de R$ 199,92.

Até que exista comprovação ou decisão de tratamento, esses dois pontos permanecem como revisão manual e não são corrigidos silenciosamente.

## Privacidade

O arquivo real de importação fica na pasta `private/`, ignorada pelo Git. Ele pode conter endereço do residencial, nomes dos responsáveis, telefones e descrições históricas. Esses dados não devem ser publicados no repositório público.

## Adimplência e histórico antigo

A planilha histórica registra pagamentos e movimentos financeiros, mas não possui um livro estruturado de todas as obrigações exigíveis, parcelamentos e eventuais cobranças extraordinárias. Por segurança, ela passa a ser tratada como **referência histórica** e não como autorização automática para emitir declaração de adimplência.

As declarações anuais serão baseadas no livro de obrigações criado e controlado pelo próprio Conta Certa, de forma que qualquer mensalidade, taxa extraordinária ou parcelamento aberto bloqueie a emissão.
