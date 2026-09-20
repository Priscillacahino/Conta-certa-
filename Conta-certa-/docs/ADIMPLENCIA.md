# Adimplência anual — requisito crítico

## Regra
No último dia útil configurado do exercício, cada unidade é avaliada isoladamente. Só é elegível quem não possuir nenhuma obrigação exigível pendente no ano, incluindo contribuições ordinárias e taxas extraordinárias aplicáveis.

Exemplo: 101 e 102 quitados recebem declaração; 103 com dezembro pendente não recebe.

## Integridade
- sem botão de override administrativo para declarar adimplência;
- documento nasce exclusivamente do motor de regras;
- documento emitido não é editado: correção exige revogação + nova emissão;
- ID único e versão;
- SHA-256 do arquivo final;
- registro de emissão preservado;
- QR/código de verificação previsto;
- alteração externa do PDF invalida a correspondência do hash;
- histórico de revogação preservado.

## Entrega
A emissão pode ser automática e offline. Entrega realmente automática a outro telefone depende de um canal externo. O núcleo mantém a entrega desacoplada para não criar dependência de serviço pago.
