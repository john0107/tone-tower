import test from 'node:test';
import assert from 'node:assert/strict';
import { animateWorld } from '../../src/world/world-runtime.js';

for (const height of [240, 400]) {
  test(`restarting a mounted ${height}px scene preserves its artwork scale`, (t) => {
    const frames = new Map();
    let nextId = 0;
    for (const [name, value] of Object.entries({
      requestAnimationFrame: (frame) => {
        frames.set(++nextId, frame);
        return nextId;
      },
      cancelAnimationFrame: (id) => frames.delete(id),
      matchMedia: () => ({ matches: false }),
    })) {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
      t.after(() => {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      });
    }
    const transforms = [];
    let draws = 0;
    const ctx = {
      setTransform: (...values) => transforms.push(values),
      fillRect: () => draws++,
      fillText() {},
      save() {},
      restore() {},
      translate() {},
      scale() {},
      clearRect() {},
      beginPath() {},
      rect() {},
      clip() {},
    };
    const canvas = {
      width: 480,
      height,
      isConnected: true,
      getContext: () => ctx,
      parentElement: { dataset: {}, style: { setProperty() {} } },
    };
    for (let restart = 0; restart < 4; restart++) {
      const scene = animateWorld(canvas, {
        scene: height === 400 ? 'hub' : 'tone',
        height,
        phase: 'answering',
      });
      assert.equal(canvas.width, 960, 'backing width must not double again on retry');
      assert.equal(canvas.height, height * 2);
      assert.deepEqual(transforms.at(-1), [2, 0, 0, 2, 0, 0]);
      assert.equal(frames.size, 1);
      const [id, frame] = frames.entries().next().value;
      frames.delete(id);
      const previousDraws = draws;
      frame(1000 + restart * 16);
      assert.ok(draws > previousDraws, 'the restarted scene still renders');
      scene.dispose();
      assert.equal(frames.size, 0, 'disposed scenes leave no animation running');
    }
  });
}
