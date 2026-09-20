import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyStatementPdf } from '../src/statement-pdf.js';

const closing={id:'2026-09',competence:'2026-09',status:'closed',revision:1,closedAt:'2026-09-30T20:00:00Z',openingBalanceCents:125872,revenueCents:95000,expenseCents:60000,resultCents:35000,closingBalanceCents:160872,paymentIds:['p1'],movementIds:['e1']};

test('gera prestação de contas PDF somente para competência fechada', () => {
  const bytes=buildMonthlyStatementPdf({residential:{name:'Residencial Demonstração',address:'Rua Exemplo'},closing,payments:[{id:'p1',unitId:'101',amountCents:95000,paidAt:'2026-09-05T12:00:00Z'}],movements:[{id:'e1',kind:'expense',date:'2026-09-10',description:'Conta de água',amountCents:60000}]});
  assert.equal(new TextDecoder('latin1').decode(bytes.slice(0,8)),'%PDF-1.4');
  assert.ok(bytes.length>1000);
});

test('recusa prestação antes do fechamento', () => {
  assert.throws(()=>buildMonthlyStatementPdf({residential:{},closing:{...closing,status:'reopened'}}),/PRESTACAO_EXIGE_COMPETENCIA_FECHADA/);
});
