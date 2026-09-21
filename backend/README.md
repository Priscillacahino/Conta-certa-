# Conta Certa — Backend Django + PostgreSQL

Este backend transforma o PostgreSQL na fonte central de sincronização do Conta Certa.

## Segurança

- `DATABASE_URL` fica somente no ambiente do backend.
- O navegador nunca recebe a senha do PostgreSQL.
- Administrador usa sessão de API temporária.
- Morador usa telefone + PIN de 4 dígitos, com bloqueio após tentativas incorretas.
- A primeira ativação online usa código temporário emitido pelo administrador.
- Cada morador recebe somente os dados individuais da própria unidade e os fechamentos coletivos autorizados.
- Toda sincronização administrativa incrementa uma versão e gera evento de auditoria.

## Desenvolvimento local

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py makemigrations core
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Sem `DATABASE_URL`, o desenvolvimento usa SQLite local. Em produção, configure PostgreSQL.

## Neon

Crie um projeto PostgreSQL e coloque a connection string em `DATABASE_URL` no ambiente do backend, nunca no GitHub.

Exemplo de variável:

```text
DATABASE_URL=postgresql://...?...sslmode=require
```

## Vercel

Crie um projeto Vercel com **Root Directory = backend** e configure:

- `DATABASE_URL`
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS=https://priscillacahino.github.io`

Antes do primeiro uso do backend, execute as migrations e crie o usuário administrador (`is_staff=True`).

## Endpoints principais

- `GET /api/health/`
- `POST /api/auth/admin/login/`
- `POST /api/admin/sync/push/`
- `GET /api/admin/sync/pull/`
- `POST /api/admin/residents/activation/`
- `POST /api/auth/resident/activate/`
- `POST /api/auth/resident/login/`
- `GET /api/resident/snapshot/`

## Migração segura

O IndexedDB atual continua funcionando. A sincronização só é ativada depois que o administrador configurar a URL do backend e fizer login. O primeiro envio cria a cópia central; depois o cliente compara versões e envia somente quando a base local mudou.

O servidor também preserva o último snapshot completo do IndexedDB (sem a credencial local), permitindo restauração controlada em um novo aparelho.
