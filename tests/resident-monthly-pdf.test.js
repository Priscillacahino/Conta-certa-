import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResidentMonthlyPdf, residentMonthlySummary } from '../src/resident-monthly-pdf.js';

const payload={
  generatedAt:'2026-09-30T12:00:00Z', residential:{id:'r1',name:'Residencial Teste'},
  unit:{id:'101',label:'Apartamento 101',responsibleName:'Responsável Teste'},
  obligations:[
    {id:'m1',kind:'monthly_contribution',description:'Mensalidade setembro',amountCents:19000,paidCents:19000,status:'paid',year:2026,month:9,dueDate:'2026-09-10'},
    {id:'x1',kind:'extraordinary_fee',description:'Taxa extra pintura',amountCents:50000,paidCents:20000,status:'partial',year:2026,month:8,dueDate:'2026-08-20'},
  ],
  payments:[{id:'p1',obligationId:'m1',amountCents:19000,paidAt:'2026-09-08T12:00:00',description:'Mensalidade'}],
  closings:[{competence:'2026-09',source:'operational',openingBalanceCents:125872,revenueCents:110000,expenseCents:70000,resultCents:40000,closingBalanceCents:165872,expenses:[
    {category:'Água',description:'Água setembro',amountCents:30000},
    {category:'Energia',description:'Energia setembro',amountCents:20000},
    {category:'Outros',description:'Manutenção',amountCents:20000},
  ]}],certificates:[]
};

test('resumo mensal separa taxa pendente, mensalidade e despesas',()=>{
  const s=residentMonthlySummary({payload,competence:'2026-09',extraFeeRevenueCents:15000});
  assert.equal(s.pendingExtra.length,1);
  assert.equal(s.pendingExtra[0].remainingCents,30000);
  assert.equal(s.monthlyPayments.length,1);
  assert.equal(s.monthlyPayments[0].amountCents,19000);
  assert.equal(s.fixedExpenseCents,50000);
  assert.equal(s.variableExpenseCents,20000);
  assert.equal(s.extraFeeRevenueCents,15000);
});

test('histórico importado usa despesas e contribuição discriminadas do período',()=>{
  const historicalPayload={...payload,closings:[{competence:'2026-08',source:'historical_import',openingBalanceCents:100000,revenueCents:95000,expenseCents:60000,resultCents:35000,closingBalanceCents:135000,expenses:[]}]};
  const period={id:'2026-08',revenues:[{type:'contribution',unitId:'101',amountCents:19000},{type:'extra_fee',unitId:'102',amountCents:10000}],expenses:[{category:'agua',description:'Água',amountCents:40000},{category:'manutencao',description:'Reparo',amountCents:20000}]};
  const s=residentMonthlySummary({payload:historicalPayload,competence:'2026-08',historicalPeriod:period});
  assert.equal(s.monthlyPayments[0].amountCents,19000);
  assert.equal(s.extraFeeRevenueCents,10000);
  assert.equal(s.fixedExpenseCents,40000);
  assert.equal(s.variableExpenseCents,20000);
});

test('gera PDF comum sem criptografia',()=>{
  const pdf=buildResidentMonthlyPdf({payload,competence:'2026-09',extraFeeRevenueCents:15000});
  const header=new TextDecoder('latin1').decode(pdf.slice(0,8));
  assert.equal(header,'%PDF-1.4');
  assert.ok(pdf.length>1000);
  assert.equal(new TextDecoder('latin1').decode(pdf).includes('/Encrypt'),false);
});

test('recusa competência sem fechamento',()=>{
  assert.throws(()=>residentMonthlySummary({payload,competence:'2026-10'}),/RESUMO_MENSAL_EXIGE_COMPETENCIA_FECHADA/);
});
