import test from 'node:test'; import assert from 'node:assert/strict';
import {monthlyResult,closingBalance,expectedRevenue,extraordinaryShare} from '../src/finance.js';
test('agosto/2026',()=>{ assert.equal(expectedRevenue(5,19000),95000); assert.equal(monthlyResult(95000,62351),32649); assert.equal(closingBalance(93223,95000,62351),125872); });
test('rateio',()=>{assert.equal(extraordinaryShare(35000,5),7000); assert.equal(extraordinaryShare(35001,5),7001);});
