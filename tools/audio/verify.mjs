import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { checkDistribution } from '../publishing/check.mjs';
import { validateMP3 } from './convert.mjs';
const catalog = JSON.parse(await readFile('dist/catalog.json', 'utf8'));
await checkDistribution();
let next = 0,
  checked = 0;
await Promise.all(
  Array.from({ length: Math.min(4, catalog.recordings.length) }, async () => {
    while (next < catalog.recordings.length) {
      const row = catalog.recordings[next++];
      await validateMP3(path.join('dist', row.audio));
      if (++checked % 100 === 0)
        console.log('Decoded ' + checked + '/' + catalog.recordings.length + ' recordings.');
    }
  }),
);
console.log(
  'Decoded ' + catalog.recordings.length + ' published MP3s; static hosting checks passed.',
);
