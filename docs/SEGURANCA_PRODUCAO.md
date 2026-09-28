# Segurança para produção — Conta Certa v0.12.0

Este documento separa o que o código já protege do que depende da implantação.

## Controles implementados no código

- produção exige `DJANGO_SECRET_KEY`, `DATABASE_URL`, `DJANGO_ALLOWED_HOSTS` e `CORS_ALLOWED_ORIGINS`;
- `DEBUG=1` é recusado quando `DJANGO_ENV=production`;
- HTTPS obrigatório no backend em produção;
- HSTS inicial, cookies seguros, `no-referrer`, `nosniff` e proteção contra frames;
- limite de 12 MiB por requisição por padrão;
- login administrativo limitado por usuário + origem de rede, com bloqueio temporário persistente;
- PIN do morador com 6 dígitos;
- códigos de ativação anteriores são invalidados ao gerar um novo;
- sessões expiradas são removidas e há limite de sessões simultâneas;
- sessão deixa de funcionar quando administrador, credencial ou unidade são desativados;
- logout revoga a sessão no servidor;
- administrador pode listar e revogar sessões sem receber o token;
- origem web fora da lista permitida recebe 403;
- URL da API não é mais aceita automaticamente por parâmetro do link;
- respostas da API não devem ser armazenadas em cache;
- Django Admin fica desativado por padrão fora do desenvolvimento.

## Antes de usar dados reais

1. configurar PostgreSQL;
2. publicar o backend somente em HTTPS;
3. configurar as variáveis de ambiente descritas em `backend/.env.example`;
4. executar `python manage.py migrate`;
5. executar `python manage.py check --deploy`;
6. criar o administrador por linha de comando;
7. sincronizar uma base fictícia;
8. validar saldos, obrigações, pagamentos e fechamentos;
9. testar revogação de sessão e perda de aparelho;
10. testar backup criptografado, limpeza do navegador e restauração;
11. somente depois importar dados reais.

## HSTS

A configuração inicial usa 3600 segundos. Não aumente para um ano nem habilite `preload` antes de confirmar que o domínio continuará exclusivamente em HTTPS.

## Limite conhecido

O IndexedDB administrativo continua sendo armazenamento local do navegador e não é criptografia integral em repouso. Para uso real, o servidor deve ser a fonte central e o armazenamento local deve funcionar como cache/offline.
