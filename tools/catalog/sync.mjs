import { syncWordRegistry } from './catalog.mjs';
const catalog = await syncWordRegistry();
console.log(
  'Registry synchronized:',
  catalog.words.length,
  'words/readings,',
  catalog.recordings.length,
  'recordings.',
);
