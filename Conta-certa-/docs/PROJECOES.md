# Projeções de gastos e orçamentos

## Objetivo

Permitir que a gestão avalie um gasto futuro antes de assumir o compromisso financeiro.

Exemplo: serviço de fachada, pintura, reforma, manutenção hidráulica, portão ou outro serviço extraordinário.

## Fluxo previsto

1. Criar um projeto de gasto.
2. Informar descrição e categoria.
3. Registrar um ou mais orçamentos recebidos.
4. O Conta Certa consulta o saldo atual do caixa.
5. Opcionalmente, desconta uma reserva mínima protegida.
6. Para cada orçamento, calcula cobertura, déficit ou sobra.
7. Se houver déficit, calcula apenas como referência o rateio por unidade.
8. A gestão decide se aprova, adia ou cria uma taxa extraordinária.

## Fórmulas

```text
caixa disponível para o projeto = saldo em caixa - reserva mínima protegida
faltante = máximo(orçamento - caixa disponível, 0)
saldo projetado após pagamento = saldo atual - orçamento
rateio sugerido por unidade = teto(faltante / unidades ativas)
```

Todos os cálculos monetários são executados em centavos inteiros.

## Regras de negócio

- O sistema não escolhe automaticamente um fornecedor.
- Cada orçamento permanece registrado de forma independente.
- A projeção não altera o caixa real.
- Somente uma contratação/lançamento confirmado gera despesa real.
- Reserva mínima protegida é opcional e configurável.
- O rateio sugerido não cria cobrança automaticamente.
- Mudanças no saldo real devem permitir recalcular a projeção sem apagar o orçamento original.

## Informações que a interface deve mostrar

Para cada orçamento:

- fornecedor ou identificação do orçamento;
- valor total;
- saldo atual;
- reserva protegida;
- caixa disponível para o projeto;
- percentual coberto;
- valor faltante;
- saldo projetado após pagamento;
- taxa extraordinária sugerida por unidade, quando aplicável.
