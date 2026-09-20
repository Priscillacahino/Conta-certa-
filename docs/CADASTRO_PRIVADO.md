# Cadastro privado

O cadastro real do residencial é importado por um arquivo `*.private.json`. Ele contém apenas dados cadastrais: residencial, endereço, unidades, responsáveis e telefones.

A importação desse arquivo **não apaga o histórico financeiro**. Ela atualiza somente o cadastro do residencial e das unidades no IndexedDB local.

O repositório público mantém duas barreiras contra publicação acidental:

- a pasta `private/` está no `.gitignore`;
- qualquer arquivo `*.private.json` também está ignorado.

O arquivo real do Residencial Brise deve permanecer somente nos dispositivos autorizados e em backups protegidos.
