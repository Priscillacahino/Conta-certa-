# Prestação de contas mensal

A prestação de contas é gerada somente para uma competência com status `closed`.

O PDF apresenta:

- identidade visual do Conta Certa;
- nome e endereço do residencial cadastrado localmente;
- competência;
- revisão do fechamento;
- saldo anterior;
- total de receitas;
- total de despesas;
- resultado do mês;
- saldo final;
- lista de pagamentos recebidos e movimentos manuais que compuseram o fechamento.

O gerador funciona localmente e suporta múltiplas páginas quando a quantidade de movimentações ultrapassa o espaço da primeira página.

O PDF não altera os dados financeiros. Ele é uma representação do fechamento que já está preservado no banco local.
