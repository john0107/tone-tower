import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { audioPaths } from './paths.mjs';
import { readJSON } from '../lib/json.mjs';
import { isImported } from './store.mjs';

const paths = audioPaths();
const content = await readJSON(paths.content);
const queue = (await readJSON(paths.queue)).candidates;
const review = await readJSON(paths.review, { version: 1, excluded: [] });
const cache = await readJSON(paths.state, { retryAfter: 0 });
const registry = await readJSON(paths.words);
const existing = new Set(
  (await readdir(path.join(paths.root, 'audio'))).map((name) => 'audio/' + name),
);
const imported = queue.filter((item) => isImported(item, { content, existing })).length;
const rejected = queue.filter(
  (item) =>
    !isImported(item, { content, existing }) &&
    review.excluded.some((row) => row.title === item.title),
).length;
console.log('Saved recordings:', content.length);
console.log(
  'Queue:',
  imported,
  'downloaded,',
  rejected,
  'needing review,',
  queue.length - imported - rejected,
  'remaining.',
);
console.log('Missing audio files:', content.filter((row) => !existing.has(row.audio)).length);
console.log(
  'Recordings needing word synchronization:',
  content.filter((row) => !registry.recordingWords[row.id]).length,
);
console.log(
  'Commons cooldown:',
  cache.retryAfter > Date.now() ? new Date(cache.retryAfter).toISOString() : 'none',
);
for (const [host, state] of Object.entries(cache.hosts || {})) {
  console.log(
    host + ':',
    'request spacing ' + state.intervalMs / 1000 + ' s;',
    'cooldown ' +
      (state.retryAfter > Date.now() ? new Date(state.retryAfter).toISOString() : 'none'),
  );
}
console.log('CSV export: npm run audio:export');
