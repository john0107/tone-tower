import test from 'node:test';
import assert from 'node:assert/strict';
import { createCountdown, createGameController } from '../../src/game/game-controller.js';

function fakeTime() {
  let time = 0,
    id = 0;
  const tasks = new Map();
  return {
    now: () => time,
    setTimeout: (fn, delay) => {
      tasks.set(++id, { fn, at: time + delay });
      return id;
    },
    clearTimeout: (key) => tasks.delete(key),
    advance(ms) {
      const end = time + ms;
      while (true) {
        const next = [...tasks]
          .filter(([, task]) => task.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        time = next[1].at;
        tasks.delete(next[0]);
        next[1].fn();
      }
      time = end;
    },
    get pending() {
      return tasks.size;
    },
  };
}
class Target {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  fire(type, event = {}) {
    event.preventDefault ??= () => {
      event.defaultPrevented = true;
    };
    for (const fn of this.listeners.get(type) ?? []) fn(event);
    return event;
  }
}
const decode = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
class Node extends Target {
  constructor(tag, attrs, doc) {
    super();
    this.tagName = tag.toUpperCase();
    this.doc = doc;
    this.attrs = {};
    this.dataset = {};
    this.style = {
      values: {},
      setProperty: (key, value) => {
        this.style.values[key] = value;
      },
    };
    this.classes = new Set();
    this.classList = {
      toggle: (name, on) => (on ? this.classes.add(name) : this.classes.delete(name)),
    };
    for (const match of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
      this.attrs[match[1]] = decode(match[2] ?? '');
      if (match[1].startsWith('data-'))
        this.dataset[match[1].slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = match[2];
    }
    this.id = this.attrs.id;
    this.value = this.attrs.value ?? '';
    this.disabled = Object.hasOwn(this.attrs, 'disabled');
    this.textContent = '';
    this.classes = new Set((this.attrs.class ?? '').split(' '));
  }
  setAttribute(key, value) {
    this.attrs[key] = value;
  }
  removeAttribute(key) {
    delete this.attrs[key];
  }
  focus() {
    this.doc.activeElement = this;
  }
  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
}
class App {
  constructor(doc) {
    this.doc = doc;
    this.dataset = {};
    this.nodes = [];
  }
  set innerHTML(html) {
    this.html = html;
    this.nodes = [...html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)].map(
      ([, tag, attrs]) => new Node(tag, attrs, this.doc),
    );
  }
  get innerHTML() {
    return this.html;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  querySelectorAll(selector) {
    if (selector.startsWith('#')) return this.nodes.filter((node) => node.id === selector.slice(1));
    if (selector.startsWith('['))
      return this.nodes.filter((node) => Object.hasOwn(node.attrs, selector.slice(1, -1)));
    if (selector === '.game-layout > :not(.pause-overlay)') return [];
    if (selector.startsWith('.'))
      return this.nodes.filter((node) => node.classes.has(selector.slice(1)));
    return [];
  }
}
const words = [
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `single-${i}`,
    character: `字${i}`,
    jyutping: `si${i + 1}`,
    tone: i + 1,
    syllables: [{ character: `字${i}`, jyutping: `si${i + 1}`, tone: i + 1 }],
    audio: `${i}.mp3`,
    gloss: 'example',
  })),
  {
    id: 'word-1',
    character: '你好',
    jyutping: 'nei5 hou2',
    audio: 'word-1.mp3',
    gloss: 'hello',
    syllables: [
      { character: '你', jyutping: 'nei5', tone: 5 },
      { character: '好', jyutping: 'hou2', tone: 2 },
    ],
  },
  {
    id: 'word-2',
    character: '早晨',
    jyutping: 'zou2 san4',
    audio: 'word-2.mp3',
    gloss: 'morning',
    syllables: [
      { character: '早', jyutping: 'zou2', tone: 2 },
      { character: '晨', jyutping: 'san4', tone: 4 },
    ],
  },
];
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function harness(extra = {}, recordings = words) {
  const time = fakeTime(),
    document = new Target();
  document.hidden = false;
  const app = new App(document),
    dialog = new Target();
  dialog.open = false;
  let current = null;
  const requests = [];
  const player = {
    preload() {},
    stop() {
      current?.resolve();
      current = null;
    },
    play(path) {
      this.stop();
      return new Promise((resolve, reject) => {
        current = { path, resolve, reject };
        requests.push(current);
      });
    },
  };
  const finished = [],
    homes = [];
  const controller = createGameController({
    app,
    player,
    dialog,
    words: recordings,
    anchors: words.slice(0, 6).map((word) => ({ ...word, anchor: true })),
    onFinish: (run) => finished.push(run),
    onHome: () => homes.push(true),
    environment: { ...time, document, ...extra },
  });
  return {
    time,
    document,
    app,
    dialog,
    player,
    requests,
    controller,
    finished,
    homes,
    click(id) {
      app.querySelector(id).fire('click');
    },
    audio() {
      requests.at(-1).resolve();
    },
  };
}

test('countdown freezes the exact remaining time and expires once', () => {
  const time = fakeTime();
  let expired = 0;
  const ticks = [];
  const clock = createCountdown({
    ...time,
    onTick: (left, total) => ticks.push([left, total]),
    onExpire: () => expired++,
  });
  clock.start(1000);
  time.advance(300);
  assert.equal(clock.remaining, 700);
  clock.pause();
  time.advance(5000);
  assert.equal(clock.remaining, 700);
  assert.equal(expired, 0);
  clock.resume();
  time.advance(699);
  assert.equal(expired, 0);
  time.advance(1);
  assert.equal(expired, 1);
  assert.equal(clock.remaining, 0);
  clock.resume();
  time.advance(1000);
  assert.equal(expired, 1);
  assert.deepEqual(ticks.at(-1), [0, 1000]);
});

test('Tide starts after audio, replay never resets time, and timeout costs one life', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide', variant: 'spelling' });
  assert.equal(h.controller.phase, 'listening');
  assert.match(h.app.innerHTML, /To the gap/);
  assert.doesNotMatch(h.app.innerHTML, /Untimed practice/);
  assert.equal(h.app.querySelector('#countdown').textContent, '15s');
  const mountedInput = h.app.querySelector('#jyutping-answer');
  h.time.advance(30000);
  assert.equal(h.controller.state.mistakes, 0);
  h.audio();
  await flush();
  assert.equal(h.controller.phase, 'answering');
  assert.equal(h.app.querySelector('#countdown').textContent, '15s');
  assert.equal(h.app.querySelector('#jyutping-answer'), mountedInput);
  assert.equal(h.app.querySelector('#rail-message').textContent, 'Type the highlighted syllable.');
  assert.equal(h.app.querySelector('.world-scene').dataset.phase, 'answering');
  h.time.advance(5000);
  h.click('#replay-word');
  h.time.advance(5000);
  h.audio();
  await flush();
  assert.equal(h.app.querySelector('#countdown').textContent, '5s');
  h.time.advance(5000);
  assert.equal(h.controller.phase, 'review');
  assert.equal(h.controller.state.lives, 3);
  assert.equal(h.controller.state.opened, 0);
  h.time.advance(60000);
  assert.equal(h.controller.state.mistakes, 1);
  h.click('#continue-game');
  h.audio();
  await flush();
  assert.equal(h.controller.phase, 'answering');
  assert.equal(h.app.querySelector('#countdown').textContent, '15s');
  assert.equal(h.app.querySelector('#jyutping-answer').value, '');
  h.controller.dispose();
});

test('pause, hidden pages and dialogs freeze time and keep typed text', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide' });
  h.audio();
  await flush();
  h.time.advance(5000);
  h.app.querySelector('#jyutping-answer').value = 'my answer';
  h.controller.pause();
  h.time.advance(30000);
  assert.equal(h.controller.state.mistakes, 0);
  assert.equal(h.app.querySelector('#jyutping-answer').value, 'my answer');
  h.controller.resume();
  assert.equal(h.app.querySelector('#countdown').textContent, '10s');
  h.document.hidden = true;
  h.document.fire('visibilitychange');
  h.time.advance(30000);
  assert.equal(h.controller.state.mistakes, 0);
  h.controller.resume();
  assert.ok(h.app.querySelector('#resume-game'));
  h.document.hidden = false;
  h.controller.resume();
  h.dialog.open = true;
  h.controller.pause('dialog');
  h.time.advance(30000);
  assert.equal(h.controller.state.mistakes, 0);
  h.dialog.open = false;
  h.dialog.fire('close');
  h.time.advance(20000);
  assert.equal(h.controller.state.mistakes, 1);
  h.controller.dispose();
});

test('typing permits spaces, auto-checks only correct input and locks a cleared answer', async () => {
  const h = harness();
  h.controller.start({
    challenge: 'tide',
    variant: 'full',
    practice: true,
    content: 'multi',
    target: 'whole',
    length: 10,
    timer: 'custom',
    seconds: 30,
  });
  h.audio();
  await flush();
  let input = h.app.querySelector('#jyutping-answer');
  input.value = 'wrong';
  input.fire('input');
  assert.equal(h.controller.state.guesses, 0);
  assert.equal(h.controller.state.mistakes, 0);
  const requests = h.requests.length,
    key = h.document.fire('keydown', { key: ' ', target: input });
  assert.equal(key.defaultPrevented, true);
  assert.equal(h.requests.length, requests + 1);
  h.audio();
  await flush();
  input.value = h.controller.state.expected();
  input.fire('input');
  assert.equal(h.controller.state.cleared, 1);
  assert.equal(h.controller.phase, 'correct');
  input.fire('input');
  h.time.advance(899);
  assert.equal(h.controller.state.cleared, 1);
  h.time.advance(1);
  assert.equal(h.controller.phase, 'listening');
  assert.equal(h.app.querySelector('#jyutping-answer').value, '');
  h.controller.dispose();
});

test('failed replay freezes its remaining time and replacement is unscored', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide' });
  h.audio();
  await flush();
  h.time.advance(5000);
  h.click('#replay-word');
  h.requests.at(-1).reject(Error('unavailable'));
  await flush();
  h.time.advance(60000);
  assert.equal(h.controller.state.mistakes, 0);
  assert.equal(h.app.querySelector('#countdown').textContent, '10s');
  assert.ok(h.app.querySelector('#replace-recording'));
  h.click('#replace-recording');
  assert.equal(h.controller.state.attempts, 0);
  assert.equal(h.controller.state.opened, 0);
  h.audio();
  await flush();
  assert.equal(h.app.querySelector('#countdown').textContent, '15s');
  h.controller.dispose();
});

test('timeout costs one life, stale audio cannot reactivate a disposed run, and practice can end', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide' });
  h.audio();
  await flush();
  h.app.querySelector('#jyutping-answer').value = 'partial';
  h.time.advance(15000);
  assert.equal(h.controller.state.lives, 3);
  assert.equal(h.controller.state.lastAnswer, 'partial');
  h.click('#replay-word');
  const pending = h.requests.at(-1);
  h.controller.dispose();
  pending.resolve();
  await flush();
  h.time.advance(60000);
  assert.equal(h.controller.active, false);
  assert.equal(h.controller.state.mistakes, 1);
  h.controller.start({ challenge: 'tone', practice: true, length: 'endless' });
  h.audio();
  await flush();
  h.click('#finish-practice');
  assert.equal(h.finished.length, 1);
  assert.equal(h.finished[0].status, 'complete');
  assert.equal(h.controller.active, false);
});

test('tone keyboard choices score once and a paused run cannot accept answers', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tone', variant: 'extreme' });
  h.audio();
  await flush();
  const right = h.controller.state.word.tone;
  h.document.fire('keydown', { key: String(right), repeat: true, target: { tagName: 'BODY' } });
  assert.equal(h.controller.state.cleared, 0);
  h.controller.pause();
  h.document.fire('keydown', { key: String(right), target: { tagName: 'BODY' } });
  assert.equal(h.controller.state.cleared, 0);
  h.controller.resume();
  h.document.fire('keydown', { key: String(right), target: { tagName: 'BODY' } });
  h.document.fire('keydown', { key: String(right), target: { tagName: 'BODY' } });
  assert.equal(h.controller.state.cleared, 1);
  assert.equal(h.controller.state.attempts, 1);
  h.controller.dispose();
});

test('a terminal mistake records once and offers retry in the same scene after its animation', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tone', variant: 'extreme' });
  h.audio();
  await flush();
  const wrong = h.controller.state.choices.find((tone) => tone !== h.controller.state.word.tone);
  h.document.fire('keydown', { key: String(wrong), target: { tagName: 'BODY' } });
  assert.equal(h.controller.state.status, 'lost');
  assert.equal(h.finished.length, 1);
  assert.equal(h.controller.active, true);
  assert.ok(h.app.querySelector('.run-conclusion'));
  assert.equal(h.app.querySelector('#continue-game'), null);
  assert.equal(h.app.querySelector('#retry-run').disabled, true);
  h.time.advance(2800);
  assert.equal(h.app.querySelector('#retry-run').disabled, false);
  assert.equal(h.app.querySelectorAll('.scene-frame').length, 1);
  h.document.fire('keydown', { key: 'Enter', target: { tagName: 'BODY' } });
  h.time.advance(60000);
  assert.equal(h.finished.length, 1);
  assert.equal(h.controller.active, true);
  h.controller.dispose();
});

test('switching runs rejects delayed audio callbacks from the previous prompt', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide' });
  const previous = h.requests.at(-1);
  h.controller.start({ challenge: 'tone' });
  previous.resolve();
  await flush();
  assert.equal(h.controller.phase, 'listening');
  assert.equal(h.app.querySelector('[data-tone]').disabled, true);
  h.audio();
  await flush();
  assert.equal(h.controller.phase, 'answering');
  assert.equal(h.app.querySelector('[data-tone]').disabled, false);
  h.controller.dispose();
  assert.equal(h.time.pending, 0);
});

test('Skyrail landings and progress describe spans', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide', practice: true, format: 'rehearsal', start: 20 });
  h.audio();
  await flush();
  const input = h.app.querySelector('#jyutping-answer');
  input.value = h.controller.state.expected();
  input.fire('input');
  assert.equal(h.controller.phase, 'landing');
  assert.match(h.app.innerHTML, /20 spans crossed/);
  assert.match(h.app.innerHTML, /Depart when ready/);
  assert.doesNotMatch(h.app.innerHTML, /Continue the ascent/);
  h.controller.dispose();
});

test('Tower removes in-game references and Space replays without scoring or choosing a door', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tone' });
  h.audio();
  await flush();
  assert.equal(h.app.querySelector('#show-reference'), null);
  assert.equal(h.app.querySelector('[data-reference-tone]'), null);
  const requests = h.requests.length,
    event = h.document.fire('keydown', { key: ' ', target: { tagName: 'BUTTON' } });
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.requests.length, requests + 1);
  assert.equal(h.controller.state.attempts, 0);
  h.audio();
  await flush();
  const wrong = h.controller.state.choices.find((t) => t !== h.controller.state.word.tone);
  h.document.fire('keydown', { key: String(wrong), target: { tagName: 'BODY' } });
  assert.equal(h.app.querySelector('.reference-grid'), null);
  assert.ok(h.app.querySelector('.answer-mark'));
  h.controller.dispose();
});

import { arrowChoiceIndex } from '../../src/game/game-controller.js';
test('three and four door arrows select the matching spatial door', async () => {
  for (const [count, start, keys] of [
    [3, 21, ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight']],
    [4, 41, ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown']],
  ]) {
    for (const key of keys) {
      const h = harness();
      h.controller.start({ challenge: 'tone', practice: true, format: 'rehearsal', start });
      h.audio();
      await flush();
      assert.equal(h.controller.state.choices.length, count);
      const expected = h.controller.state.choices[arrowChoiceIndex(count, key)];
      const event = h.document.fire('keydown', { key, target: { tagName: 'BODY' } });
      assert.equal(event.defaultPrevented, true);
      assert.equal(h.controller.state.lastAnswer, expected);
      h.controller.dispose();
    }
  }
  assert.equal(arrowChoiceIndex(6, 'ArrowLeft'), null);
});
test('review keeps one question in the same scene and retains typing controls', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide' });
  h.audio();
  await flush();
  const structure = () => ({
    questions: h.app.querySelectorAll('.scene-question').length,
    prompts: h.app.querySelectorAll('.word-prompt').length,
    forms: h.app.querySelectorAll('#typed-form').length,
    frames: h.app.querySelectorAll('.scene-frame').length,
  });
  const before = structure();
  assert.deepEqual(before, { questions: 1, prompts: 1, forms: 1, frames: 1 });
  h.app.querySelector('#jyutping-answer').value = 'unfinished';
  h.time.advance(15000);
  assert.deepEqual(structure(), before);
  assert.equal(h.app.querySelector('#jyutping-answer').value, 'unfinished');
  assert.equal(h.app.querySelector('#jyutping-answer').disabled, true);
  assert.ok(h.app.querySelector('.scene-status'));
  assert.ok(h.app.querySelector('.game-progress-label'));
  h.controller.dispose();
});

test('retry feedback clears on editing and timeout stays full until next prompt', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide' });
  h.audio();
  await flush();
  const input = h.app.querySelector('#jyutping-answer');
  input.value = 'zzz';
  input.fire('input');
  h.app.querySelector('#typed-form').fire('submit');
  assert.equal(h.app.dataset.outcome, 'retry');
  assert.equal(h.document.activeElement, input);
  assert.match(h.app.querySelector('#input-status').textContent, /No life lost/);
  const lives = h.controller.state.lives;
  input.value = 'zz';
  input.fire('input');
  assert.equal(h.app.dataset.outcome, 'answering');
  assert.doesNotMatch(h.app.querySelector('#input-status').textContent, /Not quite/);
  h.time.advance(25000);
  assert.equal(h.app.dataset.outcome, 'timeout');
  assert.equal(h.controller.state.lives, lives - 1);
  assert.equal(h.app.querySelector('.world-scene').style.values['--rail-progress'], '100%');
  assert.doesNotMatch(h.app.innerHTML, /Not quite—try again/);
  assert.match(h.app.innerHTML, /Connection missed — 1 life lost/);
  h.click('#continue-game');
  assert.equal(h.app.dataset.outcome, 'listening');
  assert.equal(h.app.querySelector('.world-scene').style.values['--rail-progress'], '0%');
  h.controller.dispose();
});
test('wrong door marks the correct answer without a success door', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tone' });
  h.audio();
  await flush();
  const right = h.controller.state.word.tone,
    wrong = h.controller.state.choices.find((t) => t !== right);
  h.document.fire('keydown', { key: String(wrong), target: { tagName: 'BODY' } });
  assert.equal(h.app.dataset.outcome, 'wrong');
  assert.ok(h.app.querySelector('.is-wrong'));
  assert.ok(h.app.querySelector('.is-answer'));
  assert.equal(h.app.querySelector('.is-correct'), null);
  assert.match(h.app.innerHTML, /bright door/);
  h.click('#continue-game');
  assert.equal(h.app.querySelector('.is-wrong'), null);
  h.audio();
  await flush();
  h.document.fire('keydown', {
    key: String(h.controller.state.word.tone),
    target: { tagName: 'BODY' },
  });
  assert.equal(h.app.dataset.outcome, 'success');
  assert.ok(h.app.querySelector('.is-correct'));
  h.controller.dispose();
});
test('Skyrail has no reveal or bottom sound guide, and retry stays available', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide' });
  h.audio();
  await flush();
  assert.equal(h.app.querySelector('#reveal-answer'), null);
  assert.equal(h.app.querySelector('#game-learn'), null);
  const input = h.app.querySelector('#jyutping-answer');
  input.value = 'zzz';
  h.app.querySelector('#typed-form').fire('submit');
  assert.equal(input.disabled, false);
  assert.equal(h.controller.phase, 'answering');
  assert.equal(h.controller.state.lives, 4);
  h.controller.dispose();
});

test('R replays from the spelling field without changing input or the remaining time', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide' });
  h.audio();
  await flush();
  h.time.advance(4000);
  const input = h.app.querySelector('#jyutping-answer');
  input.value = 'fu';
  input.fire('input');
  const attempts = h.controller.state.attempts,
    requests = h.requests.length;
  const event = h.document.fire('keydown', { key: 'r', target: input });
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.requests.length, requests + 1);
  assert.equal(input.value, 'fu');
  assert.equal(h.app.querySelector('#countdown').textContent, '11s');
  assert.equal(h.controller.state.attempts, attempts);
  h.document.fire('keydown', { key: 'r', target: input, isComposing: true });
  h.document.fire('keydown', { key: 'r', target: input, ctrlKey: true });
  assert.equal(h.requests.length, requests + 1);
  h.controller.dispose();
});

test('Skyrail gives each crossing 900ms, keeps typing enabled, and leaves checkpoints deliberate', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide', practice: true, length: 10 });
  h.audio();
  await flush();
  const oldId = h.controller.state.word.id,
    input = h.app.querySelector('#jyutping-answer');
  input.value = h.controller.state.expected();
  input.fire('input');
  assert.equal(h.controller.phase, 'correct');
  assert.equal(h.app.querySelector('#jyutping-answer').disabled, false);
  h.time.advance(899);
  assert.equal(h.controller.phase, 'correct');
  h.time.advance(1);
  assert.equal(h.controller.phase, 'listening');
  assert.notEqual(h.controller.state.word.id, oldId);
  assert.equal(h.app.querySelector('#jyutping-answer').value, '');
  h.audio();
  await flush();
  assert.equal(h.controller.phase, 'answering');
  h.controller.dispose();
  h.controller.start({ challenge: 'tide', practice: true, format: 'rehearsal', start: 20 });
  h.audio();
  await flush();
  h.app.querySelector('#jyutping-answer').value = h.controller.state.expected();
  h.app.querySelector('#typed-form').fire('submit');
  assert.equal(h.controller.phase, 'landing');
  assert.match(h.app.innerHTML, /Station reached/);
  assert.match(h.app.innerHTML, /Climber car/);
  h.time.advance(10000);
  assert.equal(h.controller.phase, 'landing');
  h.click('#continue-game');
  assert.equal(h.controller.phase, 'listening');
  h.controller.dispose();
});

test('audio recovery clears unavailable and retry styling without resetting the remaining clock', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide' });
  h.audio();
  await flush();
  h.time.advance(4000);
  const input = h.app.querySelector('#jyutping-answer');
  input.value = 'zzz';
  input.fire('input');
  h.app.querySelector('#typed-form').fire('submit');
  assert.match(h.app.querySelector('#rail-message').textContent, /No life lost/);
  input.value = 'zz';
  input.fire('input');
  assert.equal(h.app.querySelector('.rail-feedback').dataset.feedback, 'neutral');
  assert.doesNotMatch(h.app.querySelector('#rail-message').textContent, /Not quite/);
  h.click('#replay-word');
  h.requests.at(-1).reject(Error('offline'));
  await flush();
  assert.equal(h.app.dataset.outcome, 'unavailable');
  assert.match(h.app.innerHTML, /Clock stopped/);
  assert.ok(h.app.querySelector('#replace-recording'));
  h.time.advance(30000);
  h.click('#replay-word');
  h.audio();
  await flush();
  assert.equal(h.app.dataset.outcome, 'answering');
  assert.equal(h.app.querySelector('#replace-recording'), null);
  assert.equal(h.app.querySelector('#countdown').textContent, '11s');
  assert.equal(h.app.querySelector('#jyutping-answer').value, 'zz');
  assert.equal(h.controller.state.lives, 4);
  h.controller.dispose();
});

test('Tower checkpoints name the next district, restore lives and wait for Continue', async () => {
  const h = harness();
  h.controller.start({
    challenge: 'tone',
    practice: true,
    format: 'rehearsal',
    start: 20,
    lives: 'standard',
  });
  h.audio();
  await flush();
  h.controller.state.lives = 1;
  h.document.fire('keydown', {
    key: String(h.controller.state.word.tone),
    target: { tagName: 'BODY' },
  });
  assert.equal(h.controller.phase, 'landing');
  assert.equal(h.controller.state.lives, h.controller.state.maxLives);
  assert.ok(h.app.innerHTML.includes('20 floors lit · A rest landing'));
  assert.match(h.app.innerHTML, /Next: Rain Gallery · 3 doors/);
  assert.match(h.app.innerHTML, /Lives refilled/);
  assert.equal(h.app.querySelector('#continue-game').disabled, true);
  h.click('#continue-game');
  assert.equal(h.controller.phase, 'landing');
  assert.match(h.app.innerHTML, /lives restored/);
  assert.equal(h.app.querySelectorAll('#continue-game').length, 1);
  h.time.advance(10000);
  assert.equal(h.controller.phase, 'landing');
  h.click('#continue-game');
  assert.equal(h.controller.state.choices.length, 3);
  assert.equal(h.controller.state.opened, 20);
  h.controller.dispose();
});

test('Tower audio failure uses the fixed notice and replacement never awards a floor', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tone' });
  h.requests.at(-1).reject(Error('offline'));
  await flush();
  assert.match(h.app.innerHTML, /Recording unavailable/);
  assert.equal(h.app.querySelectorAll('#replace-recording').length, 1);
  const lives = h.controller.state.lives;
  h.click('#replace-recording');
  assert.equal(h.controller.state.opened, 0);
  assert.equal(h.controller.state.lives, lives);
  h.audio();
  await flush();
  assert.equal(h.app.querySelector('#replace-recording'), null);
  assert.equal(
    h.app.querySelector('#tower-message').textContent,
    'Listen to the highlighted syllable and choose its tone number.',
  );
  h.controller.dispose();
});

test('awarding progress during clock.pause cannot advance the displayed room before the door walk', async () => {
  const updates = [],
    h = harness({
      animateWorld: (canvas) => ({
        canvas,
        update: (state) => updates.push({ ...state }),
        dispose() {},
      }),
    });
  h.controller.start({ challenge: 'tone' });
  h.audio();
  await flush();
  h.document.fire('keydown', {
    key: String(h.controller.state.word.tone),
    target: { tagName: 'BODY' },
  });
  const finalTick = updates.find((s) => s.phase === 'answering' && s.progress === 1);
  assert.ok(finalTick);
  assert.equal(finalTick.floor, 0);
  assert.ok(updates.filter((s) => s.phase === 'correct').every((s) => s.floor === 0));
  h.time.advance(1699);
  assert.equal(h.controller.phase, 'correct');
  h.time.advance(1);
  assert.equal(h.controller.phase, 'listening');
  assert.equal(updates.at(-1).floor, 1);
  h.controller.dispose();
});

test('a Tower ending waits for an explicit action, including after pause and resume', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tone', practice: true, format: 'rehearsal', start: 100 });
  h.audio();
  await flush();
  h.document.fire('keydown', {
    key: String(h.controller.state.word.tone),
    target: { tagName: 'BODY' },
  });
  assert.equal(h.controller.state.status, 'complete');
  assert.equal(h.finished.length, 0);
  assert.ok(h.app.querySelector('.tower-run-end'));
  h.document.fire('keydown', { key: 'Enter', target: { tagName: 'BODY' } });
  assert.equal(h.finished.length, 0);
  h.controller.pause();
  h.time.advance(5000);
  h.controller.resume();
  h.time.advance(2800);
  assert.equal(h.finished.length, 0);
  h.time.advance(60000);
  assert.equal(h.finished.length, 0);
  h.document.fire('keydown', { key: 'Enter', target: { tagName: 'BODY' } });
  assert.equal(h.finished.length, 1);
});

test('a full Tower victory stays in one scene and records without a second ending page', async () => {
  const recordings = Array.from({ length: 120 }, (_, i) => ({
      ...words[i % 6],
      id: 'full-climb-' + i,
    })),
    h = harness({}, recordings);
  h.controller.start({ challenge: 'tone' });
  for (let floor = 1; floor <= 100; floor++) {
    h.audio();
    await flush();
    h.document.fire('keydown', {
      key: String(h.controller.state.word.tone),
      target: { tagName: 'BODY' },
    });
    if (floor < 100) {
      if (floor % 20 === 0) {
        h.time.advance(2400);
        h.click('#continue-game');
      } else h.time.advance(1700);
    }
  }
  assert.equal(h.controller.state.status, 'won');
  assert.match(h.app.innerHTML, /The whole tower is alight/);
  assert.equal(h.finished.length, 1);
  assert.equal(h.controller.active, true);
  assert.equal(h.app.querySelector('#continue-game'), null);
  assert.ok(h.app.querySelector('.run-conclusion'));
  h.time.advance(60000);
  assert.equal(h.finished.length, 1);
  assert.equal(h.app.querySelector('#retry-run').disabled, false);
  h.controller.dispose();
});

test('a Skyrail terminal timeout stays in-scene, records once, and never starts a new prompt', async () => {
  const h = harness();
  h.controller.start({ challenge: 'tide', difficulty: 'extreme' });
  h.audio();
  await flush();
  h.time.advance(15000);
  assert.equal(h.controller.state.status, 'lost');
  assert.equal(h.finished.length, 1);
  assert.ok(h.app.querySelector('.run-conclusion'));
  assert.equal(h.app.querySelector('#continue-game'), null);
  const requests = h.requests.length;
  h.time.advance(60000);
  assert.equal(h.requests.length, requests);
  assert.equal(h.finished.length, 1);
  assert.equal(h.controller.active, true);
  h.controller.dispose();
});

test('Tower progress exposes the full height while Skyrail retains its journey readout', async () => {
  for (const challenge of ['tone', 'tide']) {
    const h = harness();
    h.controller.start({ challenge });
    h.audio();
    await flush();
    if (challenge === 'tone') assert.match(h.app.innerHTML, /0 \/ 100 floors lit/);
    else assert.doesNotMatch(h.app.innerHTML, /of 100|\/ 100|aria-valuemax="100"/);
    h.controller.dispose();
  }
});

test('Tower starts playback immediately while its decorative entrance runs', async () => {
  const originalMatchMedia = globalThis.matchMedia;
  try {
    for (const reduced of [false, true]) {
      globalThis.matchMedia = () => ({ matches: reduced });
      const updates = [],
        h = harness({
          animateWorld: (canvas) => {
            canvas.getContext = () => ({});
            return { canvas, update: (state) => updates.push({ ...state }), dispose() {} };
          },
        });
      try {
        h.controller.start({ challenge: 'tone', variant: 'normal' });
        assert.equal(
          h.requests.length,
          1,
          'Start plays the first recording without waiting for the entrance',
        );
        assert.equal(h.requests[0].path, h.controller.state.word.audio);
        assert.equal(h.controller.phase, 'listening');
        assert.ok(
          updates.some((state) => state.entry),
          'The entrance may still animate during playback',
        );
        assert.equal(h.time.pending, 0, 'No entrance delay blocks playback');
        h.audio();
        await flush();
        assert.equal(h.controller.phase, 'answering');
        assert.equal(h.app.querySelector('[data-tone]').disabled, false);
        assert.equal(
          updates.at(-1).entry,
          false,
          'Choices appear as soon as the recording finishes',
        );
        h.document.fire('keydown', {
          key: String(h.controller.state.word.tone),
          target: { tagName: 'BODY' },
        });
        h.time.advance(1700);
        assert.equal(h.controller.phase, 'listening');
        assert.equal(
          h.requests.length,
          2,
          'The next recording starts immediately after the door crossing',
        );
        assert.equal(
          updates.at(-1).entry,
          false,
          'A short first recording cannot replay the entrance on the next prompt',
        );
      } finally {
        h.controller.dispose();
      }
    }
  } finally {
    if (originalMatchMedia === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = originalMatchMedia;
  }
});

test('practice uses its own starting scene with fixed progress and a finish action for either skill', async () => {
  for (const challenge of ['tone', 'tide']) {
    const snapshots = [];
    const h = harness({
      animateWorld: (canvas) => ({
        canvas,
        update: (state) => snapshots.push(state),
        dispose() {},
      }),
    });
    h.controller.start({
      challenge,
      practice: true,
      length: 20,
      content: 'single',
      timer: 'off',
      lives: 'unlimited',
    });
    h.audio();
    await flush();
    assert.match(h.app.innerHTML, challenge === 'tone' ? /Practice tones/ : /Practice spelling/);
    assert.ok(h.app.querySelector('#finish-practice'));
    for (let i = 0; i < 21; i++) {
      assert.equal(snapshots.at(-1).scene, challenge === 'tone' ? 'tone' : 'rail');
      assert.equal(snapshots.at(-1).progress, 0);
      assert.equal(snapshots.at(-1).floor, 0);
      assert.equal(snapshots.at(-1).timed, false);
      if (i === 20) break;
      if (challenge === 'tone')
        h.document.fire('keydown', {
          key: String(h.controller.state.word.tone),
          target: { tagName: 'DIV' },
        });
      else {
        const input = h.app.querySelector('#jyutping-answer');
        input.value = h.controller.state.expected();
        input.fire('input');
      }
      if (i < 19) {
        h.time.advance(900);
        h.audio();
        await flush();
      }
    }
    assert.equal(h.controller.state.status, 'complete');
    h.controller.dispose();
  }
});

test('focused Skyrail practice auto-checks only the selected word parts', async () => {
  for (const spellingFocus of ['initials', 'finals']) {
    const h = harness();
    h.controller.start({
      challenge: 'tide',
      practice: true,
      spellingFocus,
      variant: 'full',
      content: 'multi',
      target: 'whole',
      length: 20,
    });
    h.audio();
    await flush();
    const input = h.app.querySelector('#jyutping-answer');
    input.value = h.controller.state.expected();
    input.fire('input');
    assert.equal(h.controller.state.cleared, 1);
    assert.equal(h.controller.phase, 'correct');
    h.controller.dispose();
  }
});

test('a wrong final practice question completes the set and can open results', async () => {
  for (const challenge of ['tone', 'tide']) {
    const h = harness();
    h.controller.start({ challenge, practice: true, length: 10 });
    h.audio();
    await flush();
    for (let i = 0; i < 9; i++) {
      if (challenge === 'tone')
        h.document.fire('keydown', {
          key: String(h.controller.state.word.tone),
          target: { tagName: 'DIV' },
        });
      else {
        const input = h.app.querySelector('#jyutping-answer');
        input.value = h.controller.state.expected();
        input.fire('input');
      }
      h.time.advance(900);
      h.audio();
      await flush();
    }
    if (challenge === 'tone')
      h.document.fire('keydown', {
        key: String(h.controller.state.choices.find((t) => t !== h.controller.state.word.tone)),
        target: { tagName: 'DIV' },
      });
    else {
      h.app.querySelector('#jyutping-answer').value = 'incorrect';
      h.app.querySelector('#typed-form').fire('submit');
    }
    assert.equal(h.controller.state.status, 'complete');
    assert.equal(h.controller.state.attempts, 10);
    assert.equal(h.controller.state.cleared, 9);
    assert.equal(h.controller.phase, 'review');
    assert.match(h.app.innerHTML, /10 \/ 10/);
    if (challenge === 'tone') h.time.advance(2400);
    h.click('#continue-game');
    assert.equal(h.finished.length, 1);
    h.controller.dispose();
  }
});
