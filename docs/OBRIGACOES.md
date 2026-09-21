# Livro de Obrigações — Conta Certa

O livro de obrigações é a fonte oficial para decidir se uma unidade está ou não adimplente.

## O que entra no livro

- contribuição mensal;
- taxa extraordinária;
- parcelamento;
- outras obrigações aprovadas e exigíveis.

Cada obrigação possui unidade, tipo, descrição, valor, competência, vencimento, valor já pago e situação.

## Situações

- `open`: nenhum pagamento registrado;
- `partial`: pagamento parcial;
- `paid`: quitação integral;
- `cancelled`: obrigação formalmente cancelada, sem ser apagada do histórico.

## Regra de segurança

A declaração anual não pode ser liberada por edição manual do status da unidade. O sistema recalcula a adimplência a partir das obrigações. Pagamentos parciais continuam pendentes.

Um **parcelamento aberto bloqueia a declaração**, inclusive quando se originou de obrigação anterior ao exercício da declaração. A quitação precisa constar no livro.

## Parcelamentos

Ao criar um parcelamento, o total é dividido em parcelas preservando todos os centavos. Cada parcela vira uma obrigação individual vinculada a um `planId`.

Exemplo: R$ 100,00 em 3 parcelas vira R$ 33,34 + R$ 33,33 + R$ 33,33.

## Auditoria

Obrigações não devem ser apagadas silenciosamente. Cancelamentos precisam conservar o registro. Pagamentos devem gerar trilha própria, com data e valor.

O histórico importado da planilha antiga continua como referência financeira; ele não substitui o livro de obrigações para emissão de declaração.

## Cancelamento por lançamento indevido

Uma obrigação criada por engano não é apagada silenciosamente. Se ainda não houver pagamento, o administrador pode cancelá-la informando um motivo. O registro permanece no histórico com status `cancelled`, deixa de compor o saldo pendente e não bloqueia a declaração de adimplência.

Obrigações que já tenham pagamento exigem um fluxo próprio de correção/estorno e não podem ser simplesmente canceladas.
