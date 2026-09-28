# Conta Certa — Backend Django + PostgreSQL

O backend é a camada central de autenticação e sincronização do Conta Certa.

## Segurança da v0.12.0

- `DJANGO_SECRET_KEY` é obrigatória fora do desenvolvimento e precisa ter pelo menos 40 caracteres em produção.
- `DATABASE_URL` é obrigatória quando `DJANGO_ENV=production`; produção não cai silenciosamente para SQLite.
- `DEBUG=1` é recusado em produção.
- `ALLOWED_HOSTS` e `CORS_ALLOWED_ORIGINS` são obrigatórios em produção e não aceitam configuração insegura.
- HTTPS é forçado em produção, com cookies seguros e HSTS inicial.
- login administrativo possui limitação persistente de tentativas;
- sessões expiradas são limpas e há limite de sessões ativas por usuário/credencial;
- sessões de usuário desativado, administrador sem `is_staff`, credencial desativada ou unidade inativa deixam de ser aceitas;
- códigos antigos de ativação são invalidados quando um novo código é emitido;
- administrador pode listar e revogar sessões sem conhecer os tokens;
- o PIN do morador passa a ter 6 dígitos;
- respostas da API usam `Cache-Control: no-store`;
- origem web não autorizada recebe HTTP 403.

## Desenvolvimento local

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

set DJANGO_DEBUG=1
set DJANGO_SECRET_KEY=dev-local-change-me

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Sem `DATABASE_URL`, apenas desenvolvimento usa SQLite.

## Produção

Configure no ambiente do backend:

- `DJANGO_ENV=production`
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG=0`
- `DJANGO_ALLOWED_HOSTS`
- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `ENABLE_DJANGO_ADMIN=0`

Depois:

```bash
python manage.py migrate
python manage.py check --deploy
```

Crie o usuário administrativo por linha de comando com `createsuperuser`. A interface `/django-admin/` permanece desativada por padrão em produção.

## Endpoints principais

- `GET /api/health/`
- `POST /api/auth/admin/login/`
- `POST /api/auth/logout/`
- `POST /api/admin/sync/push/`
- `GET /api/admin/sync/pull/`
- `POST /api/admin/residents/activation/`
- `GET /api/admin/sessions/`
- `POST /api/admin/sessions/revoke/`
- `POST /api/auth/resident/activate/`
- `POST /api/auth/resident/login/`
- `GET /api/resident/snapshot/`

## Regra operacional

O PostgreSQL nunca é acessado diretamente pelo navegador. O IndexedDB continua como cache/offline; dados reais não devem depender somente do armazenamento do navegador.
