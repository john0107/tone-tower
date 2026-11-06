import {buildCatalog} from './catalog-tools.mjs';
const catalog = await buildCatalog();
console.log(`Catalog ready: ${catalog.words.length} words/readings, ${catalog.recordings.length} recordings.`);
