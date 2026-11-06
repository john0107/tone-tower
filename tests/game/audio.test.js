import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../../src/audio/audio.js';
test('replay interrupts the earlier clip and releases its pending promise', async () => {
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.paused = true;
    }
    load() {}
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  };
  const p = new Player();
  p.preload(['a', 'b']);
  const a = p.play('a');
  await Promise.resolve();
  const b = p.play('b');
  await a;
  assert.equal(p.cache.get('a').paused, true);
  assert.equal(p.cache.get('b').paused, false);
  p.stop();
  await b;
  assert.equal(p.cache.get('b').paused, true);
});
test('blocked playback and missing recordings reject cleanly and can be retried', async () => {
  let fail = true;
  globalThis.Audio = class {
    constructor() {
      this.currentTime = 0;
    }
    load() {}
    pause() {}
    play() {
      if (fail) {
        const e = Error('Playback blocked');
        e.name = 'NotAllowedError';
        return Promise.reject(e);
      }
      return Promise.resolve();
    }
  };
  const p = new Player();
  await assert.rejects(p.play('word'), { name: 'NotAllowedError' });
  fail = false;
  const retry = p.play('word');
  await Promise.resolve();
  p.current.onended();
  await retry;
  const missing = p.play('missing');
  await Promise.resolve();
  p.current.onerror();
  await assert.rejects(missing, /Recording unavailable/);
  p.stop();
});
