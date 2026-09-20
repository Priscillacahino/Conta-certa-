# Dados reais e publicação

O código do Conta Certa pode ser público. Os dados reais do residencial, porém, não fazem parte do código-fonte público.

A pasta `private/` está incluída no `.gitignore` e deve continuar fora do GitHub. Nela podem existir:

- endereço completo;
- nomes dos responsáveis pelas unidades;
- telefones para acionamento;
- histórico financeiro importado da planilha;
- arquivos de auditoria da migração.

No uso do aplicativo, o arquivo privado é escolhido manualmente no dispositivo e armazenado no IndexedDB local. Dessa forma, a instalação pública da PWA não precisa conter os dados pessoais dos moradores.
