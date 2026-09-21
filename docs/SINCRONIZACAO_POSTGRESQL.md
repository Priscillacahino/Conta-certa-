# Sincronização PostgreSQL — v0.11.0

A v0.11.0 acrescenta uma camada opcional de sincronização central mantendo o funcionamento offline.

## Arquitetura

```text
PWA administrador ─┐
                   ├── HTTPS ── Django API ── PostgreSQL (Neon)
PWA morador ───────┘
        │
        └── IndexedDB continua como cache/offline
```

## Fonte oficial

Depois da validação da migração, o PostgreSQL pode se tornar a fonte central. Durante a implantação, o IndexedDB administrativo continua preservado e o primeiro envio é uma cópia.

## Conflito

Cada residencial possui `sync_version`. Um cliente que tentar enviar uma versão antiga recebe HTTP 409 e não sobrescreve silenciosamente o servidor. O backend também preserva o último snapshot completo para restauração controlada em um novo aparelho.

## Morador

O modo online permite:
- primeira ativação por telefone + código temporário + PIN de 4 dígitos;
- login cotidiano por telefone + PIN;
- bloqueio temporário após tentativas incorretas;
- consulta somente dos dados da própria unidade e dos fechamentos coletivos;
- atualização automática ao abrir/retomar conexão.

O pacote `.ccresident.json` pode continuar existindo como contingência offline.

## Segurança

- PostgreSQL nunca é acessado diretamente pelo navegador.
- `DATABASE_URL` fica somente no backend.
- sessões usam tokens aleatórios armazenados no servidor apenas como SHA-256;
- PIN do morador fica protegido pelo hasher de senhas do Django;
- CORS limita as origens aceitas;
- toda sincronização administrativa cria evento de auditoria.

## Armazenamento local

O IndexedDB não desaparece. Ele passa a ser cache operacional/offline, reduzindo dependência de memória local como única fonte de verdade.

## Etapas externas necessárias

1. conectar/criar o projeto PostgreSQL no Neon;
2. configurar `DATABASE_URL` no backend;
3. publicar o backend Django;
4. executar migrations e criar o usuário administrador;
5. abrir `sincronizacao.html`, informar a URL da API e fazer o primeiro envio;
6. comparar saldos e quantidades antes de declarar o PostgreSQL como fonte oficial.

## Recuperação de aparelho

A tela de sincronização possui **Restaurar do servidor**. A restauração usa o snapshot central e preserva a credencial administrativa local do aparelho.
