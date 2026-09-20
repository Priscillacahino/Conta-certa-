# Declarações de adimplência - integridade e emissão

## Regra de emissão

A declaração anual é gerada exclusivamente pelo livro de obrigações do Conta Certa. Para uma unidade ser elegível, o exercício precisa conter as 12 contribuições mensais e não pode haver obrigação exigível pendente, inclusive taxa extraordinária ou parcelamento originado em exercício anterior.

Não existe função administrativa para forçar a condição de adimplente. Se houver pendência, a emissão é recusada pelo motor de regras.


## Modelo visual definitivo

A declaração usa a identidade visual do Conta Certa e segue esta hierarquia:

- nome do residencial em maior destaque;
- **Conta Certa** como subtítulo do sistema emissor;
- ícone oficial do aplicativo no cabeçalho;
- título **Declaração de Adimplência**;
- unidade, exercício, data de emissão, ID e situação;
- endereço do residencial acrescido da unidade correspondente;
- QR Code, código de validação e hash de integridade;
- aviso expresso de que o documento não deve ser editado.

O nome do responsável financeiro não precisa constar no corpo do PDF. Ele permanece no cadastro privado para fins de contato e envio, reduzindo exposição desnecessária de dados pessoais.

## Documento protegido contra adulteração silenciosa

Nenhum PDF distribuído pode ser tornado fisicamente impossível de editar por terceiros. Por isso, o Conta Certa trabalha com **detecção de adulteração e rastreabilidade**, em vez de confiar apenas em bloqueios visuais do arquivo.

Cada emissão possui:

- ID único da declaração;
- código aleatório de validação;
- QR Code local com ID, código e prefixo do hash de conteúdo;
- SHA-256 do conteúdo lógico da declaração;
- SHA-256 dos bytes exatos do PDF emitido;
- cópia exata do PDF preservada no IndexedDB;
- registro de emissão;
- status `VALID` ou `REVOKED`;
- motivo e data de revogação quando aplicável.

Se um terceiro alterar o apartamento, o nome, o texto ou qualquer byte do PDF, o hash do arquivo deixa de corresponder ao registro preservado.

## Revogação

Uma declaração emitida não é editada. Quando for necessário corrigir qualquer informação, a declaração anterior é revogada e permanece no histórico. Depois da correção dos dados, uma nova declaração recebe outro ID, outro código e novos hashes.

## Validação

Na área **Adimplência > Validar arquivo recebido**, o responsável pode selecionar uma declaração registrada e carregar o PDF recebido. O aplicativo recalcula o SHA-256 do arquivo e o compara ao hash preservado no momento da emissão.

Resultados possíveis:

- `ÍNTEGRO E VÁLIDO`: arquivo idêntico ao emitido e registro não revogado;
- `REVOGADA`: o arquivo pode ser o original, mas o documento não deve mais ser aceito;
- `FALHA DE INTEGRIDADE`: o arquivo foi alterado ou não corresponde ao documento selecionado.

## Fechamento anual

A data de fechamento é configurável por exercício. Por padrão, o aplicativo sugere o último dia de segunda a sexta-feira do ano. Feriados ou regras administrativas específicas podem ser representados configurando manualmente a data correta.

Como uma PWA offline pode estar fechada no dia programado, não é possível garantir execução em segundo plano em todos os celulares. Quando o aplicativo for aberto na data configurada ou posteriormente, ele pode gerar em lote as declarações ainda não emitidas para as unidades elegíveis.

## Entrega ao celular

O PDF pode ser compartilhado usando a folha de compartilhamento nativa do aparelho. Os telefones cadastrados são exibidos no histórico para conferência, inclusive múltiplos contatos por unidade.

O envio completamente automático, sem interação humana, para um número específico de WhatsApp/SMS depende de um provedor externo de mensageria e, portanto, permanece fora do núcleo offline do MVP.
