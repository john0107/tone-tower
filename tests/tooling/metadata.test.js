import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  addFrequencyMetadata,
  withPhoneticMetadata,
  FREQUENCY_SOURCE,
} from '../../tools/catalog/word-metadata.mjs';
import { updateWordMetadata } from '../../tools/catalog/metadata.mjs';
import { syncRegistry, assembleCatalog } from '../../tools/catalog/catalog.mjs';
import { withAudioLock } from '../../tools/audio/lock.mjs';

const checksum = 'a'.repeat(64);
const clip = (id, character, jyutping) => ({
  id,
  character,
  jyutping,
  tone: Number(jyutping.at(-1)),
  gloss: 'example',
  audio: 'audio/' + id + '.mp3',
  source: 'https://example.org/' + id,
  author: 'Example speaker',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  conversion: 'MP3',
});

test('frequency enrichment uses exact forms, tied ranks and explicit source provenance', () => {
  const input = [clip('a', '你', 'nei5'), clip('b', '水', 'seoi2'), clip('c', '佢', 'keoi5')];
  const registry = syncRegistry(input);
  const before = structuredClone(registry);
  const enriched = addFrequencyMetadata(registry, { 我: 30, 你: 20, 水: 20, e: 25 }, checksum);
  assert.deepEqual(enriched.words[0].metadata.frequency, {
    writtenForm: '你',
    count: 20,
    rank: 3,
    source: FREQUENCY_SOURCE,
    snapshotSha256: checksum,
    scope: 'written-form',
  });
  assert.equal(enriched.words[1].metadata.frequency.rank, 3);
  assert.equal(enriched.words[2].metadata, undefined);
  assert.deepEqual(enriched.recordingWords, registry.recordingWords);
  assert.deepEqual(
    enriched.words.map((w) => w.id),
    registry.words.map((w) => w.id),
  );
  assert.deepEqual(registry, before);
  assert.deepEqual(
    addFrequencyMetadata(enriched, { 我: 30, 你: 20, 水: 20, e: 25 }, checksum),
    enriched,
  );
  const refreshed = addFrequencyMetadata(enriched, { 我: 30 }, checksum);
  assert.equal(refreshed.words[0].metadata, undefined);
  registry.words[0].metadata = { frequency: { source: 'independent reference', count: 5 } };
  assert.deepEqual(
    addFrequencyMetadata(registry, { 你: 20 }, checksum).words[0].metadata,
    registry.words[0].metadata,
  );
});

test('invalid source data fails before metadata can be applied', () => {
  const registry = syncRegistry([clip('a', '你', 'nei5')]);
  for (const source of [null, [], {}, { 你: -1 }, { 你: 1.5 }, { 你: '20' }])
    assert.throws(() => addFrequencyMetadata(registry, source, checksum), /frequency map/);
  assert.throws(() => addFrequencyMetadata(registry, { 你: 20 }, 'bad'), /checksum/);
});

test('published phonetics follow corrected syllables and stale written-form evidence is removed', () => {
  const input = [clip('a', '你', 'nei5')];
  const registry = addFrequencyMetadata(syncRegistry(input), { 你: 20 }, checksum);
  const corrections = {
    version: 1,
    words: {
      'word-a': {
        character: '水',
        jyutping: 'seoi2',
        gloss: 'water',
        syllables: [{ character: '水', jyutping: 'seoi2', tone: 2 }],
        reason: 'Correct label',
      },
    },
    recordings: {},
  };
  const catalog = assembleCatalog(input, registry, corrections);
  assert.deepEqual(catalog.words[0].metadata, {
    phonetics: { syllableCount: 1, tonePattern: [2] },
  });
  assert.equal(registry.words[0].metadata.frequency.writtenForm, '你');
  const refreshed = addFrequencyMetadata(registry, { 水: 30 }, checksum, { 'word-a': '水' });
  assert.equal(refreshed.words[0].character, '你');
  assert.equal(
    assembleCatalog(input, refreshed, corrections).words[0].metadata.frequency.count,
    30,
  );
  assert.deepEqual(withPhoneticMetadata({ syllables: [{ tone: 5 }, { tone: 6 }] }).metadata, {
    phonetics: { syllableCount: 2, tonePattern: [5, 6] },
  });
});

test('metadata update persists into the catalog, is repeatable, and respects the audio lock', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'tone-tower-metadata-'));
  t.after(async () => {
    assert.equal(path.dirname(root), tmpdir());
    assert.ok(path.basename(root).startsWith('tone-tower-metadata-'));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, 'data/audio'), { recursive: true });
  const input = [clip('a', '你', 'nei5'), clip('b', '水', 'seoi2')];
  const corrections = { version: 1, words: {}, recordings: {} };
  for (const [file, data] of Object.entries({
    'content.json': input,
    'words.json': syncRegistry(input),
    'corrections.json': corrections,
  }))
    await writeFile(path.join(root, 'data/audio', file), JSON.stringify(data));
  await writeFile(path.join(root, 'frequency.json'), JSON.stringify({ 你: 20 }));
  const args = { root, frequencyFile: 'frequency.json' };
  const result = await updateWordMetadata(args);
  assert.equal(result.matched, 1);
  assert.equal(result.unknown, 1);
  const wordsFile = path.join(root, 'data/audio/words.json');
  const saved = await readFile(wordsFile, 'utf8');
  assert.equal(
    assembleCatalog(input, JSON.parse(saved), corrections).words[0].metadata.frequency.count,
    20,
  );
  await updateWordMetadata(args);
  assert.equal(await readFile(wordsFile, 'utf8'), saved);
  await withAudioLock(async () => {
    await assert.rejects(() => updateWordMetadata(args), /Another audio operation/);
  }, root);
});
