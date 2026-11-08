import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { withAudioLock } from './lock.mjs';
import { audioPaths } from './paths.mjs';
import { selectExpansion } from './selection.mjs';
import { readJSON, atomicJSON } from '../lib/json.mjs';

const inputs = [
  [
    'cantoText',
    'cccanto-webdist.txt',
    'https://raw.githubusercontent.com/amadeusine/cc-canto-data/master/cccanto-webdist.txt',
  ],
  [
    'readingsText',
    'cccedict-canto-readings.txt',
    'https://raw.githubusercontent.com/amadeusine/cc-canto-data/master/cccedict-canto-readings.txt',
  ],
  [
    'cedictText',
    'cedict-source.txt.gz',
    'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz',
  ],
  [
    'wordnetXML',
    'cantown-source.xml',
    'https://raw.githubusercontent.com/lmorgadodacosta/CantoneseWN/master/cantown.xml',
  ],
  [
    'frequency',
    'word-frequency-source.json',
    'https://words.hk/faiman/analysis/existingwordcount.json',
  ],
];

try {
  await withAudioLock(async () => {
    const paths = audioPaths();
    const options = {},
      sources = [];
    for (const [key, filename, url] of inputs) {
      const bytes = await readFile(path.join(paths.cache, filename)).catch((error) => {
        if (error.code === 'ENOENT')
          throw Error(
            'Missing ' + filename + '. Download ' + url + ' into .audio-import-cache/ first.',
          );
        throw error;
      });
      const text = (filename.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8');
      options[key] = key === 'frequency' ? JSON.parse(text) : text;
      sources.push({ filename, url, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    const [discovery, previous, content, registry, review] = await Promise.all([
      readJSON(paths.candidates),
      readJSON(paths.queue),
      readJSON(paths.content),
      readJSON(paths.words),
      readJSON(paths.review),
    ]);
    const result = selectExpansion({
      ...options,
      candidates: discovery.items,
      previous,
      content,
      registry,
      review,
    });
    if (!result.additions.length) {
      console.log('No additional eligible recordings. Queue unchanged.');
      return;
    }
    const selectedTitles = new Set(result.additions.map((row) => row.title));
    const queue = {
      ...previous,
      candidates: [...previous.candidates, ...result.additions],
      excluded: (previous.excluded || []).filter((row) => !selectedTitles.has(row.title)),
      selectionHistory: [
        ...(previous.selectionHistory || []),
        {
          selectedAt: new Date().toISOString(),
          addedRecordings: result.additions.length,
          newWords: result.newWords,
          maxRecordingsPerWord: 2,
          sources,
          criteria: [
            'One or two aligned syllables; unique reading and traditional spelling across parsed dictionaries',
            'Cantonese Wordnet reading match, or CC-Canto two-syllable word with at least five corpus occurrences and no Wordnet spelling conflict',
            'Missing words first, priority everyday words first, then descending written-form corpus count',
            'At most two distinct speakers per word including saved recordings',
            'Recording authorship, licence, checksum and decoding are checked during import; no independent listening review claimed',
          ],
          recoveredExclusions: result.recovered,
        },
      ],
    };
    await atomicJSON(paths.queue, queue);
    await atomicJSON(path.join(paths.cache, 'selection-report.json'), {
      addedRecordings: result.additions.length,
      newWords: result.newWords,
      sources,
      recovered: result.recovered,
      deferred: result.deferred,
    });
    console.log(
      'Added',
      result.additions.length,
      'recordings covering',
      result.newWords,
      'new words/readings.',
    );
    console.log(
      'Deferred',
      result.deferred.length,
      'files; see .audio-import-cache/selection-report.json.',
    );
    console.log('Ready: npm run audio:download');
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
