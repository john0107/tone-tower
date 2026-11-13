import { cantonese } from '../../src/languages/profiles.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadProgress,
  saveProgress,
  recordRun,
  resetProgress,
  emptyProgress,
} from '../../src/persistence/progress.js';
import { createRun, defaultPractice } from '../../src/game/game-core.js';
const PROGRESS_KEY = cantonese.storageKey;
const storage = (values) => {
  const data = new Map(
    Object.entries(values ?? {}).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
};
const words = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  syllables: [{ text: '字', transcription: `zi${(i % 6) + 1}`, tone: (i % 6) + 1 }],
}));

test('current records and preferences round-trip through storage', () => {
  const current = emptyProgress(cantonese);
  current.settings.toneVariant = 'hard';
  current.settings.tideVariant = 'full';
  current.records.tone.normal = { runs: 4, wins: 2, best: 100, fewest: 3 };
  current.records.tide.full.hard = { runs: 3, wins: 0, best: 42, fewest: null };
  const target = storage({ [PROGRESS_KEY]: current }),
    progress = loadProgress(cantonese, target);
  assert.equal(progress.version, 3);
  assert.equal(progress.settings.toneVariant, 'hard');
  assert.equal(progress.settings.tideVariant, 'full');
  assert.equal(progress.records.tone.normal.wins, 2);
  assert.equal(progress.records.tide.full.hard.best, 42);
  assert.deepEqual(progress, current);
  assert.deepEqual(loadProgress(cantonese, target), progress);
});

test('challenge records save once and practice never changes official records', () => {
  const progress = emptyProgress(cantonese);
  const run = createRun({ challenge: 'tone', variant: 'extreme' }, words, {
    profile: cantonese,
    random: () => 0.2,
  });
  run.answer(run.choices.find((t) => t !== run.word.tone));
  recordRun(progress, run);
  recordRun(progress, run);
  assert.equal(progress.records.tone.extreme.runs, 1);
  assert.deepEqual(progress.missedIds, [run.word.id]);
  assert.equal(Object.values(progress.confusions)[0], 1);
  const practice = createRun(
    { ...defaultPractice('tone', cantonese), format: 'rehearsal', start: 100 },
    words,
    { profile: cantonese, random: () => 0.2 },
  );
  practice.answer(practice.word.tone);
  recordRun(progress, practice);
  assert.equal(progress.practice.runs, 1);
  assert.equal(progress.practice.completed, 1);
  assert.equal(progress.practice.cleared, 1);
  assert.equal(progress.records.tone.normal.wins, 0);
  const target = storage();
  assert.equal(saveProgress(cantonese, progress, target), true);
  assert.deepEqual(loadProgress(cantonese, target), progress);
});

test('malformed, blocked and unavailable storage fail safely', () => {
  const target = storage();
  target.data.set(PROGRESS_KEY, '{broken');
  assert.equal(loadProgress(cantonese, target).version, 3);
  const blocked = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  assert.deepEqual(loadProgress(cantonese, blocked), emptyProgress(cantonese));
  assert.equal(saveProgress(cantonese, emptyProgress(cantonese), blocked), false);
  assert.equal(resetProgress(cantonese, blocked).version, 3);
  const invalid = storage({
    [PROGRESS_KEY]: {
      version: emptyProgress(cantonese).version,
      settings: { toneVariant: 'wrong' },
      records: { tone: { normal: { runs: -1, wins: 999, best: 500, fewest: -2 } } },
      missedIds: ['a', 'a', 3],
    },
  });
  const safe = loadProgress(cantonese, invalid);
  assert.equal(safe.settings.toneVariant, 'normal');
  assert.deepEqual(safe.records.tone.normal, { runs: 0, wins: 0, best: 100, fewest: null });
  assert.deepEqual(safe.missedIds, ['a']);
});

test('reset clears current records and preferences', () => {
  const current = emptyProgress(cantonese);
  current.settings.toneVariant = 'hard';
  current.records.tone.normal.runs = 8;
  const target = storage({ [PROGRESS_KEY]: current });
  resetProgress(cantonese, target);
  assert.deepEqual(loadProgress(cantonese, target), emptyProgress(cantonese));
});

test('unsupported save versions start fresh', () => {
  for (const version of [undefined, 1, 2, 4]) {
    const previous = emptyProgress(cantonese);
    previous.version = version;
    previous.records.tone.easy.runs = 3;
    assert.deepEqual(
      loadProgress(cantonese, storage({ [PROGRESS_KEY]: previous })),
      emptyProgress(cantonese),
    );
  }
});

test('Skyrail difficulty records save independently', () => {
  const target = storage(),
    progress = emptyProgress(cantonese);
  const run = createRun(
    { challenge: 'tide', variant: 'full', difficulty: 'extreme' },
    [
      ...words,
      {
        id: 'multi',
        syllables: [
          { text: '你', transcription: 'nei5', tone: 5 },
          { text: '好', transcription: 'hou2', tone: 2 },
        ],
      },
    ],
    { profile: cantonese, random: () => 0.2 },
  );
  run.fail('timeout');
  recordRun(progress, run);
  recordRun(progress, run);
  assert.equal(progress.records.tide.full.extreme.runs, 1);
  assert.equal(progress.records.tide.full.normal.runs, 0);
  saveProgress(cantonese, progress, target);
  assert.deepEqual(loadProgress(cantonese, target), progress);
});
