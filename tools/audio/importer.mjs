import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { audioPaths } from './paths.mjs';
import { commonsClient, emptyCache, sleep } from './commons.mjs';
import { convertToMP3, validateMP3 } from './convert.mjs';
import {
  readImportState,
  isImported,
  audioHash,
  exportDownloadList,
  recordExclusion,
} from './store.mjs';
import { atomicJSON, readJSON } from '../lib/json.mjs';

export async function importAudio({
  root = process.cwd(),
  selection,
  sourceDir,
  batch = 100,
  all = false,
  exportOnly = false,
  signal,
} = {}) {
  if (!Number.isInteger(batch) || batch < 1 || batch > 100) throw Error('Batch size must be 1–100');
  const paths = audioPaths(root);
  const input = await readJSON(selection || paths.queue);
  const queue = Array.isArray(input) ? input : input.candidates;
  await mkdir(path.join(root, 'audio'), { recursive: true });
  const state = await readImportState(paths);
  await exportDownloadList(paths, queue, state);
  if (exportOnly) {
    console.log('Exported', queue.length, 'candidates to', paths.csv);
    return;
  }
  const request = commonsClient(paths.state, signal);
  const localNames = sourceDir ? new Set(await readdir(sourceDir)) : null;
  const remaining = queue.filter(
    (item) =>
      !isImported(item, state) &&
      !state.review.excluded.some((row) => row.title === item.title) &&
      (!localNames ||
        localNames.has(item.title.replace(/^File:/, '')) ||
        localNames.has('commons-' + item.pageid + path.extname(item.title))),
  );
  const work = all ? remaining : remaining.slice(0, batch);
  let imported = 0;
  for (let offset = 0; offset < work.length; offset += batch) {
    signal?.throwIfAborted();
    const pending = work.slice(offset, offset + batch);
    const cache = await readJSON(paths.state, emptyCache);
    const needed = pending.filter((item) => !cache.metadata[item.pageid]);
    for (let i = 0; i < needed.length; i += 40) {
      const url = new URL('https://commons.wikimedia.org/w/api.php');
      url.search = new URLSearchParams({
        action: 'query',
        format: 'json',
        pageids: needed
          .slice(i, i + 40)
          .map((item) => item.pageid)
          .join('|'),
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|sha1',
      });
      const result = await (await request(url)).json();
      Object.assign(cache, await readJSON(paths.state, emptyCache));
      for (const page of Object.values(result.query.pages)) cache.metadata[page.pageid] = page;
      await atomicJSON(paths.state, cache);
      await sleep(1500, signal);
    }
    for (const item of pending) {
      signal?.throwIfAborted();
      let createdAudio,
        contentIndex,
        previousEntry,
        manifestSaved = false;
      try {
        if (
          !Number.isSafeInteger(item.pageid) ||
          item.pageid <= 0 ||
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
        const info = cache.metadata[item.pageid]?.imageinfo?.[0];
        const meta = info?.extmetadata;
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
          for (const name of [
            item.title.replace(/^File:/, ''),
            'commons-' + item.pageid + path.extname(original.pathname),
          ]) {
            if (path.basename(name) !== name || name.includes('\\'))
              throw Error('Invalid source filename');
            try {
              bytes = await readFile(path.join(sourceDir, name));
              break;
            } catch (error) {
              if (error.code !== 'ENOENT') throw error;
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
        const mp3 = convertToMP3(bytes);
        const hash = audioHash(mp3);
        if (state.hashes.has(hash)) throw Error('Duplicate recording audio');
        const id = 'commons-' + item.pageid;
        const audio = 'audio/' + id + '.mp3';
        createdAudio = path.join(root, audio);
        await writeFile(createdAudio, mp3);
        await validateMP3(createdAudio);
        const entry = {
          ...item,
          id,
          audio,
          anchor: false,
          source: info.descriptionurl,
          author: meta.Artist.value.replace(/<[^>]*>/g, ''),
          license,
          licenseUrl: meta.LicenseUrl.value,
          originalSha1: info.sha1,
          conversion:
            'Converted from Wikimedia original to MP3 with FFmpeg; pronunciation unchanged.',
        };
        contentIndex = state.content.findIndex((row) => row.id === id);
        if (contentIndex < 0) contentIndex = state.content.length;
        previousEntry = state.content[contentIndex];
        state.content[contentIndex] = entry;
        await atomicJSON(paths.content, state.content);
        manifestSaved = true;
        createdAudio = null;
        state.existing.add(audio);
        state.hashes.add(hash);
        imported++;
        await exportDownloadList(paths, queue, state);
        console.log('IMPORTED', id);
        await sleep(1500, signal);
      } catch (error) {
        if (!manifestSaved && contentIndex !== undefined) {
          if (previousEntry) state.content[contentIndex] = previousEntry;
          else state.content.splice(contentIndex, 1);
        }
        if (createdAudio) await unlink(createdAudio).catch(() => {});
        if (
          manifestSaved ||
          signal?.aborted ||
          ['EPERM', 'EACCES', 'ENOSPC', 'EBUSY'].includes(error.code) ||
          /rate limit|HTTP |fetch failed|timed out|aborted/i.test(error.message)
        )
          throw error;
        await recordExclusion(paths, state.review, item.title, error.message);
        await exportDownloadList(paths, queue, state);
        console.log('REVIEW', item.title, error.message);
      }
    }
    console.log('Batch finished; imported so far:', imported);
  }
  console.log('Import finished; added:', imported);
}
