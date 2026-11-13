import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readJSON, atomicJSON, replaceFile } from '../lib/json.mjs';
import { audioPaths } from './paths.mjs';
import { commonsClient, sleep } from './commons.mjs';
import { withAudioLock } from './lock.mjs';
import { convertToMP3, validateMP3 } from './convert.mjs';
import {
  RecordingReview,
  balancedCandidates,
  inspectRecording,
  configHash,
  commonsQuery,
} from './collection-commons.mjs';

const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const fileExists = async (file) =>
  readFile(file).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
const emptyInventory = (config) => ({
  version: 1,
  collectionId: config.id,
  language: config.language,
  recordings: [],
});

export function collectionPaths(root, id) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw Error('Invalid collection ID');
  const data = path.join(root, 'data/audio/collections', id);
  const cache = path.join(root, '.audio-import-cache', id);
  return {
    root,
    data,
    cache,
    config: path.join(data, 'sources.json'),
    inventory: path.join(data, 'recordings.json'),
    review: path.join(data, 'review.json'),
    discovery: path.join(cache, 'discovery.json'),
    metadata: path.join(cache, 'metadata.json'),
    originals: path.join(cache, 'originals'),
  };
}

export async function loadCollection(root, id) {
  const paths = collectionPaths(root, id);
  const config = await readJSON(paths.config);
  const policy = config.selection;
  if (
    config.version !== 1 ||
    config.id !== id ||
    !/^[a-z]{3}$/.test(config.language || '') ||
    !Array.isArray(config.sources) ||
    config.sources.length !== 1 ||
    config.sources[0].adapter !== 'lingualibre-commons' ||
    !Array.isArray(config.sources[0].categories) ||
    !config.sources[0].categories.length ||
    config.sources[0].categories.some(
      (category) => typeof category !== 'string' || !category.startsWith('Category:'),
    ) ||
    !Number.isInteger(policy?.maxWrittenCharacters) ||
    policy.maxWrittenCharacters < 1 ||
    policy.maxWrittenCharacters > 10 ||
    !(policy.minDurationSeconds >= 0 && policy.maxDurationSeconds > policy.minDurationSeconds) ||
    !Number.isSafeInteger(policy.maxOriginalBytes) ||
    policy.maxOriginalBytes < 1 ||
    !Array.isArray(policy.licenses) ||
    !policy.licenses.length ||
    policy.licenses.some((license) => !['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0'].includes(license))
  )
    throw Error('Invalid collection source configuration');
  const inventory = await readJSON(paths.inventory, () => emptyInventory(config));
  const seen = new Set();
  if (
    inventory.version !== 1 ||
    inventory.collectionId !== id ||
    inventory.language !== config.language ||
    !Array.isArray(inventory.recordings)
  )
    throw Error('Invalid collection inventory');
  for (const row of inventory.recordings) {
    if (
      !/^commons-[1-9]\d*$/.test(row.id || '') ||
      seen.has(row.id) ||
      row.language !== config.language ||
      row.audio?.file !== 'audio/' + id + '/' + row.id + '.mp3' ||
      !/^[a-f0-9]{64}$/.test(row.audio?.sha256 || '') ||
      !/^[a-f0-9]{40}$/.test(row.original?.sha1 || '') ||
      !/^[a-f0-9]{64}$/.test(row.original?.sha256 || '') ||
      !Number.isSafeInteger(row.original.bytes) ||
      row.original.bytes < 1 ||
      !row.attribution?.license ||
      !row.source?.fileTimestamp
    )
      throw Error('Invalid or duplicate archived recording ' + row.id);
    seen.add(row.id);
  }
  const review = await readJSON(paths.review, { version: 1, recordings: {} });
  if (
    review.version !== 1 ||
    !review.recordings ||
    typeof review.recordings !== 'object' ||
    Array.isArray(review.recordings)
  )
    throw Error('Invalid collection review file');
  return { paths, config, inventory, review };
}

async function validLocalAudio(root, row) {
  const bytes = await fileExists(path.join(root, row.audio.file));
  return !!bytes && bytes.length === row.audio.bytes && hash(bytes) === row.audio.sha256;
}

async function discover(paths, config, request, refresh, signal, log) {
  const signature = configHash(config);
  let state = refresh ? null : await readJSON(paths.discovery, null);
  if (!state || state.scope !== signature)
    state = { version: 1, scope: signature, category: 0, continuation: null, items: [] };
  const seen = new Map(state.items.map((item) => [item.pageid, item]));
  const categories = config.sources[0].categories;
  for (let index = state.category; index < categories.length; index++) {
    let next = index === state.category ? state.continuation : null;
    do {
      signal?.throwIfAborted();
      const result = await request(
        commonsQuery({
          list: 'categorymembers',
          cmtitle: categories[index],
          cmtype: 'file',
          cmlimit: '500',
          ...(next || {}),
        }),
      );
      if (!Array.isArray(result.query?.categorymembers))
        throw Error('Invalid Commons category response');
      for (const item of result.query.categorymembers) seen.set(item.pageid, item);
      next = result.continue || null;
      state = {
        version: 1,
        scope: signature,
        category: next ? index : index + 1,
        continuation: next,
        items: [...seen.values()],
      };
      await atomicJSON(paths.discovery, state);
      log('Discovered ' + seen.size + ' files in ' + config.name);
    } while (next);
  }
  return state;
}

async function metadataFor(candidates, metadata, paths, request, signal) {
  const pages = {};
  let next;
  do {
    signal?.throwIfAborted();
    const result = await request(
      commonsQuery({
        prop: 'imageinfo|templates',
        pageids: candidates.map((item) => item.pageid).join('|'),
        iiprop: 'url|extmetadata|sha1|size|timestamp|mime|mediatype|user',
        tllimit: '500',
        ...(next || {}),
      }),
    );
    if (!result.query?.pages) throw Error('Invalid Commons recording response');
    for (const page of Object.values(result.query.pages)) {
      const previous = pages[page.pageid];
      pages[page.pageid] = {
        ...previous,
        ...page,
        templates: [...(previous?.templates || []), ...(page.templates || [])],
      };
    }
    next = result.continue;
  } while (next);
  for (const item of candidates)
    metadata[item.pageid] = pages[item.pageid] || { pageid: item.pageid, missing: true };
  await atomicJSON(paths.metadata, metadata);
}

export function transientCollectionError(error) {
  return (
    (error instanceof TypeError && /fetch failed/i.test(error.message)) ||
    ['TimeoutError'].includes(error.name) ||
    /HTTP (?:429|5\d\d)\b|timed out|ECONNRESET|ETIMEDOUT/i.test(error.message)
  );
}

function requester(paths, signal, log, options = {}) {
  const client = commonsClient(audioPaths(paths.root).state, signal, { log, ...options });
  return async (url, json = true) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await client(url);
        if (!json) return response;
        const result = await response.json();
        if (result.error) throw Error('Commons API error: ' + JSON.stringify(result.error));
        return result;
      } catch (error) {
        if (signal?.aborted || !transientCollectionError(error) || attempt >= 4) throw error;
        const delay = Math.min(600000, 30000 * 2 ** attempt);
        log(
          'Temporary request failure: ' +
            error.message +
            '; retrying in ' +
            delay / 1000 +
            ' seconds.',
        );
        await sleep(delay, signal);
      }
    }
  };
}

async function downloadBytes(request, row, policy, signal) {
  let response;
  try {
    response = await request(row.source.fileUrl, false);
  } catch (error) {
    if (/HTTP (?:404|410)\b/.test(error.message))
      throw new RecordingReview('missing-source', 'Original source file is no longer available');
    throw error;
  }
  if (response.headers.get('content-type')?.includes('text/html'))
    throw new RecordingReview('media', 'Source returned HTML instead of audio');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    signal?.throwIfAborted();
    size += chunk.length;
    if (size > policy.maxOriginalBytes)
      throw new RecordingReview('size', 'Downloaded original exceeds the collection size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function saveRecording({ root, paths, config, row, request, signal, convert, validate }) {
  const extension = /^audio\/(?:x-)?wav$/.test(row.original.mime)
    ? '.wav'
    : path.posix.extname(new URL(row.source.fileUrl).pathname).toLowerCase();
  if (!/^\.(?:wav|ogg|oga|flac|mp3|opus)$/.test(extension))
    throw new RecordingReview('media', 'Unsupported source audio extension');
  const originalFile = path.join(paths.originals, row.id + '-' + row.original.sha1 + extension);
  let bytes = await fileExists(originalFile);
  if (!bytes || bytes.length !== row.original.bytes || hash(bytes, 'sha1') !== row.original.sha1) {
    bytes = await downloadBytes(request, row, config.selection, signal);
    if (bytes.length !== row.original.bytes || hash(bytes, 'sha1') !== row.original.sha1)
      throw new RecordingReview(
        'source-checksum',
        'Original does not match its pinned Commons version; refresh source metadata or review a changed source',
      );
    await mkdir(paths.originals, { recursive: true });
    const temporary = originalFile + '.tmp-' + process.pid;
    try {
      await writeFile(temporary, bytes);
      await replaceFile(temporary, originalFile);
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }
  signal?.throwIfAborted();
  let mp3;
  try {
    mp3 = extension === '.mp3' ? bytes : convert(bytes);
  } catch (error) {
    if (typeof error.code === 'string' || signal?.aborted) throw error;
    throw new RecordingReview('decode', 'Could not convert the original: ' + error.message);
  }
  const relative = 'audio/' + config.id + '/' + row.id + '.mp3';
  const destination = path.join(root, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = destination + '.tmp-' + process.pid;
  try {
    await writeFile(temporary, mp3);
    let duration;
    try {
      duration = await validate(temporary, {
        minDuration: config.selection.minDurationSeconds,
        maxDuration: config.selection.maxDurationSeconds,
      });
    } catch (error) {
      if (typeof error.code === 'string' || signal?.aborted) throw error;
      throw new RecordingReview('decode', error.message);
    }
    signal?.throwIfAborted();
    await replaceFile(temporary, destination);
    return {
      ...row,
      original: { ...row.original, sha256: hash(bytes) },
      audio: {
        file: relative,
        sha256: hash(mp3),
        bytes: mp3.length,
        duration,
        processing:
          extension === '.mp3'
            ? 'Original MP3 preserved without re-encoding.'
            : 'Converted from the Commons original to MP3 with FFmpeg; no intentional pronunciation edits.',
      },
    };
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export async function downloadCollection({
  root = process.cwd(),
  collection = 'cmn',
  limit = Infinity,
  refresh = false,
  retryReview = false,
  signal,
  log = console.log,
  request: providedRequest,
  convert = convertToMP3,
  validate = validateMP3,
  preflight = true,
} = {}) {
  if (limit !== Infinity && (!Number.isSafeInteger(limit) || limit < 1))
    throw Error('Limit must be a positive integer');
  return withAudioLock(async () => {
    const { paths, config, inventory, review } = await loadCollection(root, collection);
    if (preflight)
      for (const executable of ['ffmpeg', 'ffprobe']) {
        const result = spawnSync(executable, ['-version'], { stdio: 'ignore', windowsHide: true });
        if (result.error || result.status !== 0)
          throw Error(executable + ' is required on PATH. Install FFmpeg first.');
      }
    const request = providedRequest || requester(paths, signal, log);
    const discovery = await discover(paths, config, request, refresh, signal, log);
    const candidates = balancedCandidates(discovery.items, config);
    const metadata = refresh ? {} : await readJSON(paths.metadata, {});
    if (retryReview)
      for (const id of Object.keys(review.recordings)) delete metadata[id.replace(/^commons-/, '')];
    const saved = new Map(inventory.recordings.map((row) => [row.id, row]));
    const pending = [];
    let skipped = 0,
      downloaded = 0,
      needsReview = 0;
    for (const item of candidates) {
      const id = 'commons-' + item.pageid;
      if (saved.has(id) && (await validLocalAudio(root, saved.get(id)))) {
        skipped++;
        continue;
      }
      if (!retryReview && review.recordings[id]) {
        needsReview++;
        continue;
      }
      pending.push(item);
    }
    log(
      config.name +
        ': ' +
        candidates.length +
        ' short-clip candidates; ' +
        skipped +
        ' saved and valid; ' +
        needsReview +
        ' need review; ' +
        pending.length +
        ' pending.',
    );
    for (let index = 0; index < pending.length && downloaded < limit; index++) {
      signal?.throwIfAborted();
      const item = pending[index],
        id = 'commons-' + item.pageid;
      try {
        let row = saved.get(id);
        if (!row) {
          if (!metadata[item.pageid])
            await metadataFor(
              pending
                .slice(index, index + 40)
                .filter(
                  (candidate) =>
                    !saved.has('commons-' + candidate.pageid) && !metadata[candidate.pageid],
                ),
              metadata,
              paths,
              request,
              signal,
            );
          row = inspectRecording(metadata[item.pageid], item, config);
        }
        // Repairs use the saved source version, not a newly changed pronunciation.
        log('Downloading ' + item.title);
        const result = await saveRecording({
          root,
          paths,
          config,
          row,
          request,
          signal,
          convert,
          validate,
        });
        const duplicate = inventory.recordings.find(
          (other) => other.id !== id && other.original.sha256 === result.original.sha256,
        );
        if (duplicate) result.duplicateOf = duplicate.id;
        const position = inventory.recordings.findIndex((entry) => entry.id === id);
        if (position < 0) inventory.recordings.push(result);
        else inventory.recordings[position] = result;
        await atomicJSON(paths.inventory, inventory);
        saved.set(id, result);
        if (review.recordings[id]) {
          delete review.recordings[id];
          await atomicJSON(paths.review, review);
        }
        downloaded++;
        log(
          'Saved ' +
            id +
            ' (' +
            downloaded +
            ' this run); ' +
            (result.speaker?.name || 'speaker unknown') +
            '; ' +
            result.attribution.license,
        );
      } catch (error) {
        if (signal?.aborted || !(error instanceof RecordingReview)) throw error;
        review.recordings[id] = { title: item.title, code: error.code, reason: error.message };
        await atomicJSON(paths.review, review);
        needsReview++;
        log('REVIEW ' + id + ': ' + error.message);
      }
    }
    log(
      'Finished: ' +
        downloaded +
        ' saved this run; ' +
        skipped +
        ' already valid; ' +
        needsReview +
        ' need review. Run the same command to continue.',
    );
    return { downloaded, skipped, needsReview, selected: candidates.length };
  }, root);
}

export async function collectionStatus({ root = process.cwd(), collection = 'cmn' } = {}) {
  const { paths, config, inventory, review } = await loadCollection(root, collection);
  const discovery = await readJSON(paths.discovery, null);
  const currentScope = discovery?.scope === configHash(config);
  const candidates = currentScope ? balancedCandidates(discovery.items, config) : [];
  const valid = new Set(),
    invalid = [],
    texts = new Map(),
    speakers = new Set();
  for (const row of inventory.recordings) {
    if (!(await validLocalAudio(root, row))) {
      invalid.push(row.id);
      continue;
    }
    valid.add(row.id);
    if (row.duplicateOf || !row.speaker?.id) continue;
    speakers.add(row.speaker.id);
    if (!texts.has(row.sourceText)) texts.set(row.sourceText, new Set());
    texts.get(row.sourceText).add(row.speaker.id);
  }
  const selectedIds = candidates.map((item) => 'commons-' + item.pageid);
  const downloaded = selectedIds.filter((id) => valid.has(id)).length;
  const needsReview = selectedIds.filter((id) => !valid.has(id) && review.recordings[id]).length;
  return {
    collection,
    name: config.name,
    discoveryComplete: !!currentScope && discovery.category === config.sources[0].categories.length,
    discovered: currentScope ? discovery.items.length : 0,
    selected: candidates.length,
    downloaded,
    needsReview,
    pending: candidates.length - downloaded - needsReview,
    archived: inventory.recordings.length,
    valid: valid.size,
    invalid,
    linkedSpeakers: speakers.size,
    multiSpeakerTexts: [...texts.values()].filter((set) => set.size > 1).length,
    originalsBytes: inventory.recordings.reduce((sum, row) => sum + row.original.bytes, 0),
    audioBytes: inventory.recordings.reduce((sum, row) => sum + row.audio.bytes, 0),
    inventory: paths.inventory,
    audioDirectory: path.join(root, 'audio', collection),
  };
}
