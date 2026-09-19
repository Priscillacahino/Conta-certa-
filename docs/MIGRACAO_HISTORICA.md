# Migração histórica — Conta Certa

A planilha histórica é convertida para um arquivo JSON privado e importada localmente no aplicativo. O Excel original permanece inalterado.

## Estado atual da base analisada

- período identificado: maio/2015 a agosto/2026;
- 136 competências mensais identificadas;
- 106 competências conciliadas automaticamente;
- 30 competências marcadas para revisão por divergência entre algum total, movimento, saldo final ou transporte de saldo informado na planilha e o cálculo reconstruído;
- saldo final calculado da última competência disponível (agosto/2026): R$ 1.258,72.

Uma divergência não é corrigida silenciosamente. O Conta Certa preserva o dado de origem e o cálculo reconstruído para revisão posterior.

## Privacidade

O arquivo real de importação fica na pasta `private/`, ignorada pelo Git. Ele pode conter endereço do residencial, nomes dos responsáveis, telefones e descrições históricas. Esses dados não devem ser publicados no repositório público.

## Regra para adimplência

Dados importados só podem apoiar emissão automática quando o exercício estiver completo e todas as competências necessárias estiverem conciliadas. Ano incompleto ou mês com divergência bloqueia a declaração automática.
