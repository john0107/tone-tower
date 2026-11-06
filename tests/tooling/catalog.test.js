import test from 'node:test';
import assert from 'node:assert/strict';
import { syncRegistry, assembleCatalog, emptyCorrections } from '../../tools/catalog/catalog.mjs';
import { catalogRows, chooseWordRecording } from '../../src/content/catalog.js';

const clip = (id, character = '你', jyutping = 'nei5', extra = {}) => ({
  id,
  character,
  jyutping,
  gloss: 'you',
  tone: Number(jyutping.at(-1)),
  audio: 'audio/' + id + '.mp3',
  anchor: false,
  source: 'https://example.org/' + id,
  author: 'Speaker ' + id,
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  conversion: 'MP3 conversion',
  ...extra,
});

test('multiple speakers share a persistent word identity; different readings remain distinct', () => {
  const input = [clip('a'), clip('b'), clip('c', '你', 'nei2')];
  const first = syncRegistry(input);
  assert.equal(first.words.length, 2);
  assert.equal(first.recordingWords.a, first.recordingWords.b);
  assert.notEqual(first.recordingWords.a, first.recordingWords.c);
  const after = syncRegistry([...input.slice().reverse(), clip('d')], first);
  assert.deepEqual(after.recordingWords, { ...first.recordingWords, d: first.recordingWords.a });
  const rows = catalogRows(assembleCatalog(input, first));
  assert.deepEqual(
    rows.map((row) => row.id),
    ['a', 'b', 'c'],
  );
  assert.equal(rows[0].wordId, rows[1].wordId);
  assert.notEqual(rows[0].author, rows[1].author);
  assert.equal(rows[0].tone, 5);
});

test('manual corrections survive sync and can correct, reassign, and exclude without changing imports', () => {
  const input = [clip('a'), clip('b'), clip('c', '好', 'hou2', { gloss: 'good' })];
  const registry = syncRegistry(input);
  const corrections = {
    version: 1,
    words: {
      'word-a': {
        gloss: 'you, singular',
        metadata: { tags: ['pronoun'], frequency: { band: 'common', source: 'manual' } },
        reason: 'Clarify the meaning',
      },
    },
    recordings: {
      b: { wordId: 'word-c', reason: 'Recording actually says hou2' },
      c: { excluded: true, reason: 'Confirmed wrong recording' },
    },
  };
  const before = structuredClone(input);
  const updated = syncRegistry([...input, clip('d')], registry);
  const rows = catalogRows(assembleCatalog([...input, clip('d')], updated, corrections));
  assert.deepEqual(
    rows.map((row) => row.id),
    ['a', 'b', 'd'],
  );
  assert.equal(rows[0].gloss, 'you, singular');
  assert.equal(rows[1].jyutping, 'hou2');
  assert.equal(rows[1].source, input[1].source);
  assert.equal(rows[2].wordId, 'word-a');
  assert.deepEqual(rows[2].metadata.tags, ['pronoun']);
  assert.deepEqual(input, before);
  assert.equal(registry.words[0].gloss, 'you');
});

test('a reading correction retains word ID and enforces aligned syllables', () => {
  const input = [clip('a')],
    registry = syncRegistry(input);
  const corrections = {
    version: 1,
    words: {
      'word-a': {
        jyutping: 'nei2',
        syllables: [{ character: '你', jyutping: 'nei2', tone: 2 }],
        reason: 'Correct the recorded reading',
      },
    },
    recordings: {},
  };
  const row = catalogRows(assembleCatalog(input, registry, corrections))[0];
  assert.equal(row.wordId, 'word-a');
  assert.equal(row.jyutping, 'nei2');
  assert.equal(row.tone, 2);
  corrections.words['word-a'].syllables[0].tone = 5;
  assert.throws(() => assembleCatalog(input, registry, corrections), /Invalid syllables/);
});

test('catalog rejects dangling references, duplicate IDs, malformed patches, and missing attribution', () => {
  const input = [clip('a')],
    registry = syncRegistry(input);
  assert.throws(() => syncRegistry([input[0], input[0]]), /duplicate recording/);
  assert.throws(
    () =>
      assembleCatalog(input, registry, {
        version: 1,
        words: {},
        recordings: { a: { wordId: 'missing', reason: 'Test' } },
      }),
    /Unknown corrected word/,
  );
  assert.throws(
    () =>
      assembleCatalog(input, registry, {
        version: 1,
        words: {},
        recordings: { a: { excluded: true } },
      }),
    /reason/,
  );
  assert.throws(
    () =>
      assembleCatalog(input, registry, {
        version: 1,
        words: {},
        recordings: { a: { exlcuded: true, reason: 'Typo' } },
      }),
    /Unknown correction field/,
  );
  assert.throws(
    () =>
      assembleCatalog(input, registry, {
        version: 1,
        words: {},
        recordings: { missing: { excluded: true, reason: 'Test' } },
      }),
    /Unknown recording correction/,
  );
  assert.throws(
    () => assembleCatalog([{ ...input[0], licenseUrl: '' }], registry),
    /Missing licenseUrl/,
  );
  assert.throws(
    () => assembleCatalog([{ ...input[0], audio: '../outside.mp3' }], registry),
    /Invalid audio path/,
  );
  assert.throws(
    () => catalogRows({ version: 1, words: [], recordings: [{ id: 'a', wordId: 'missing' }] }),
    /Missing word/,
  );
  assert.deepEqual(emptyCorrections(), { version: 1, words: {}, recordings: {} });
});

test('extra speakers do not increase word selection probability', () => {
  const rows = [clip('a'), clip('b'), clip('c'), clip('d')].map((row) => ({
    ...row,
    wordId: row.id === 'd' ? 'second-word' : 'first-word',
  }));
  const counts = {};
  for (let step = 0; step < 100; step++) {
    const values = [(step + 0.5) / 100, 0.5];
    const picked = chooseWordRecording(rows, () => values.shift());
    counts[picked.wordId] = (counts[picked.wordId] || 0) + 1;
  }
  assert.deepEqual(counts, { 'first-word': 50, 'second-word': 50 });
});
