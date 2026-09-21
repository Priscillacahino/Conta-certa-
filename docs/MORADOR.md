# Perfil do morador — Conta Certa v0.10.0

## Objetivo

A área do morador é uma PWA separada da interface administrativa. Ela funciona em modo **somente leitura** e não permite criar, editar, cancelar ou excluir dados financeiros.

## Instalação

O link de instalação é distribuído diretamente pelo administrador e não deve ser publicado no README. A instalação usa uma página própria e um manifesto próprio, permitindo que a área do morador seja instalada separadamente da área administrativa.

## Primeira ativação

Por segurança, a primeira ativação não depende apenas de telefone + PIN de 4 dígitos.

O administrador gera, para uma unidade específica:

1. um arquivo criptografado `.ccresident.json`;
2. uma chave de ativação aleatória de alta entropia.

O morador importa o arquivo, informa a chave de ativação, digita um dos telefones cadastrados para a unidade e cria uma senha numérica de 4 dígitos.

Depois da ativação, o uso diário exige apenas:

- telefone cadastrado;
- senha numérica de 4 dígitos.

## Segurança do PIN de 4 dígitos

O PIN de 4 dígitos foi escolhido para facilidade de uso, não como segredo de alta entropia. A interface aplica limite de tentativas e bloqueio temporário. O cofre local é criptografado com PBKDF2 + AES-GCM, mas um PIN de quatro dígitos não deve ser considerado equivalente a uma senha forte contra um atacante que consiga extrair e analisar o armazenamento do aparelho fora do aplicativo.

O aparelho do morador deve continuar protegido por senha, biometria ou bloqueio de tela.

## Dados enviados ao morador

O pacote é limitado à unidade selecionada. Ele inclui:

- identificação do residencial e da unidade;
- telefones autorizados daquela unidade;
- obrigações daquela unidade;
- pagamentos daquela unidade;
- competências fechadas do residencial com totais de receitas, despesas, resultado e saldo;
- despesas discriminadas disponíveis para cada competência operacional;
- declarações emitidas para a própria unidade.

O pacote não inclui nomes, telefones, obrigações ou pagamentos individuais de outras unidades.

## Atualização de dados

A versão v0.10.0 continua offline-first e **não possui sincronização automática entre aparelhos**. Quando os dados mudarem, o administrador deverá gerar um novo pacote da unidade e enviá-lo ao morador. O morador poderá atualizar os dados na própria área de consulta sem trocar seu PIN.

## Revogação

Como não existe servidor central, não há revogação remota de uma instalação já ativada. A exclusão do acesso em um aparelho depende da remoção local dos dados. Um pacote antigo continua representando apenas o retrato dos dados na data em que foi gerado e não recebe atualizações posteriores.

## Distribuição

O arquivo de acesso e a chave de ativação devem ser enviados de forma controlada. Quando possível, envie o arquivo e a chave por canais diferentes.
