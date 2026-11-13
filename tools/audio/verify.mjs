import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { checkDistribution } from '../publishing/check.mjs';
import { validateMP3 } from './convert.mjs';
const catalogs = await Promise.all(
  ['yue', 'cmn'].map(async (id) =>
    JSON.parse(await readFile('dist/catalogs/' + id + '.json', 'utf8')),
  ),
);
const recordings = catalogs.flatMap((catalog) => catalog.recordings);
await checkDistribution();
let next = 0,
  checked = 0;
await Promise.all(
  Array.from({ length: Math.min(4, recordings.length) }, async () => {
    while (next < recordings.length) {
      const row = recordings[next++];
      await validateMP3(path.join('dist', row.audio));
      if (++checked % 100 === 0)
        console.log('Decoded ' + checked + '/' + recordings.length + ' recordings.');
    }
  }),
);
console.log('Decoded ' + recordings.length + ' published MP3s; static hosting checks passed.');
