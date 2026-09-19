import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAnnualCompliance,certificatePayload,lastWeekdayOfYear} from '../src/compliance.js';
const paid = m => ({year:2026,month:m,kind:'monthly_contribution',required:true,status:'paid'});

test('101 adimplente com 12 competências',()=>{const r=evaluateAnnualCompliance({year:2026,obligations:Array.from({length:12},(_,i)=>paid(i+1))}); assert.equal(r.eligible,true);});
test('103 com dezembro pendente não recebe declaração',()=>{const obs=Array.from({length:12},(_,i)=>paid(i+1)); obs[11].status='pending'; const r=evaluateAnnualCompliance({year:2026,obligations:obs}); assert.equal(r.eligible,false); assert.equal(r.pending[0].month,12); assert.throws(()=>certificatePayload({residential:{id:'r1',name:'Demo',address:'privado'},unit:{id:'u103',label:'103'},responsible:{name:'Responsável'},year:2026,issuedAt:'2026-12-30',obligations:obs}),/BLOQUEADA/);});
test('ano incompleto é bloqueado mesmo sem pendências registradas',()=>{const obs=Array.from({length:8},(_,i)=>paid(i+1)); assert.throws(()=>certificatePayload({residential:{id:'r1',name:'Demo',address:'privado'},unit:{id:'u101',label:'101'},responsible:{name:'Responsável'},year:2026,issuedAt:'2026-12-30',obligations:obs}),/ANO_INCOMPLETO/);});
test('dados importados não conciliados bloqueiam emissão',()=>{const obs=Array.from({length:12},(_,i)=>paid(i+1)); assert.throws(()=>certificatePayload({residential:{id:'r1',name:'Demo',address:'privado'},unit:{id:'u101',label:'101'},responsible:{name:'Responsável'},year:2026,issuedAt:'2026-12-30',obligations:obs,sourceReviewRequired:true}),/NAO_CONCILIADOS/);});
test('último dia útil simples ignora fins de semana e feriados informados',()=>{assert.equal(lastWeekdayOfYear(2023),'2023-12-29'); assert.equal(lastWeekdayOfYear(2026,['2026-12-31']),'2026-12-30');});
