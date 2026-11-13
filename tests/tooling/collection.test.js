import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  balancedCandidates,
  candidateFromTitle,
  inspectRecording,
  selectedLicense,
  RecordingReview,
} from '../../tools/audio/collection-commons.mjs';
import {
  collectionPaths,
  collectionStatus,
  downloadCollection,
} from '../../tools/audio/collection.mjs';
import { withAudioLock } from '../../tools/audio/lock.mjs';

const sourceConfig = JSON.parse(
  await readFile(new URL('../../data/audio/collections/cmn/sources.json', import.meta.url), 'utf8'),
);
const sha1 = (bytes) => createHash('sha1').update(bytes).digest('hex');
const wav = (frequency) =>
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=' + frequency + ':duration=0.3',
      '-f',
      'wav',
      'pipe:1',
    ],
    { windowsHide: true },
  );
const originals = [wav(440), wav(550), wav(660)];
const candidate = (pageid, speaker = 'Voice-' + pageid, text = '我') => ({
  pageid,
  title: 'File:LL-Q9192 (cmn)-' + speaker + '-' + text + '.wav',
});
function sourcePage(item, bytes = originals[item.pageid - 1], overrides = {}) {
  return {
    pageid: item.pageid,
    title: item.title,
    imageinfo: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/source-' + item.pageid + '.wav',
        descriptionurl: 'https://commons.wikimedia.org/?curid=' + item.pageid,
        mime: 'audio/wav',
        mediatype: 'AUDIO',
        size: bytes.length,
        sha1: sha1(bytes),
        timestamp: '2026-11-13T12:00:00Z',
        user: 'Uploader',
        extmetadata: {
          Artist: {
            value:
              '<ul><li>Speaker: <a href="//lingualibre.org/wiki/Q' +
              item.pageid +
              '">Voice ' +
              item.pageid +
              '</a></li><li>Recorder: <a href="//commons.wikimedia.org/wiki/User:Recorder">Recorder</a></li></ul>',
          },
          LicenseShortName: { value: 'CC0' },
          LicenseUrl: { value: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' },
        },
        ...overrides,
      },
    ],
    templates: [],
  };
}

async function fixture(t, { items = [candidate(1), candidate(2)], pages, media } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'tone-tower-collection-'));
  t.after(async () => {
    assert.equal(path.dirname(root), tmpdir());
    assert.ok(path.basename(root).startsWith('tone-tower-collection-'));
    await rm(root, { recursive: true, force: true });
  });
  const paths = collectionPaths(root, 'cmn');
  await mkdir(paths.data, { recursive: true });
  await mkdir(path.join(root, 'audio'), { recursive: true });
  await writeFile(paths.config, JSON.stringify(sourceConfig));
  const cantonese = path.join(root, 'data/audio/content.json');
  await writeFile(cantonese, '[{"existing":"Cantonese inventory"}]\n');
  await writeFile(path.join(root, 'audio/commons-999.mp3'), 'existing Cantonese bytes');
  const calls = [];
  const pageMap = pages || Object.fromEntries(items.map((item) => [item.pageid, sourcePage(item)]));
  const mediaMap =
    media || Object.fromEntries(items.map((item) => [item.pageid, originals[item.pageid - 1]]));
  const request = async (url, json = true) => {
    const parsed = new URL(url);
    calls.push(parsed.href);
    if (!json) {
      const id = Number(/source-(\d+)/.exec(parsed.pathname)?.[1]);
      return new Response(mediaMap[id], { headers: { 'content-type': 'audio/wav' } });
    }
    if (parsed.searchParams.get('list') === 'categorymembers')
      return parsed.searchParams.has('cmcontinue')
        ? { query: { categorymembers: items.slice(1) } }
        : {
            query: { categorymembers: items.slice(0, 1) },
            continue: { cmcontinue: 'next', continue: '-||' },
          };
    return {
      query: {
        pages: Object.fromEntries(
          parsed.searchParams
            .get('pageids')
            .split('|')
            .map((id) => [id, pageMap[id]]),
        ),
      },
    };
  };
  return {
    root,
    paths,
    calls,
    request,
    media: mediaMap,
    pages: pageMap,
    options: { root, request, log: () => {}, preflight: false },
  };
}
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));

test('collection selection keeps short Mandarin labels and schedules several speakers first', () => {
  const items = [candidate(1, 'One', '你'), candidate(2, 'One', '我'), candidate(3, 'Two', '好')];
  const config = sourceConfig;
  assert.deepEqual(
    balancedCandidates(items, config).map((row) => row.pageid),
    [1, 3, 2],
  );
  assert.equal(
    candidateFromTitle(candidate(4, 'Hyphen-Name', '你好'), config).speakerLabel,
    'Hyphen-Name',
  );
  for (const title of [
    'File:LL-Q9186 (yue)-Voice-你.wav',
    'File:LL-Q7850 (zho)-Voice-你.wav',
    'File:LL-Q9192 (cmn)-Voice-123块.wav',
    'File:LL-Q9192 (cmn)-Voice-我喜欢吃苹果.wav',
    'File:Zh-hello.ogg',
  ])
    assert.equal(candidateFromTitle({ pageid: 5, title }, config), null);
  assert.equal(
    candidateFromTitle({ pageid: 6, title: 'File:LL-Q9192—Yug—时候.wav' }, config).text,
    '时候',
  );
});

test('licence checks reject NC, ND, wrong versions and mismatched URLs', () => {
  const meta = (name, url) => ({ LicenseShortName: { value: name }, LicenseUrl: { value: url } });
  assert.equal(
    selectedLicense(
      meta('CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'),
      sourceConfig.selection.licenses,
    ).id,
    'CC-BY-SA-4.0',
  );
  for (const [name, url] of [
    ['CC BY-NC 4.0', 'https://creativecommons.org/licenses/by-nc/4.0/'],
    ['CC BY-ND 4.0', 'https://creativecommons.org/licenses/by-nd/4.0/'],
    ['CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/'],
    ['CC BY 4.0', 'https://creativecommons.org/licenses/by-nc/4.0/'],
    ['CC0', 'https://example.com/publicdomain/zero/1.0/'],
  ])
    assert.throws(
      () => selectedLicense(meta(name, url), sourceConfig.selection.licenses),
      RecordingReview,
    );
});

test('speaker identity comes from source credits, independently of filename and uploader', () => {
  const item = candidateFromTitle(candidate(1, 'Wrong-filename-speaker'), sourceConfig);
  const row = inspectRecording(sourcePage(item), item, sourceConfig);
  assert.equal(row.speaker.id, 'lingualibre-Q1');
  assert.equal(row.speaker.name, 'Voice 1');
  assert.equal(row.recorder.name, 'Recorder');
  assert.equal(row.source.uploader, 'Uploader');
  assert.equal(row.reviewStatus, 'unreviewed');
  const noSpeaker = sourcePage(item);
  noSpeaker.imageinfo[0].extmetadata.Artist.value = 'Uploader';
  assert.equal(inspectRecording(noSpeaker, item, sourceConfig).speaker, undefined);
  const deletion = sourcePage(item);
  deletion.templates = [{ title: 'Template:Delete' }];
  assert.throws(() => inspectRecording(deletion, item, sourceConfig), /source warning/);
});

test('paginated downloads resume, validate real MP3s and leave Cantonese data untouched', async (t) => {
  const f = await fixture(t);
  const first = await downloadCollection({ ...f.options, limit: 1 });
  assert.equal(first.downloaded, 1);
  let inventory = await json(f.paths.inventory);
  assert.equal(inventory.recordings.length, 1);
  assert.equal(inventory.recordings[0].reviewStatus, 'unreviewed');
  assert.ok(inventory.recordings[0].audio.duration > 0.1);
  assert.equal(inventory.recordings[0].original.sha1, sha1(originals[0]));
  const previousBytes = await readFile(path.join(f.root, inventory.recordings[0].audio.file));
  const requestCount = f.calls.length;
  const second = await downloadCollection(f.options);
  assert.equal(second.downloaded, 1);
  assert.equal(second.skipped, 1);
  assert.equal(f.calls.length - requestCount, 1, 'only the second original needs a request');
  inventory = await json(f.paths.inventory);
  assert.equal(inventory.recordings.length, 2);
  assert.deepEqual(
    await readFile(path.join(f.root, inventory.recordings[0].audio.file)),
    previousBytes,
  );
  const status = await collectionStatus({ root: f.root });
  assert.equal(status.discoveryComplete, true);
  assert.equal(status.pending, 0);
  assert.equal(status.linkedSpeakers, 2);
  assert.equal(status.multiSpeakerTexts, 1);
  assert.equal(
    await readFile(path.join(f.root, 'data/audio/content.json'), 'utf8'),
    '[{"existing":"Cantonese inventory"}]\n',
  );
  assert.equal(
    await readFile(path.join(f.root, 'audio/commons-999.mp3'), 'utf8'),
    'existing Cantonese bytes',
  );
  const before = f.calls.length;
  assert.equal((await downloadCollection(f.options)).downloaded, 0);
  assert.equal(f.calls.length, before, 'a completed queue makes no network requests');
});

test('missing and corrupted MP3s are repaired using pinned originals', async (t) => {
  const f = await fixture(t);
  await downloadCollection(f.options);
  const inventory = await json(f.paths.inventory);
  await unlink(path.join(f.root, inventory.recordings[0].audio.file));
  await writeFile(path.join(f.root, inventory.recordings[1].audio.file), 'corrupt');
  assert.equal((await collectionStatus({ root: f.root })).invalid.length, 2);
  const before = f.calls.length;
  assert.equal((await downloadCollection(f.options)).downloaded, 2);
  assert.equal(f.calls.length, before, 'cached source originals repair both files offline');
  assert.equal((await collectionStatus({ root: f.root })).invalid.length, 0);
});

test('source checksum failures are durable review decisions and can be explicitly retried', async (t) => {
  const f = await fixture(t, { items: [candidate(1)] });
  f.media[1] = Buffer.from('wrong original');
  assert.equal((await downloadCollection(f.options)).needsReview, 1);
  assert.equal((await json(f.paths.review)).recordings['commons-1'].code, 'source-checksum');
  await assert.rejects(readFile(f.paths.inventory), { code: 'ENOENT' });
  const before = f.calls.length;
  await downloadCollection(f.options);
  assert.equal(f.calls.length, before);
  f.media[1] = originals[0];
  assert.equal((await downloadCollection({ ...f.options, retryReview: true })).downloaded, 1);
  assert.deepEqual((await json(f.paths.review)).recordings, {});
});

test('cancellation preserves each finished recording and releases the shared operation lock', async (t) => {
  const f = await fixture(t);
  const abort = new AbortController();
  await assert.rejects(
    downloadCollection({
      ...f.options,
      signal: abort.signal,
      log: (line) => {
        if (line.startsWith('Saved ')) abort.abort();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal((await json(f.paths.inventory)).recordings.length, 1);
  await assert.rejects(readFile(path.join(f.root, '.audio-import-cache/pipeline.lock')), {
    code: 'ENOENT',
  });
  assert.equal((await downloadCollection(f.options)).downloaded, 1);
});

test('refresh rescans pending sources without replacing completed source versions', async (t) => {
  const f = await fixture(t, { items: [candidate(1)] });
  await downloadCollection(f.options);
  const before = await readFile(f.paths.inventory, 'utf8');
  f.pages[1].imageinfo[0].timestamp = '2026-11-14T12:00:00Z';
  f.pages[1].imageinfo[0].sha1 = sha1(originals[1]);
  const callCount = f.calls.length;
  await downloadCollection({ ...f.options, refresh: true });
  assert.equal(await readFile(f.paths.inventory, 'utf8'), before);
  assert.equal(f.calls.length - callCount, 2, 'refresh only rediscovers this completed collection');
});

test('unlicensed files and decode failures are reviewed without blocking the rest of the queue', async (t) => {
  const f = await fixture(t);
  f.pages[1].imageinfo[0].extmetadata.LicenseShortName.value = 'CC BY-NC 4.0';
  const result = await downloadCollection(f.options);
  assert.equal(result.downloaded, 1);
  assert.equal(result.needsReview, 1);
  assert.equal((await json(f.paths.inventory)).recordings[0].id, 'commons-2');
  const g = await fixture(t, { items: [candidate(1)] });
  assert.equal(
    (
      await downloadCollection({
        ...g.options,
        convert: () => {
          throw Error('Invalid audio');
        },
      })
    ).needsReview,
    1,
  );
  assert.equal((await json(g.paths.review)).recordings['commons-1'].code, 'decode');
});

test('duplicate source bytes keep provenance without inflating speaker coverage', async (t) => {
  const items = [candidate(1), candidate(2)];
  const f = await fixture(t, {
    items,
    pages: { 1: sourcePage(items[0]), 2: sourcePage(items[1], originals[0]) },
    media: { 1: originals[0], 2: originals[0] },
  });
  await downloadCollection(f.options);
  assert.equal((await json(f.paths.inventory)).recordings[1].duplicateOf, 'commons-1');
  assert.equal((await collectionStatus({ root: f.root })).multiSpeakerTexts, 0);
});

test('status is read-only and collection imports respect existing audio operation locks', async (t) => {
  const f = await fixture(t);
  const before = await readdir(f.paths.data);
  const status = await collectionStatus({ root: f.root });
  assert.equal(status.discoveryComplete, false);
  assert.equal(status.archived, 0);
  assert.deepEqual(await readdir(f.paths.data), before);
  await withAudioLock(async () => {
    await assert.rejects(downloadCollection(f.options), /Another audio operation is running/);
  }, f.root);
  assert.equal(f.calls.length, 0);
  assert.throws(() => collectionPaths(f.root, '../yue'), /Invalid collection ID/);
});
