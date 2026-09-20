# Perfil de administrador

## Como funciona na v0.9.2

O Conta Certa é offline-first e não depende de um servidor de autenticação. Por isso, o perfil administrativo é local à instalação/navegador.

Na primeira abertura em um aparelho ou navegador sem credencial configurada, o aplicativo entra automaticamente no modo de configuração e solicita a criação de um PIN ou senha com pelo menos 6 caracteres.

A credencial:
- não é enviada ao GitHub;
- não é enviada a um servidor;
- não é armazenada em texto puro;
- é validada por um verificador derivado com PBKDF2 + SHA-256, salt aleatório e 210.000 iterações.

## Quem é o administrador

No MVP atual existe um único papel administrativo por instalação. Quem conhece a credencial daquela instalação consegue desbloquear as funções administrativas.

A recomendação operacional para o Residencial Brise é que a credencial principal fique com a pessoa responsável pela gestão financeira. Se houver troca de responsável, a credencial pode ser alterada na área Segurança local.

## Sessão

Depois do desbloqueio:
- a sessão expira após 10 minutos de inatividade;
- o aplicativo pode ser bloqueado manualmente;
- permanecer em segundo plano por tempo suficiente bloqueia novamente a área protegida;
- após 5 tentativas incorretas há bloqueio temporário.

## Limitação importante

Como não há servidor obrigatório na v1.0, não existe uma conta administrativa central sincronizada entre celulares. Cada navegador/aparelho possui sua própria credencial local.

Sincronização multiusuário, perfis individuais de moradores, recuperação remota e permissões por função exigiriam uma camada segura de servidor e ficam para uma evolução futura.
