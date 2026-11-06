import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCredits, creditsPage } from '../../src/ui/credits.js';
test('credits keep a bounded page and clamp navigation after filtering', () => {
  const rows = Array.from({ length: 473 }, (_, id) => ({
    id,
    character: '字',
    jyutping: 'si' + id,
    author: id === 45 ? 'A Person' : 'Other',
  }));
  assert.equal(creditsPage(rows).rows.length, 20);
  assert.equal(creditsPage(rows, 23).rows.length, 13);
  assert.equal(creditsPage(rows, 99).page, 23);
  const matches = filterCredits(rows, 'a PERSON');
  assert.equal(matches.length, 1);
  assert.equal(creditsPage(matches, 23).page, 0);
  assert.equal(creditsPage(matches, 23).rows[0].id, 45);
  assert.deepEqual(creditsPage(filterCredits(rows, 'no match')).rows, []);
  assert.equal(filterCredits(rows, '字').length, 473);
});
