# Privacidade e LGPD — orientação operacional

O Conta Certa trata dados para gestão financeira e prestação de contas de um residencial pequeno. Este documento é uma referência operacional do projeto e não substitui orientação jurídica quando necessária.

## Dados mínimos

O sistema pode tratar:
- identificação do residencial e unidade;
- nome do responsável;
- telefone de contato/autenticação;
- obrigações e pagamentos da própria unidade;
- movimentações, fechamentos e documentos financeiros do residencial.

Evite inserir CPF, documentos pessoais, dados bancários completos ou qualquer informação que não seja necessária à finalidade.

## Finalidades

- autenticar administrador e moradores;
- controlar contribuições, pagamentos e pendências;
- produzir prestação de contas;
- disponibilizar documentos da própria unidade;
- manter trilha de auditoria técnica.

## Acesso

- administrador: gestão financeira e operacional;
- morador: consulta somente leitura da própria unidade e dados coletivos autorizados;
- banco PostgreSQL: acessado somente pelo backend.

## Boas práticas

- não publicar dados reais no GitHub;
- não enviar backup e senha do backup pelo mesmo canal quando isso puder ser evitado;
- revogar sessões de aparelhos perdidos;
- remover acesso de responsáveis que deixarem a unidade;
- manter backups criptografados;
- revisar periodicamente usuários e telefones cadastrados;
- evitar colocar dados pessoais em Issues, commits ou logs.

## Incidente

Em suspeita de acesso indevido:
1. revogar as sessões afetadas;
2. alterar credenciais administrativas;
3. invalidar códigos de ativação ainda válidos;
4. conferir os eventos de auditoria;
5. preservar evidências antes de apagar registros;
6. avaliar a necessidade de comunicação aos titulares e demais providências aplicáveis.
