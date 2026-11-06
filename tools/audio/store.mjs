import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { atomicJSON, atomicText, readJSON } from '../lib/json.mjs';
export const audioHash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function readImportState(paths) {
  const content = await readJSON(paths.content);
  const review = await readJSON(paths.review, { version: 1, excluded: [] });
  if (review.version !== 1 || !Array.isArray(review.excluded))
    throw Error('Invalid import-review.json schema.');
  // Preserve decisions in an older checkout's ignored cache when upgrading.
  const cache = await readJSON(paths.state, {});
  if (Array.isArray(cache.excluded)) {
    for (const row of cache.excluded) {
      if (!review.excluded.some((existing) => existing.title === row.title))
        review.excluded.push(row);
    }
    await atomicJSON(paths.review, review);
    delete cache.excluded;
    await atomicJSON(paths.state, cache);
  }
  const hashes = new Set();
  for (const row of content) {
    try {
      hashes.add(audioHash(await readFile(path.join(paths.root, row.audio))));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const existing = new Set(
    (await readdir(path.join(paths.root, 'audio'))).map((name) => 'audio/' + name),
  );
  return { content, review, hashes, existing };
}

export const isImported = (item, { content, existing }) =>
  content.some(
    (row) =>
      (row.id === 'commons-' + item.pageid || row.title === item.title) && existing.has(row.audio),
  );

export async function exportDownloadList(paths, queue, state) {
  const csv = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  await atomicText(
    paths.csv,
    [
      'recording_id,title,expected_filename,source,status',
      ...queue.map((item) =>
        [
          'commons-' + item.pageid,
          item.title,
          item.title.replace(/^File:/, ''),
          'https://commons.wikimedia.org/?curid=' + item.pageid,
          isImported(item, state)
            ? 'imported'
            : state.review.excluded.some((row) => row.title === item.title)
              ? 'review'
              : 'pending',
        ]
          .map(csv)
          .join(','),
      ),
    ].join('\n') + '\n',
  );
}

export async function recordExclusion(paths, review, title, reason) {
  review.excluded = [...review.excluded.filter((row) => row.title !== title), { title, reason }];
  await atomicJSON(paths.review, review);
}
