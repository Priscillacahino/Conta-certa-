import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneDigits, validateResidentPin, createActivationToken,
  buildResidentPayload, encryptResidentPayload, decryptResidentPackage,
  createResidentVault, openResidentVault, residentOutstandingCents,
} from '../src/resident-access.js';

test('telefone e PIN do morador são normalizados/validados', () => {
  assert.equal(normalizePhoneDigits('+55 (83) 99999-0000'), '5583999990000');
  assert.equal(validateResidentPin('0427'), '0427');
  assert.throws(() => validateResidentPin('12345'), /PIN_MORADOR_INVALIDO/);
  assert.throws(() => validateResidentPin('12a4'), /PIN_MORADOR_INVALIDO/);
});

test('pacote do morador não inclui dados de outras unidades e preserva despesas discriminadas', async () => {
  const unit = { id:'103', label:'AP 103', responsibleName:'Morador 103', contacts:[{type:'phone',value:'+55 83 99999-0000',active:true}] };
  const payload = buildResidentPayload({
    residential:{id:'r1',name:'Residencial Teste'}, unit,
    closings:[{competence:'2026-09',status:'closed',revision:1,openingBalanceCents:10000,revenueCents:95000,expenseCents:50000,resultCents:45000,closingBalanceCents:55000}],
    movements:[
      {competence:'2026-09',kind:'expense',date:'2026-09-05',category:'Água',description:'Água setembro',amountCents:30000},
      {competence:'2026-09',kind:'expense',date:'2026-09-06',category:'Energia',description:'Energia setembro',amountCents:20000},
    ],
    obligations:[
      {id:'a',unitId:'103',kind:'monthly_contribution',description:'Mensalidade',amountCents:19000,paidCents:19000,status:'paid',year:2026,month:9,dueDate:'2026-09-10'},
      {id:'b',unitId:'102',kind:'monthly_contribution',description:'Mensalidade',amountCents:19000,paidCents:0,status:'open',year:2026,month:9,dueDate:'2026-09-10'},
    ],
    payments:[{id:'p1',unitId:'103',obligationId:'a',amountCents:19000,paidAt:'2026-09-03T12:00:00'}],
    certificates:[], generatedAt:'2026-09-21T12:00:00Z',
  });
  assert.equal(payload.obligations.length, 1);
  assert.equal(payload.obligations[0].id, 'a');
  assert.equal(payload.closings[0].expenses.length, 2);
  assert.equal(payload.allowedPhones[0], '5583999990000');

  const token = createActivationToken();
  const encrypted = await encryptResidentPayload(payload, token);
  const decrypted = await decryptResidentPackage(encrypted, token);
  assert.equal(decrypted.unit.id, '103');
  await assert.rejects(() => decryptResidentPackage(encrypted, createActivationToken()), /PACOTE_MORADOR_CHAVE_INVALIDA/);
});

test('login diário usa telefone cadastrado e PIN numérico de quatro dígitos', async () => {
  const payload = {
    schemaVersion:1,profileType:'resident-readonly',generatedAt:'2026-09-21T12:00:00Z',
    residential:{id:'r1',name:'Residencial Teste'},unit:{id:'103',label:'AP 103',responsibleName:'Morador'},
    allowedPhones:['5583999990000'],obligations:[{amountCents:19000,paidCents:0,status:'open'}],payments:[],closings:[],certificates:[]
  };
  const vault = await createResidentVault(payload, '+55 83 99999-0000', '0427', { iterations: 150000 });
  const opened = await openResidentVault(vault, '5583999990000', '0427');
  assert.equal(opened.unit.id, '103');
  assert.equal(residentOutstandingCents(opened), 19000);
  await assert.rejects(() => openResidentVault(vault, '5583999990000', '1111'), /LOGIN_MORADOR_INVALIDO/);
  await assert.rejects(() => createResidentVault(payload, '5583988880000', '0427', { iterations: 150000 }), /TELEFONE_NAO_AUTORIZADO/);
});
