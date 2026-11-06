import { buildCatalog } from './catalog.mjs';
const catalog = await buildCatalog();
console.log(
  `Catalog ready: ${catalog.words.length} words/readings, ${catalog.recordings.length} recordings.`,
);
