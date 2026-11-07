import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { withAudioLock } from '../../tools/audio/lock.mjs';
import { audioPaths } from '../../tools/audio/paths.mjs';
import { readImportState } from '../../tools/audio/store.mjs';
const run = promisify(execFile);

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'tone-tower-pipeline-'));
  t.after(async () => {
    assert.equal(path.dirname(root), tmpdir());
    assert.ok(path.basename(root).startsWith('tone-tower-pipeline-'));
    await rm(root, { recursive: true, force: true });
  });
  const paths = audioPaths(root);
  for (const dir of [paths.data, paths.cache, path.join(root, 'audio')])
    await mkdir(dir, { recursive: true });
  await writeFile(paths.content, '[]');
  await writeFile(paths.queue, JSON.stringify({ candidates: [] }));
  await writeFile(paths.review, JSON.stringify({ version: 1, excluded: [] }));
  return paths;
}

test('direct import and discovery cannot bypass a running audio operation', async (t) => {
  const paths = await fixture(t);
  await withAudioLock(async () => {
    for (const command of ['import-curated.mjs', 'discover.mjs']) {
      const script = fileURLToPath(new URL('../../tools/audio/' + command, import.meta.url));
      await assert.rejects(
        () => run(process.execPath, [script, '--export-only'], { cwd: paths.root, timeout: 10000 }),
        /Another audio operation is running/,
      );
    }
    assert.equal(await readFile(paths.content, 'utf8'), '[]');
  }, paths.root);
  await assert.rejects(() => stat(paths.lock), { code: 'ENOENT' });
});

test('downloader delegates its lock to its child and releases it after completion', async (t) => {
  const paths = await fixture(t);
  const helper = path.join(paths.root, 'runner.mjs');
  await writeFile(
    helper,
    'import {runDownloader} from ' +
      JSON.stringify(new URL('../../tools/audio/download.mjs', import.meta.url).href) +
      ";await runDownloader({root:process.cwd(),args:['--export-only']});",
  );
  await run(process.execPath, [helper], { cwd: paths.root, timeout: 10000 });
  assert.match(await readFile(paths.csv, 'utf8'), /recording_id,title/);
  await assert.rejects(() => stat(paths.lock), { code: 'ENOENT' });
});

test('a cancelled cooldown preserves progress and releases the import lock', async (t) => {
  const paths = await fixture(t);
  const item = {
    pageid: 1,
    title: 'File:test.wav',
    character: '你',
    jyutping: 'nei5',
    gloss: 'you',
    syllables: [{ character: '你', jyutping: 'nei5', tone: 5 }],
  };
  await writeFile(paths.queue, JSON.stringify({ candidates: [item] }));
  const retryAfter = Date.now() + 600000;
  await writeFile(paths.state, JSON.stringify({ metadata: {}, retryAfter }));
  const script = fileURLToPath(new URL('../../tools/audio/import-curated.mjs', import.meta.url));
  const child = spawn(process.execPath, [script], {
    cwd: paths.root,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  let sent = false,
    output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
    if (!sent && output.includes('Waiting')) {
      sent = true;
      child.send({ type: 'stop' });
    }
  });
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(Error('Importer did not stop during cooldown'));
    }, 10000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  assert.equal(code, 130);
  assert.equal(await readFile(paths.content, 'utf8'), '[]');
  assert.equal(JSON.parse(await readFile(paths.state, 'utf8')).retryAfter, retryAfter);
  assert.deepEqual(JSON.parse(await readFile(paths.review, 'utf8')).excluded, []);
  await assert.rejects(() => stat(paths.lock), { code: 'ENOENT' });
});

test('stale locks are recovered and thrown operations still release ownership', async (t) => {
  const paths = await fixture(t);
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], {
    stdio: 'ignore',
    windowsHide: true,
  });
  await new Promise((resolve) => child.once('exit', resolve));
  await writeFile(paths.lock, JSON.stringify({ pid: child.pid, token: 'old-owner' }));
  await assert.rejects(
    () =>
      withAudioLock(async () => {
        throw Error('Expected failure');
      }, paths.root),
    /Expected failure/,
  );
  await assert.rejects(() => stat(paths.lock), { code: 'ENOENT' });
});

test('import decisions come from versioned metadata without reading API caches', async (t) => {
  const paths = await fixture(t);
  const excluded = [{ title: 'File:bad.wav', reason: 'Incorrect recording' }];
  await writeFile(paths.review, JSON.stringify({ version: 1, excluded }));
  await writeFile(paths.state, '{incomplete cache');
  const state = await readImportState(paths);
  assert.deepEqual(state.review.excluded, excluded);
  assert.deepEqual(JSON.parse(await readFile(paths.review, 'utf8')).excluded, excluded);
  assert.equal(await readFile(paths.state, 'utf8'), '{incomplete cache');
});
