import test from 'node:test';
import assert from 'node:assert/strict';
import { drawSprout, drawRepairSpan } from '../../src/world/pixel-art.js';
import { drawWorld, P } from '../../src/world/pixel-world.js';

function recordingContext() {
  const pixels = [];
  const transforms = [];
  return {
    pixels,
    transforms,
    fillRect(...rect) {
      pixels.push([...rect, this.fillStyle]);
    },
    fillText() {},
    save() {},
    restore() {},
    translate(...values) {
      transforms.push(values);
    },
    scale(...values) {
      assert.ok(values.every(Number.isInteger), 'no fractional sprite scaling');
    },
  };
}

test('pixel geometry stays on the integer grid across animated scene samples', () => {
  for (const scene of ['hub', 'tone', 'tower-entry', 'tower-rest', 'rail']) {
    for (const time of [0, 0.15, 0.37, 0.58, 1.2, 4.6]) {
      const ctx = recordingContext();
      drawWorld(ctx, {
        scene,
        time,
        actor: { x: 237.4, y: 206.3 },
        walking: true,
        count: 6,
        selected: 0,
        result: 'success',
        open: 0.65,
        walk: 0.38,
        elapsed: time,
        lives: 3,
        maxLives: 4,
      });
      assert.ok(ctx.pixels.length > 0);
      for (const pixel of ctx.pixels) {
        assert.ok(pixel.slice(0, 4).every(Number.isInteger), scene + ' contains a partial pixel');
        assert.ok(pixel[2] >= 0 && pixel[3] >= 0);
      }
    }
  }
});

test('reduced motion keeps ambient artwork and the explorer still as time changes', () => {
  for (const scene of ['hub', 'tone', 'tower-rest', 'rail']) {
    const samples = [0, 1.7, 4.6].map((time) => {
      const ctx = recordingContext();
      drawWorld(ctx, { scene, time, reduced: true, actor: { x: 237, y: 206 }, count: 2 });
      return ctx.pixels;
    });
    assert.deepEqual(samples[0], samples[1], scene);
    assert.deepEqual(samples[0], samples[2], scene);
  }
});

test('walking and facing have distinct poses without moving the ground shadow', () => {
  const draw = (time, direction = 1) => {
    const ctx = recordingContext();
    drawSprout(ctx, 100, 200, P, { time, walking: true, direction });
    return ctx.pixels;
  };
  const a = draw(0),
    b = draw(0.31),
    left = draw(0, -1);
  assert.notDeepEqual(a, b);
  assert.notDeepEqual(a, left);
  assert.deepEqual(a[0], b[0]);
});

test('bridge construction settles and reduced motion shows the completed span immediately', () => {
  const draw = (age, reduced = false) => {
    const ctx = recordingContext();
    drawRepairSpan(ctx, 200, P, { age, reduced });
    return ctx.pixels;
  };
  assert.notDeepEqual(draw(0.06), draw(1));
  assert.deepEqual(draw(1), draw(8));
  assert.deepEqual(draw(0, true), draw(1));
});
