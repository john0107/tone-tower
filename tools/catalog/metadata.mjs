import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioPaths } from '../audio/paths.mjs';
import { withAudioLock } from '../audio/lock.mjs';
import { atomicJSON, readJSON } from '../lib/json.mjs';
import { syncRegistry, assembleCatalog } from './catalog.mjs';
import { addFrequencyMetadata, FREQUENCY_SOURCE } from './word-metadata.mjs';

export async function updateWordMetadata({ root = process.cwd(), frequencyFile } = {}) {
  return withAudioLock(async () => {
    const paths = audioPaths(root);
    const file = frequencyFile
      ? path.resolve(root, frequencyFile)
      : path.join(paths.cache, 'word-frequency-source.json');
    const raw = await readFile(file, 'utf8').catch((error) => {
      if (error.code === 'ENOENT')
        throw Error('Download ' + FREQUENCY_SOURCE + ' first; see docs/AUDIO-CATALOG.md.');
      throw error;
    });
    const imported = await readJSON(paths.content);
    const registry = await readJSON(paths.words);
    if (JSON.stringify(syncRegistry(imported, registry)) !== JSON.stringify(registry))
      throw Error('Run npm run audio:sync before adding metadata.');
    const checksum = createHash('sha256').update(raw).digest('hex');
    const corrections = await readJSON(paths.corrections);
    const effective = assembleCatalog(imported, registry, corrections);
    const writtenForms = Object.fromEntries(
      effective.words.map((word) => [word.id, word.character]),
    );
    const updated = addFrequencyMetadata(registry, JSON.parse(raw), checksum, writtenForms);
    const catalog = assembleCatalog(imported, updated, corrections);
    await atomicJSON(paths.words, updated);
    const matched = catalog.words.filter(
      (word) => word.metadata.frequency?.source === FREQUENCY_SOURCE,
    ).length;
    return {
      words: catalog.words.length,
      matched,
      unknown: catalog.words.length - matched,
      checksum,
    };
  }, root);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { 'frequency-file': { type: 'string' } } });
    const result = await updateWordMetadata({ frequencyFile: values['frequency-file'] });
    console.log(
      'Word metadata:',
      result.matched,
      'source matches,',
      result.unknown,
      'without a source match.',
    );
    console.log('Frequency snapshot SHA-256:', result.checksum);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
