# Backup e restauração protegidos

A versão 0.9 adiciona backup completo dos dados operacionais locais do Conta Certa.

## O que entra no backup

O arquivo inclui os dados armazenados no IndexedDB, entre eles:

- cadastro do residencial e unidades;
- histórico importado;
- obrigações e pagamentos;
- movimentações de caixa;
- fechamentos mensais e eventos de reabertura;
- projeções salvas;
- declarações e respectivos registros de emissão/revogação;
- configurações operacionais.

A credencial administrativa local (`securityCredential`) não é exportada. O PIN/senha continua sendo específico do aparelho em que foi criado.

## Proteção criptográfica

O conteúdo é serializado somente no momento da geração do backup e protegido com:

- PBKDF2 + SHA-256;
- salt aleatório;
- 260.000 iterações por padrão;
- AES-256-GCM;
- IV aleatório por backup;
- autenticação de integridade do conteúdo pelo próprio AES-GCM.

Uma senha incorreta ou qualquer adulteração do conteúdo cifrado faz a restauração ser recusada.

## Restauração

A restauração substitui os dados operacionais existentes no dispositivo, preservando a credencial administrativa local atual. O aplicativo registra metadados da última restauração para auditoria.

A senha do backup não é armazenada e não pode ser recuperada pelo Conta Certa. O arquivo e a senha devem ser guardados separadamente.
