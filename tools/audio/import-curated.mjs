import { readFile, writeFile, mkdir, readdir, rename, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const sourceDir = value('--source-dir', null),
  selectionPath = value('--selection', 'audio-review-queue.json'),
  batchSize = Number(value('--batch', '100')),
  exportOnly = args.includes('--export-only'),
  all = args.includes('--all');
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100)
  throw Error('Batch size must be 1–100');
const input = JSON.parse(await readFile(selectionPath, 'utf8'));
const queue = Array.isArray(input) ? input : input.candidates;
const content = JSON.parse(await readFile('content.json', 'utf8'));
const knownHashes = new Set();
for (const w of content) {
  try {
    knownHashes.add(
      createHash('sha256')
        .update(await readFile(w.audio))
        .digest('hex'),
    );
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
await mkdir('audio', { recursive: true });
await mkdir('.audio-import-cache', { recursive: true });
const atomic = async (file, text) => {
  const tmp = file + '.tmp-' + process.pid;
  await writeFile(tmp, text);
  await rename(tmp, file);
};
const cachePath = '.audio-import-cache/state.json';
let state = { metadata: {}, retryAfter: 0, excluded: [] };
try {
  state = { ...state, ...JSON.parse(await readFile(cachePath, 'utf8')) };
} catch {}
const persist = () => atomic(cachePath, JSON.stringify(state, null, 2));
const existingAudio = new Set((await readdir('audio')).map((name) => 'audio/' + name));
const done = (x) =>
  content.some(
    (w) => (w.id === 'commons-' + x.pageid || w.title === x.title) && existingAudio.has(w.audio),
  );
const csv = (x) => '"' + String(x ?? '').replaceAll('"', '""') + '"';
const writeList = () =>
  atomic(
    'audio-download-list.csv',
    [
      'recording_id,title,expected_filename,source,status',
      ...queue.map((x) =>
        [
          'commons-' + x.pageid,
          x.title,
          x.title.replace(/^File:/, ''),
          'https://commons.wikimedia.org/?curid=' + x.pageid,
          done(x)
            ? 'imported'
            : state.excluded.some((e) => e.title === x.title)
              ? 'review'
              : 'pending',
        ]
          .map(csv)
          .join(','),
      ),
    ].join('\n') + '\n',
  );
await writeList();
if (exportOnly) {
  console.log('Exported', queue.length, 'candidates');
  process.exit(0);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function request(url) {
  for (let n = 0; n < 5; n++) {
    const remaining = state.retryAfter - Date.now();
    if (remaining > 0) {
      console.log('Waiting', remaining, 'ms for rate limit');
      await sleep(remaining);
    }
    const r = await fetch(url, {
      headers: { 'User-Agent': 'TwoDoors/1.0 educational audio importer' },
      signal: AbortSignal.timeout(30000),
    });
    if (r.status !== 429) {
      if (!r.ok) throw Error('HTTP ' + r.status);
      return r;
    }
    const retry = r.headers.get('retry-after'),
      seconds = Number(retry),
      parsed = retry && !Number.isFinite(seconds) ? Date.parse(retry) - Date.now() : seconds * 1000;
    state.retryAfter = Date.now() + Math.max(60000, Number.isFinite(parsed) ? parsed : 0);
    await persist();
    console.log('Rate limited until', new Date(state.retryAfter).toISOString());
  }
  throw Error('Wikimedia rate limit');
}
const localNames = sourceDir ? new Set(await readdir(sourceDir)) : null;
const remaining = queue.filter(
  (x) =>
    !done(x) &&
    !state.excluded.some((e) => e.title === x.title) &&
    (!localNames ||
      localNames.has(x.title.replace(/^File:/, '')) ||
      localNames.has('commons-' + x.pageid + path.extname(x.title))),
);
const work = all ? remaining : remaining.slice(0, batchSize);
let imported = 0;
for (let offset = 0; offset < work.length; offset += batchSize) {
  const pending = work.slice(offset, offset + batchSize);
  const needed = pending.filter((x) => !state.metadata[x.pageid]);
  for (let i = 0; i < needed.length; i += 40) {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    u.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      pageids: needed
        .slice(i, i + 40)
        .map((x) => x.pageid)
        .join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|sha1',
    });
    const batch = await (await request(u)).json();
    for (const p of Object.values(batch.query.pages)) state.metadata[p.pageid] = p;
    await persist();
    await sleep(1500);
  }
  for (const item of pending) {
    let createdAudio,
      contentIndex,
      previousEntry,
      manifestSaved = false;
    try {
      if (
        !item.title ||
        !item.character ||
        !item.gloss ||
        ![1, 2].includes(item.syllables?.length) ||
        item.syllables.some(
          (s) => !s.character || !s.jyutping || s.tone !== Number(s.jyutping.at(-1)),
        ) ||
        item.syllables.map((s) => s.character).join('') !== item.character ||
        item.syllables.map((s) => s.jyutping).join(' ') !== item.jyutping
      )
        throw Error('Invalid syllable alignment');
      const page = state.metadata[item.pageid],
        info = page?.imageinfo?.[0],
        meta = info?.extmetadata;
      if (!info?.descriptionurl || !meta?.Artist?.value) throw Error('Missing source or author');
      const license = meta.LicenseShortName?.value;
      if (
        !license ||
        !meta.LicenseUrl?.value ||
        (!license.startsWith('CC BY') &&
          !license.includes('Public domain') &&
          !license.includes('CC0'))
      )
        throw Error('Licence requires review');
      const original = new URL(info.url);
      original.search = '';
      let bytes;
      if (sourceDir) {
        const names = [
          item.title.replace(/^File:/, ''),
          'commons-' + item.pageid + path.extname(original.pathname),
        ];
        for (const name of names) {
          try {
            bytes = await readFile(path.join(sourceDir, name));
            break;
          } catch (e) {
            if (e.code !== 'ENOENT') throw e;
          }
        }
        if (!bytes) {
          console.log('LOCAL FILE MISSING', item.title);
          continue;
        }
      } else {
        console.log('Downloading', item.title);
        const response = await request(original.href);
        if (response.headers.get('content-type')?.includes('text/html'))
          throw Error('Source is not audio');
        bytes = Buffer.from(await response.arrayBuffer());
      }
      if (info.sha1 && createHash('sha1').update(bytes).digest('hex') !== info.sha1)
        throw Error('Original checksum does not match Commons');
      const mp3 = execFileSync(
        'ffmpeg',
        [
          '-v',
          'error',
          '-i',
          'pipe:0',
          '-f',
          'mp3',
          '-codec:a',
          'libmp3lame',
          '-q:a',
          '4',
          'pipe:1',
        ],
        { input: bytes, maxBuffer: 20 * 1024 * 1024 },
      );
      if (mp3.length < 1000) throw Error('Audio too short');
      const hash = createHash('sha256').update(mp3).digest('hex');
      if (knownHashes.has(hash)) throw Error('Duplicate recording audio');
      const id = 'commons-' + item.pageid,
        audio = 'audio/' + id + '.mp3';
      createdAudio = audio;
      await writeFile(audio, mp3);
      const duration = Number(
        execFileSync(
          'ffprobe',
          [
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            audio,
          ],
          { encoding: 'utf8' },
        ),
      );
      if (!(duration > 0.1 && duration < 10)) throw Error('Unexpected duration');
      execFileSync('ffmpeg', ['-v', 'error', '-i', audio, '-f', 'null', '-']);
      const entry = {
        ...item,
        id,
        audio,
        anchor: false,
        source: info.descriptionurl,
        author: meta.Artist.value.replace(/<[^>]*>/g, ''),
        license,
        licenseUrl: meta.LicenseUrl?.value,
        originalSha1: info.sha1,
        conversion:
          'Converted from Wikimedia original to MP3 with FFmpeg; pronunciation unchanged.',
      };
      contentIndex = content.findIndex((w) => w.id === id);
      if (contentIndex < 0) contentIndex = content.length;
      previousEntry = content[contentIndex];
      content[contentIndex] = entry;
      await atomic('content.json', JSON.stringify(content, null, 2) + '\n');
      manifestSaved = true;
      createdAudio = null;
      existingAudio.add(audio);
      knownHashes.add(hash);
      imported++;
      await writeList();
      console.log('IMPORTED', id);
      await sleep(1500);
    } catch (e) {
      if (!manifestSaved && contentIndex !== undefined) {
        if (previousEntry) content[contentIndex] = previousEntry;
        else content.splice(contentIndex, 1);
      }
      if (createdAudio) await unlink(createdAudio).catch(() => {});
      if (
        manifestSaved ||
        ['EPERM', 'EACCES', 'ENOSPC', 'EBUSY'].includes(e.code) ||
        /rate limit|HTTP |fetch failed|timed out|aborted/i.test(e.message)
      )
        throw e;
      state.excluded.push({ title: item.title, reason: e.message });
      await persist();
      console.log('REVIEW', item.title, e.message);
    }
  }
  await writeList();
  console.log('Batch finished; imported so far:', imported);
}
console.log('Import finished; added:', imported);
