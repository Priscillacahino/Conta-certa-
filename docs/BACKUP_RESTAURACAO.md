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


## Preparação e verificação na v0.12.5

1. Abra Caixa & backup no aparelho e perfil de navegador que contêm os dados reais.
2. Informe e confirme uma senha de backup com pelo menos oito caracteres.
3. Clique em **Preparar backup criptografado**. O arquivo é preparado em memória, sem navegação ou clique automático de download.
4. Clique no link **Salvar arquivo de backup**. A abertura usa um contexto separado como alternativa para navegadores que não atendem ao atributo de download. Confirme o arquivo na lista de downloads do navegador. O aplicativo não consegue comprovar que o usuário salvou o arquivo no disco.
5. Guarde uma segunda cópia e a senha separadamente. Os campos de senha são limpos após a preparação. O nome contém data e horário para distinguir cópias.
6. Selecione a cópia salva em **Arquivo para verificar ou restaurar**, informe a senha usada na criação e clique em **Verificar arquivo sem restaurar**. A confirmação verifica a criptografia, a presença das tabelas esperadas, identificadores e relações financeiras, inclusive pagamentos e fechamentos. Ela não grava dados e não comprova correspondência com extratos e comprovantes.

A cópia contém os registros existentes no momento da preparação. Novos lançamentos exigem um novo backup. O link é descartado ao preparar outra cópia ou sair da página; se a página for recarregada antes de salvar, prepare novamente.

**Restaurar backup** continua sendo uma operação separada: exige confirmação e substitui os registros locais. Um teste real de recuperação deve ocorrer em ambiente separado. A verificação de arquivo não substitui esse teste.

O retorno inesperado ao login relatado em um aparelho ainda não foi reproduzido. A v0.12.5 elimina o clique automático do fluxo de backup, mas não desativa o bloqueio por inatividade ou afirma que a causa do relato foi resolvida.
