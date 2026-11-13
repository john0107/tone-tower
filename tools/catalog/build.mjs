import { buildCatalogs } from './catalog.mjs';
const catalogs = await buildCatalogs();
for (const catalog of Object.values(catalogs))
  console.log(
    catalog.language +
      ': ' +
      catalog.pronunciations.length +
      ' pronunciations, ' +
      catalog.recordings.length +
      ' playable recordings.',
  );
