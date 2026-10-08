import test from 'node:test'; import assert from 'node:assert/strict';
import {monthlyResult,closingBalance,expectedRevenue,extraordinaryShare} from '../src/finance.js';
test('agosto/2026',()=>{ assert.equal(expectedRevenue(5,19000),95000); assert.equal(monthlyResult(95000,62351),32649); assert.equal(closingBalance(93223,95000,62351),125872); });
test('rateio',()=>{assert.equal(extraordinaryShare(35000,5),7000); assert.equal(extraordinaryShare(35001,5),7001);});

test('moeda brasileira preserva centavos e rejeita entradas ambíguas', async () => {
  const {parseMoneyCents}=await import('../src/finance.js');
  assert.equal(parseMoneyCents('1.234,56'),123456);
  assert.equal(parseMoneyCents('1234.56'),123456);
  assert.equal(parseMoneyCents('R$ 0,29'),29);
  assert.equal(parseMoneyCents('-12,50'),-1250);
  for(const value of ['abc','12,345','1e3','Infinity','900719925474099.99']) assert.throws(()=>parseMoneyCents(value));
});
