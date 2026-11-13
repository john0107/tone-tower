import { Script } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  displayMandarinGloss,
  estimateMandarinTones,
  uniqueReading,
} from '../../tools/content/mandarin-beta.mjs';
import {
  correctMandarin,
  parseCedict,
  importDictionary,
  prepareMandarin,
  reviewQueue,
  importReviews,
  buildMandarinCatalog,
  coverage,
  exportReview,
} from '../../tools/content/mandarin.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'tone-tower-curation-'));
  t.after(async () => {
    assert.equal(path.dirname(root), tmpdir());
    assert.ok(path.basename(root).startsWith('tone-tower-curation-'));
    await rm(root, { recursive: true, force: true });
  });
  const put = async (name, value) => {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(
      path.join(root, name),
      typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value),
    );
  };
  const texts = ['妈', '麻', '马', '骂', '妈妈', '你好', '行', '没有词条'];
  const recordings = [];
  for (let i = 0; i < texts.length; i++) {
    const bytes = Buffer.from('fixture audio ' + i),
      id = 'voice-' + i,
      file = 'audio/cmn/' + id + '.mp3';
    await put(file, bytes);
    recordings.push({
      id,
      sourceText: texts[i],
      audio: { file, bytes: bytes.length, sha256: digest(bytes), processing: 'Fixture' },
      source: { pageUrl: 'https://example.org/' + id },
      speaker: { name: 'Voice', id: 'speaker' },
      attribution: {
        author: 'Voice',
        license: 'CC0-1.0',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      },
    });
  }
  await put('data/audio/collections/cmn/recordings.json', {
    version: 1,
    language: 'cmn',
    recordings,
  });
  await put(
    'dictionary.txt',
    '# CC-CEDICT\n#! date=2026-11-07T03:55:59Z\n媽 妈 [ma1] /mother/\n麻 麻 [ma2] /hemp/\n馬 马 [ma3] /horse/\n罵 骂 [ma4] /scold/\n媽媽 妈妈 [ma1 ma5] /mum/\n你好 你好 [ni3 hao3] /hello/\n行 行 [xing2] /walk/\n行 行 [hang2] /row/\n花兒 花儿 [hua1 r5] /erhua flower/\n',
  );
  return { root, put, recordings };
}

test('dictionary importer handles editions explicitly and retains alternate readings', () => {
  assert.equal(parseCedict('你好 你好 [[ni3hao3]] /hello/', 'v2')[0].syllables.length, 2);
  assert.equal(
    parseCedict('你好 你好 [ni3 hao3] /hello/\n媽媽 妈妈 [[ma1ma5]] /mum/', 'mixed').length,
    2,
  );
  assert.throws(() => parseCedict('你好 你好 [[ni3hao3]] /hello/', 'v1'), /edition/);
  assert.throws(() => parseCedict('malformed', 'v1'), /Malformed/);
  assert.equal(parseCedict('花兒 花儿 [hua1 r5] /flower/', 'v1').length, 0);
});

test('dictionary matches remain unapproved; review import is validated and atomic', async (t) => {
  const f = await fixture(t),
    inventoryBefore = await readFile(
      path.join(f.root, 'data/audio/collections/cmn/recordings.json'),
      'utf8',
    );
  const source = await importDictionary(f.root, path.join(f.root, 'dictionary.txt'), 'v1');
  await prepareMandarin(f.root);
  assert.equal(source.snapshot.date, '2026-11-07T03:55:59Z');
  assert.match(source.snapshot.sha256, /^[a-f0-9]{64}$/);
  const queue = await reviewQueue(f.root);
  assert.equal(queue.find((r) => r.text === '行').candidates.length, 2);
  assert.equal(queue.at(-1).candidates.length, 0);
  assert.equal((await buildMandarinCatalog(f.root, { reviewedOnly: true })).recordings.length, 0);
  const annotations = {};
  for (const item of queue.slice(0, 6)) {
    const c = item.candidates[0];
    const realizedTones = item.text === '你好' ? [2, 3] : c.syllables.map((s) => s.tone);
    annotations[item.recordingId] = {
      status: 'approved',
      pronunciationId: c.pronunciationId,
      dictionarySha256: c.dictionarySha256,
      recordingSha256: item.recordingSha256,
      realizedTones,
      reviewer: 'Fixture reviewer',
      reviewedAt: '2026-11-13T12:00:00Z',
      reason: 'Fixture listening approval',
      references:
        item.text === '你好'
          ? []
          : [{ tone: realizedTones.at(-1), targetIndex: realizedTones.length - 1 }],
    };
  }
  await f.put('reviews.json', { version: 1, annotations });
  await importReviews(f.root, path.join(f.root, 'reviews.json'));
  const catalog = await buildMandarinCatalog(f.root, { reviewedOnly: true });
  assert.equal(catalog.recordings.length, 6);
  assert.equal(catalog.references.length, 5);
  assert.equal(catalog.availability.ready, false);
  assert.deepEqual(catalog.recordings.find((r) => r.id === 'voice-5').realizedTones, [2, 3]);
  assert.equal(catalog.entries.find((e) => e.forms.simplified === '妈').forms.traditional, '媽');
  assert.equal(
    await readFile(path.join(f.root, 'data/audio/collections/cmn/recordings.json'), 'utf8'),
    inventoryBefore,
  );
  const saved = await readFile(path.join(f.root, 'data/content/cmn/annotations.json'), 'utf8');
  annotations['voice-0'].realizedTones = [6];
  await f.put('reviews.json', { version: 1, annotations });
  await assert.rejects(importReviews(f.root, path.join(f.root, 'reviews.json')), /spoken syllable/);
  assert.equal(
    await readFile(path.join(f.root, 'data/content/cmn/annotations.json'), 'utf8'),
    saved,
  );
  annotations['voice-0'].realizedTones = [1];
  annotations['voice-0'].recordingSha256 = 'wrong';
  await f.put('reviews.json', { version: 1, annotations });
  await assert.rejects(importReviews(f.root, path.join(f.root, 'reviews.json')), /different audio/);
  await f.put('audio/cmn/voice-0.mp3', 'changed audio');
  await assert.rejects(buildMandarinCatalog(f.root, { reviewedOnly: true }), /integrity/);
});

test('review page exports decisions without modifying the archive or approving matches', async (t) => {
  const f = await fixture(t);
  await importDictionary(f.root, path.join(f.root, 'dictionary.txt'));
  await prepareMandarin(f.root);
  const target = path.join(f.root, '.audio-import-cache/cmn/pronunciation-review.html');
  await exportReview(f.root, target);
  const html = await readFile(target, 'utf8');
  new Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  assert.match(html, /Export edited reviews/);
  assert.match(html, /recordingSha256/);
  assert.match(html, /\.\.\/\.\.\//);
  assert.equal((await buildMandarinCatalog(f.root, { reviewedOnly: true })).recordings.length, 0);
});

test('release coverage needs isolated and contextual references plus full-run pools', () => {
  const catalog = {
    pronunciations: [
      { id: 'single', syllables: [{}] },
      { id: 'word', syllables: [{}, {}] },
    ],
    recordings: [],
    references: [1, 2, 3, 4, 5].map((t) => ({ tone: t })),
  };
  for (let i = 0; i < 20; i++)
    catalog.recordings.push({
      id: 's' + i,
      pronunciationId: 'single',
      realizedTones: [(i % 4) + 1],
    });
  for (let i = 0; i < 80; i++)
    catalog.recordings.push({
      id: 'w' + i,
      pronunciationId: 'word',
      realizedTones: [(i % 5) + 1, 3],
    });
  assert.equal(coverage(catalog).ready, true);
  catalog.recordings.pop();
  assert.equal(coverage(catalog).ready, false);
});

test('beta accepts unambiguous dictionary matches without inventing listening approval', async (t) => {
  const f = await fixture(t);
  await importDictionary(f.root, path.join(f.root, 'dictionary.txt'));
  await prepareMandarin(f.root);
  const before = await readFile(
    path.join(f.root, 'data/audio/collections/cmn/recordings.json'),
    'utf8',
  );
  const catalog = await buildMandarinCatalog(f.root);
  assert.equal(catalog.recordings.length, 6);
  assert.equal(catalog.availability.mode, 'beta');
  assert.equal(catalog.availability.assumed, 6);
  assert.equal(catalog.availability.reviewed, 0);
  assert.equal(catalog.availability.ambiguous, 1);
  assert.equal(catalog.availability.unmatched, 1);
  assert.ok(catalog.recordings.every((r) => r.toneEvidence.status === 'assumed'));
  assert.deepEqual(catalog.recordings.find((r) => r.id === 'voice-5').realizedTones, [2, 3]);
  assert.equal(catalog.references.length, 5);
  assert.equal(catalog.references.find((r) => r.tone === 5).targetIndex, 1);
  assert.equal(
    await readFile(path.join(f.root, 'data/audio/collections/cmn/recordings.json'), 'utf8'),
    before,
  );
  await assert.rejects(readFile(path.join(f.root, 'data/content/cmn/annotations.json')), {
    code: 'ENOENT',
  });
});

test('beta corrections can exclude, restore, resolve a reading and override tones', async (t) => {
  const f = await fixture(t);
  await importDictionary(f.root, path.join(f.root, 'dictionary.txt'));
  await prepareMandarin(f.root);
  await correctMandarin(f.root, { recordingId: 'voice-0', excluded: true, reason: 'Wrong clip' });
  assert.ok(!(await buildMandarinCatalog(f.root)).recordings.some((r) => r.id === 'voice-0'));
  await correctMandarin(f.root, {
    recordingId: 'voice-0',
    excluded: false,
    reason: 'Confirmed source label',
  });
  assert.ok((await buildMandarinCatalog(f.root)).recordings.some((r) => r.id === 'voice-0'));
  await correctMandarin(f.root, {
    recordingId: 'voice-5',
    realizedTones: [3, 3],
    reason: 'Correction fixture',
  });
  const corrected = (await buildMandarinCatalog(f.root)).recordings.find((r) => r.id === 'voice-5');
  assert.deepEqual(corrected.realizedTones, [3, 3]);
  assert.equal(corrected.toneEvidence.status, 'corrected');
  const ambiguous = (await reviewQueue(f.root)).find((r) => r.recordingId === 'voice-6');
  await correctMandarin(f.root, {
    recordingId: 'voice-6',
    pronunciationId: ambiguous.candidates[0].pronunciationId,
    reason: 'Resolve reading',
  });
  assert.equal((await buildMandarinCatalog(f.root)).recordings.length, 7);
  const saved = await readFile(path.join(f.root, 'data/content/cmn/corrections.json'), 'utf8');
  await assert.rejects(
    correctMandarin(f.root, { recordingId: 'voice-0', realizedTones: [7], reason: 'Invalid tone' }),
    /Corrected tones/,
  );
  await assert.rejects(
    correctMandarin(f.root, { recordingId: 'voice-0', excluded: true }),
    /reason/,
  );
  assert.equal(
    await readFile(path.join(f.root, 'data/content/cmn/corrections.json'), 'utf8'),
    saved,
  );
  await assert.rejects(readFile(path.join(f.root, 'data/content/cmn/annotations.json')), {
    code: 'ENOENT',
  });
});

test('beta skips unavailable audio instead of adding invalid files to the game', async (t) => {
  const f = await fixture(t);
  await importDictionary(f.root, path.join(f.root, 'dictionary.txt'));
  await prepareMandarin(f.root);
  await f.put('audio/cmn/voice-0.mp3', 'corrupted');
  const catalog = await buildMandarinCatalog(f.root);
  assert.equal(catalog.availability.unavailable, 1);
  assert.equal(catalog.recordings.length, 5);
});

test('beta estimates common sandhi while leaving dictionary spelling untouched', () => {
  for (const [text, parts, expected] of [
    ['你好', ['ni3', 'hao3'], [2, 3]],
    ['不是', ['bu4', 'shi4'], [2, 4]],
    ['一半', ['yi1', 'ban4'], [2, 4]],
    ['一天', ['yi1', 'tian1'], [4, 1]],
    ['第一次', ['di4', 'yi1', 'ci4'], [4, 1, 4]],
  ]) {
    const syllables = parts.map((transcription) => ({
      transcription,
      tone: Number(transcription.at(-1)),
    }));
    const pronunciation = { syllables };
    assert.deepEqual(
      estimateMandarinTones(pronunciation, { forms: { simplified: text } }).realizedTones,
      expected,
    );
    assert.deepEqual(
      syllables.map((s) => s.transcription),
      parts,
    );
  }
  const triple = {
    syllables: ['wo3', 'hen3', 'hao3'].map((transcription) => ({ transcription, tone: 3 })),
  };
  assert.deepEqual(
    estimateMandarinTones(triple, { forms: { simplified: '我很好' } }).toneTargets,
    [2],
  );
  const candidates = [
    { syllables: [{ transcription: 'ma3' }], gloss: 'surname Ma' },
    { syllables: [{ transcription: 'ma3' }], gloss: 'horse' },
  ];
  assert.equal(uniqueReading(candidates).gloss, 'horse');
});

test('game definitions stay concise and omit dictionary Pinyin cross-references', () => {
  const gloss = 'only have; there is only; see 只有[zhi3 you3]';
  assert.equal(displayMandarinGloss(gloss), 'only have; there is only');
  assert.equal(displayMandarinGloss('good 好[hao3]'), 'good 好');
  assert.ok(displayMandarinGloss('a '.repeat(200)).length <= 160);
});
