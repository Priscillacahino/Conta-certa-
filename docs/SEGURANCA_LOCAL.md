# Segurança local

A partir da v0.8, o Conta Certa exige uma credencial local antes de liberar a interface financeira.

- PIN/senha com no mínimo 6 caracteres;
- derivação PBKDF2 com SHA-256, salt aleatório e 210.000 iterações;
- somente o verificador derivado é armazenado no IndexedDB;
- sessão em memória com bloqueio após 10 minutos sem atividade;
- bloqueio manual disponível no cabeçalho e na tela inicial;
- ao retornar após 2 minutos ou mais em segundo plano, o aplicativo volta bloqueado.

## Limites

É uma proteção local de acesso ao aplicativo, não um substituto para criptografia integral do banco do navegador nem para controles do sistema operacional. A etapa de backup criptografado será tratada separadamente. Se a credencial for esquecida, não há recuperação remota porque o Conta Certa não mantém servidor de autenticação.
