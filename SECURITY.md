# Política de segurança

Não publique vulnerabilidades contendo dados reais de moradores em Issues públicas.

Ao relatar um problema de segurança:
- descreva o comportamento e os passos mínimos para reproduzir;
- use somente dados fictícios;
- não inclua senhas, tokens, connection strings, backups ou arquivos privados;
- revogue imediatamente qualquer segredo que tenha sido exposto.

O repositório contém uma auditoria automatizada de publicação segura:

```bash
npm run verify
```

Para o backend, execute também:

```bash
python manage.py test
python manage.py check --deploy
```

O segundo comando deve ser executado com as variáveis reais de produção configuradas.
