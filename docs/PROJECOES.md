# Projeções e comparação de orçamentos

A área de projeções simula a contratação de obras, serviços ou melhorias sem alterar o caixa real.

A versão 0.9 considera, para cada orçamento:

- saldo atual em caixa;
- reserva mínima protegida;
- compromissos já assumidos;
- margem de contingência opcional;
- caixa efetivamente disponível para o projeto;
- custo original do orçamento;
- valor adicional da contingência;
- custo total planejado;
- percentual de cobertura pelo caixa disponível;
- saldo projetado após a contratação;
- déficit a cobrir, quando houver;
- rateio de referência entre as unidades ativas.

## Rateio exato

Quando existe déficit, o sistema distribui os centavos de forma exata entre as unidades. Assim, o total das parcelas sugeridas coincide com o déficit calculado, mesmo quando a divisão não é exata em centavos.

Exemplo: um déficit de R$ 741,28 dividido entre 5 unidades gera três cotas de R$ 148,26 e duas de R$ 148,25. A soma permanece exatamente R$ 741,28.

## Comparação sem decisão automática

O Conta Certa mostra a diferença entre os cenários e a amplitude entre o menor e o maior custo planejado, mas não escolhe fornecedor nem transforma a projeção automaticamente em uma cobrança. A contratação e eventual taxa extraordinária continuam sendo decisões administrativas.
