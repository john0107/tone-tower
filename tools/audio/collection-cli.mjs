import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { downloadCollection, collectionStatus } from './collection.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    collection: { type: 'string', default: 'cmn' },
    limit: { type: 'string' },
    refresh: { type: 'boolean' },
    'retry-review': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});
const root = fileURLToPath(new URL('../../', import.meta.url));
const action = positionals[0];
const abort = new AbortController();
const stop = () => abort.abort(new DOMException('Download stopped', 'AbortError'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  if (values.help) {
    console.log('Download/resume: npm run audio:download:mandarin');
    console.log('Small batch:     npm run audio:download:mandarin -- --limit 20');
    console.log('Check progress:  npm run audio:status:mandarin');
    console.log(
      '--refresh rescans Commons and pending source metadata; saved source versions remain pinned.',
    );
    console.log(
      '--retry-review rechecks blocked candidates. Node.js 22+, FFmpeg and FFprobe are required.',
    );
  } else if (action === 'status' && positionals.length === 1) {
    const status = await collectionStatus({ root, collection: values.collection });
    console.log(status.name + ' audio archive');
    console.log(
      'Discovery:',
      status.discoveryComplete ? 'complete' : 'not started or incomplete',
      '(' + status.discovered + ' source files)',
    );
    console.log('Selected short clips:', status.selected);
    console.log(
      'Queue:',
      status.downloaded,
      'saved and valid;',
      status.needsReview,
      'need review;',
      status.pending,
      'pending.',
    );
    console.log(
      'Archive:',
      status.archived,
      'recordings;',
      status.invalid.length,
      'missing or corrupted files.',
    );
    console.log(
      'Source-linked speakers:',
      status.linkedSpeakers,
      '; written forms with multiple linked speakers:',
      status.multiSpeakerTexts,
    );
    console.log('Speaker/text coverage is provisional; pronunciation has not been reviewed.');
    console.log('Original bytes:', status.originalsBytes, '; MP3 bytes:', status.audioBytes);
    console.log('Inventory:', status.inventory);
    console.log('MP3s:', status.audioDirectory);
  } else if (action === 'download' && positionals.length === 1) {
    console.log(
      'Downloading the separate ' +
        values.collection +
        ' archive. Ctrl+C stops safely; the same command resumes.',
    );
    console.log(
      'Keep this terminal open and the computer awake. Audio will be available for later curation.',
    );
    await downloadCollection({
      root,
      collection: values.collection,
      limit: values.limit === undefined ? Infinity : Number(values.limit),
      refresh: values.refresh,
      retryReview: values['retry-review'],
      signal: abort.signal,
    });
  } else throw Error('Use download or status; pass --help for commands.');
} catch (error) {
  if (abort.signal.aborted)
    console.log('Stopped. Completed downloads are saved. Run the same command to resume.');
  else {
    console.error(error.message);
    console.error(
      'Completed downloads are saved. Fix the error, then rerun the same command to resume.',
    );
  }
  process.exitCode = abort.signal.aborted ? 130 : 1;
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}
