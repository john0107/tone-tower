import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChoices, shuffle } from '../../src/game/logic.js';

test('every supported tone subset offers unique doors including the answer', () => {
  for (let mask = 1; mask < 64; mask++) {
    const pool = [1, 2, 3, 4, 5, 6].filter((tone) => mask & (1 << (tone - 1)));
    for (const count of [2, 3, 4, 6].filter((count) => count <= pool.length)) {
      for (const tone of pool) {
        const doors = buildChoices(tone, count, pool);
        assert.equal(doors.length, count);
        assert.equal(new Set(doors).size, count);
        assert.ok(doors.includes(tone));
        assert.ok(doors.every((door) => pool.includes(door)));
        if (count > 2)
          assert.deepEqual(
            doors,
            [...doors].sort((a, b) => a - b),
          );
      }
    }
  }
});

test('invalid door configurations fail before selecting questions', () => {
  for (const [tone, count, pool] of [
    [1, 6, [1, 2]],
    [1, 2, [1, 1]],
    [7, 2, [1, 2]],
    [1, 0, [1, 2]],
  ]) {
    assert.throws(() => buildChoices(tone, count, pool), /Choose enough different tones/);
  }
});

test('shuffling preserves the caller’s pool and all its members', () => {
  const pool = Object.freeze([1, 2, 3, 4, 5, 6]);
  const shuffled = shuffle(pool, () => 0);
  assert.notDeepEqual(shuffled, pool);
  assert.deepEqual([...shuffled].sort(), pool);
});
