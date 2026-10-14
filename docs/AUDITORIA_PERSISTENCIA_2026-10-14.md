# Auditoria de persistência — 14/10/2026

## Falha reproduzida

Na v0.12.5, a validação de histórico não conferia identificadores de unidades. Em um banco isolado, foi importado um histórico fictício válido. Em seguida, um arquivo com unidade sem ID passou pela validação. O `put` lançou `DataError`, depois de terem sido agendadas as operações `clear`. A Promise rejeitou, mas a transação não foi explicitamente abortada: a consulta posterior encontrou zero unidades e zero competências. O erro de importação podia, portanto, apagar registros anteriores.

Isso confirma um defeito, mas não identifica a causa do relato do aparelho real. Não há evidência de que um arquivo inválido foi usado nesse aparelho. Os dois arquivos privados recuperados foram compatíveis e passaram pelo teste isolado.

## Correções

- A camada de banco valida e clona os arquivos antes de abrir a transação, recalculando os metadados a partir do conteúdo.
- Identificadores ausentes, arquivos vazios, unidades/competências duplicadas e datas divergentes são recusados.
- Toda substituição usa transação com tratamento de aborto, incluindo erros síncronos durante o agendamento das gravações. O sucesso só é retornado após conclusão da transação.
- Importações não podem remover unidades ou competências anteriores silenciosamente nem trocar o residencial em uma base preenchida.
- A restauração de uma cópia vazia sobre dados existentes é recusada. A opção interna de limpeza usada em testes não é exposta na interface.
- A restauração remota recusa dados locais não sincronizados e snapshots que retirariam registros locais; verifica novamente o estado dentro da transação para impedir perda por edição concorrente.
- A credencial local preservada é lida dentro da transação de restauração.
- Após receber do servidor, o hash de sincronização corresponde à base efetivamente gravada, incluindo os metadados locais, evitando reenvio causado apenas pela restauração.
- A tela mostra o endereço de origem e contagens locais. Solicita proteção contra remoção automática após importar e informa se ela foi concedida. A ausência de suporte ou negativa não transforma uma importação concluída em falha.
- O resumo de verificação de backup agora contabiliza competências históricas e fechamentos, além dos registros operacionais.

## Evidências de teste

Testes automatizados cobrem reabertura do banco, erro síncrono após agendamento de limpeza, falha de gravação de cadastro, arquivo vazio/malformado/duplicado, redução do histórico, restauração vazia, snapshot remoto incompleto, alterações concorrentes, chaves numéricas inválidas e negativa da proteção de armazenamento.

Os arquivos privados foram exercitados em um IndexedDB simulado, isolado dos aparelhos reais: importação, criação de fechamentos históricos, geração de backup criptografado, descriptografia e restauração preservaram 5 unidades, 136 competências e 136 fechamentos. Nenhum dado privado foi incluído neste repositório.

## Limites e operação entre aparelhos

O banco IndexedDB pertence à origem do site, ao perfil do navegador e ao dispositivo. Atualizar os arquivos da PWA não deve apagar esse banco: o service worker limpa somente caches do aplicativo, não o IndexedDB. Não foi encontrada rotina automática de exclusão do banco administrativo.

Proteção de armazenamento persistente reduz o risco de remoção automática pelo navegador. Ela não impede limpeza manual, exclusão do perfil, modo privado, defeito do dispositivo nem substituição intencional de dados. Backups externos continuam necessários.

A sincronização existente permite enviar a base administrativa ao servidor e baixar em outro aparelho. A operação depende de autenticação, configuração do backend e conferência do resultado. O envio automático é local → servidor; a leitura administrativa em outro aparelho requer a ação de baixar a base central. No segundo aparelho, faça isso antes de importar uma base independente. Não há fusão automática de versões conflitantes.

Uma cópia exportada também pode ser transferida e restaurada em outro aparelho, mantendo uma senha local específica desse aparelho. Isso é transferência de cópia, não sincronização contínua.

Ainda pendentes: teste visual no aparelho que apresentou o relato, localização de eventual base antiga em outro perfil/origem e validação do backend em produção e da sincronização real entre dois dispositivos. Esta correção não permite afirmar que todos esses itens estão concluídos.
