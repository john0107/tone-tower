import { parseArgs } from 'node:util';
import { withAudioLock } from './lock.mjs';
import { importAudio } from './importer.mjs';

const { values } = parseArgs({
  options: {
    selection: { type: 'string' },
    'source-dir': { type: 'string' },
    batch: { type: 'string', default: '100' },
    all: { type: 'boolean' },
    'export-only': { type: 'boolean' },
  },
});
const abort = new AbortController();
const stop = () => abort.abort(new DOMException('Import stopped', 'AbortError'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('message', (message) => {
  if (message?.type === 'stop') stop();
});
try {
  await withAudioLock(() =>
    importAudio({
      selection: values.selection,
      sourceDir: values['source-dir'],
      batch: Number(values.batch),
      all: values.all,
      exportOnly: values['export-only'],
      signal: abort.signal,
    }),
  );
} catch (error) {
  if (!abort.signal.aborted) {
    console.error(error.message);
    process.exitCode = /rate limit|HTTP |fetch failed|timed out|aborted/i.test(error.message)
      ? 75
      : 1;
  } else {
    console.log('Stopped. Completed imports are saved; run the same command to resume.');
    process.exitCode = 130;
  }
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
  if (process.connected) process.disconnect();
}
