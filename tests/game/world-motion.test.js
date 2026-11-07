import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneMotion } from '../../src/world/world-motion.js';
import { doorSlots, drawWorld } from '../../src/world/pixel-world.js';
test('a correct door opens before the explorer finishes entering', () => {
  const early = sceneMotion({ phase: 'correct' }, 0.2),
    late = sceneMotion({ phase: 'correct' }, 1.3);
  assert.ok(early.open > 0);
  assert.equal(early.walk, 0);
  assert.equal(late.open, 1);
  assert.equal(late.walk, 1);
  assert.equal(late.fall, 0);
  assert.equal(late.build, 1);
});
test('wrong doors recoil and reveal never triggers a fall or celebration', () => {
  const outward = sceneMotion({ phase: 'review', reason: 'tone' }, 0.5),
    back = sceneMotion({ phase: 'review', reason: 'tone' }, 1.3),
    reveal = sceneMotion({ phase: 'review', reason: 'reveal' }, 2);
  assert.ok(outward.walk > 0.8);
  assert.equal(back.walk, 0);
  assert.equal(back.fall, 0);
  assert.equal(reveal.result, '');
  assert.equal(reveal.fall, 0);
  assert.equal(reveal.build, 0);
  assert.equal(reveal.open, 0);
});
test('only deadline failure makes the railcar fall and reduced motion settles immediately', () => {
  assert.equal(sceneMotion({ phase: 'answering' }, 10).fall, 0);
  assert.equal(sceneMotion({ phase: 'review', reason: 'timeout' }, 0.45).fall, 0);
  assert.equal(sceneMotion({ phase: 'review', reason: 'timeout' }, 2).fall, 1);
  assert.equal(sceneMotion({ phase: 'review', reason: 'timeout' }, 0, true).fall, 1);
  const success = sceneMotion({ phase: 'landing' }, 0, true);
  assert.equal(success.walk, 1);
  assert.equal(success.build, 1);
  assert.equal(success.travel, 0);
});
test('all door hit regions stay within the 480 by 240 room and do not overlap', () => {
  for (const count of [2, 3, 4, 6]) {
    const slots = doorSlots(count);
    assert.equal(slots.length, count);
    for (const [x, y, w, h] of slots) {
      assert.ok(x >= 0 && y >= 0 && x + w <= 480 && y + h <= 240);
      assert.ok(w >= 48 && h >= 55);
    }
    for (let i = 0; i < slots.length; i++)
      for (let j = i + 1; j < slots.length; j++) {
        const [x, y, w, h] = slots[i],
          [a, b, c, d] = slots[j];
        assert.ok(x + w <= a || a + c <= x || y + h <= b || b + d <= y);
      }
  }
});
test('the renderer handles interior, entry, moving rail and falling rail at progress boundaries', () => {
  let draws = 0;
  const ctx = {
    fillRect(x, y, w, h) {
      assert.ok([x, y, w, h].every(Number.isFinite));
      assert.ok(w >= 0 && h >= 0);
      draws++;
    },
    fillText(value, x, y) {
      assert.ok([x, y].every(Number.isFinite));
    },
    save() {},
    restore() {},
    translate(x, y) {
      assert.ok([x, y].every(Number.isFinite));
    },
    scale(x, y) {
      assert.ok([x, y].every(Number.isFinite));
    },
  };
  for (const scene of ['hub', 'tone', 'tower-entry', 'tower-rest', 'rail'])
    for (const count of [2, 3, 4, 6])
      for (const progress of [0, 19, 20, 40, 60, 80, 100])
        for (const phase of ['answering', 'correct', 'review']) {
          drawWorld(ctx, {
            scene,
            height: scene === 'hub' ? 400 : 240,
            count,
            progress,
            time: 3,
            actor: { x: 111, y: 202 },
            selected: 0,
            chosen: 0,
            remaining: 0,
            approach: 1,
            entry: 1,
            ...sceneMotion({ phase, reason: 'timeout' }, 1),
          });
        }
  assert.ok(draws > 0);
});

test('the trackside signal shows GO only for success, with a stopped red deadline on timeout', () => {
  const draw = (phase, remaining) => {
    const labels = [];
    const ctx = {
      fillRect() {},
      fillText(value) {
        labels.push({ value, color: this.fillStyle });
      },
    };
    drawWorld(ctx, {
      scene: 'rail',
      phase,
      progress: 0,
      remaining,
      timed: true,
      lives: 3,
      maxLives: 4,
      ...sceneMotion({ phase, reason: phase === 'review' ? 'timeout' : null }, 1),
    });
    return labels;
  };
  const success = draw('correct', 5),
    failure = draw('review', 0),
    next = draw('answering', 15);
  assert.ok(success.some((x) => x.value === 'GO'));
  assert.ok(failure.some((x) => x.value === '0s'));
  assert.ok(!failure.some((x) => x.value === 'GO'));
  assert.ok(next.some((x) => x.value === '15s'));
  assert.ok(!next.some((x) => x.value === 'GO'));
  assert.notEqual(
    success.find((x) => x.value === 'GO').color,
    failure.find((x) => x.value === '0s').color,
  );
});

import { drawFinale } from '../../src/world/world-finale.js';
test('both epilogues render finite geometry through arrival and reduced motion', () => {
  let draws = 0;
  const ctx = {
    fillRect(x, y, w, h) {
      assert.ok([x, y, w, h].every(Number.isFinite));
      assert.ok(w >= 0 && h >= 0);
      draws++;
    },
  };
  const palette = {
    sky: '#263f58',
    far: '#385669',
    cloud: '#66848b',
    mist: '#8fa49a',
    stone: '#647b7c',
    edge: '#a1aaa0',
    shade: '#405b65',
    deep: '#293f4b',
    grass: '#6d947d',
    leaf: '#a1b98a',
    cream: '#f4d8a1',
    gold: '#d7a65c',
    wood: '#9a6853',
    red: '#d77c72',
    water: '#6aabaa',
    teal: '#83c5bc',
    glass: '#b5dbcf',
    dark: '#172b38',
  };
  for (const scene of ['tone', 'rail'])
    for (const elapsed of [0, 0.5, 1.2, 2.6, 4, 6, 12, 60])
      for (const reduced of [false, true]) drawFinale(ctx, { scene, elapsed, reduced }, palette);
  assert.ok(draws > 0);
});
