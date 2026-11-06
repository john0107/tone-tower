import test from 'node:test';
import assert from 'node:assert/strict';
import {timeLimit,evaluateTyped} from './typed-survival.js';
test('stage limits change on cleared-floor boundaries and tones add time',()=>{assert.deepEqual([0,19,20,39,40,59,60,79,80,99].map(n=>timeLimit(n,false)),[0,0,0,0,15000,15000,10000,10000,7000,7000]);assert.deepEqual([40,60,80].map(n=>timeLimit(n,true)),[20000,15000,12000])});
test('typed answers require complete exact syllables and handle tones',()=>{assert.equal(evaluateTyped([' BAAN6 ','Faat'],['baan6','faat3'],false),true);assert.equal(evaluateTyped(['baan6','faat3'],['baan6','faat3'],true),true);assert.equal(evaluateTyped(['baan','faat3'],['baan6','faat3'],true),false);assert.equal(evaluateTyped(['baan',''],['baan6','faat3'],false),null);assert.equal(evaluateTyped(['ban','faat'],['baan6','faat3'],false),false)});

test('whole words accept spaces, compact spelling, and optional tone digits',()=>{
 for(const value of ['baan faat','baanfaat','BAAN6 FAAT3','baan6faat3'])assert.equal(evaluateTyped([value],['baan6','faat3'],false),true);
 assert.equal(evaluateTyped(['baan faat'],['baan6','faat3'],true),false);
 assert.equal(evaluateTyped(['baan6faat3'],['baan6','faat3'],true),true);
});
