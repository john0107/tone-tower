import test from 'node:test';
import assert from 'node:assert/strict';
import {promptWord} from './prompt.js';
test('prompts show characters and meanings without tone numbers',()=>{const html=promptWord({syllables:[{character:'辦',jyutping:'baan6'},{character:'法',jyutping:'faat3'}],targetIndex:1,gloss:'solution'},String);assert.match(html,/辦/);assert.match(html,/法/);assert.match(html,/baan/);assert.match(html,/faat/);assert.match(html,/solution/);assert.doesNotMatch(html,/baan6|faat3/);assert.match(html,/Listen here/)});
