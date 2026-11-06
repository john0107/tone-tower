import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const importer = fileURLToPath(new URL('../../tools/audio/import-curated.mjs', import.meta.url));
const compatibilityImporter = fileURLToPath(
  new URL('../../tools-import-curated.mjs', import.meta.url),
);
const fixture = fileURLToPath(new URL('../../audio/', import.meta.url));
test('local import is resumable and rejects duplicate audio and missing licence URLs', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'jyutping-import-test-'));
  try {
    await mkdir(path.join(dir, 'originals'));
    await mkdir(path.join(dir, '.audio-import-cache'));
    const library = JSON.parse(
      await readFile(new URL('../../content.json', import.meta.url), 'utf8'),
    );
    const original = await readFile(path.join(fixture, path.basename(library[0].audio)));
    const sha1 = createHash('sha1').update(original).digest('hex');
    const queue = [1, 2, 3].map((n) => ({
      pageid: n,
      title: 'File:test' + n + '.mp3',
      character: '你',
      jyutping: 'nei5',
      gloss: 'you',
      syllables: [{ character: '你', jyutping: 'nei5', tone: 5 }],
    }));
    const metadata = {};
    for (const x of queue) {
      await writeFile(path.join(dir, 'originals', x.title.slice(5)), original);
      metadata[x.pageid] = {
        imageinfo: [
          {
            url: 'https://example.org/' + x.title.slice(5),
            descriptionurl: 'https://example.org/file/' + x.pageid,
            sha1,
            extmetadata: {
              Artist: { value: 'Speaker' },
              LicenseShortName: { value: 'CC BY 4.0' },
              ...(x.pageid === 3
                ? {}
                : { LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' } }),
            },
          },
        ],
      };
    }
    await writeFile(path.join(dir, 'content.json'), '[]');
    await writeFile(path.join(dir, 'queue.json'), JSON.stringify(queue));
    await writeFile(
      path.join(dir, '.audio-import-cache', 'state.json'),
      JSON.stringify({ metadata, retryAfter: Date.now() + 600000, excluded: [] }),
    );
    const run = (entry = importer) =>
      execFileSync(
        process.execPath,
        [entry, '--selection', 'queue.json', '--source-dir', 'originals', '--all'],
        { cwd: dir, encoding: 'utf8', timeout: 30000 },
      );
    run();
    const content = JSON.parse(await readFile(path.join(dir, 'content.json'), 'utf8'));
    const state = JSON.parse(
      await readFile(path.join(dir, '.audio-import-cache', 'state.json'), 'utf8'),
    );
    assert.deepEqual(
      content.map((x) => x.id),
      ['commons-1'],
    );
    assert.equal(content[0].author, 'Speaker');
    assert.ok(content[0].licenseUrl);
    assert.deepEqual(state.excluded.map((x) => x.reason).sort(), [
      'Duplicate recording audio',
      'Licence requires review',
    ]);
    assert.ok(state.retryAfter > Date.now());
    const list = await readFile(path.join(dir, 'audio-download-list.csv'), 'utf8');
    assert.match(list, /"commons-1".*"imported"/);
    assert.match(list, /"commons-2".*"review"/);
    // A downloader already running before the move resumes through its original entry point.
    run(compatibilityImporter);
    assert.equal(JSON.parse(await readFile(path.join(dir, 'content.json'), 'utf8')).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('missing completed audio is retried and a failed manifest save leaves no phantom entry', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'jyutping-import-recovery-'));
  try {
    await mkdir(path.join(dir, 'originals'));
    await mkdir(path.join(dir, 'audio'));
    await mkdir(path.join(dir, '.audio-import-cache'));
    const library = JSON.parse(
      await readFile(new URL('../../content.json', import.meta.url), 'utf8'),
    );
    const original = await readFile(path.join(fixture, path.basename(library[0].audio)));
    const item = {
      pageid: 1,
      title: 'File:test.mp3',
      character: '你',
      jyutping: 'nei5',
      gloss: 'you',
      syllables: [{ character: '你', jyutping: 'nei5', tone: 5 }],
    };
    await writeFile(path.join(dir, 'originals/test.mp3'), original);
    await writeFile(path.join(dir, 'queue.json'), JSON.stringify([item]));
    const metadata = {
      1: {
        imageinfo: [
          {
            url: 'https://example.org/test.mp3',
            descriptionurl: 'https://example.org/file/1',
            sha1: createHash('sha1').update(original).digest('hex'),
            extmetadata: {
              Artist: { value: 'Speaker' },
              LicenseShortName: { value: 'CC BY 4.0' },
              LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' },
            },
          },
        ],
      },
    };
    await writeFile(
      path.join(dir, '.audio-import-cache/state.json'),
      JSON.stringify({ metadata, retryAfter: 0, excluded: [] }),
    );
    // A stale manifest row with no corresponding MP3 must not be treated as done.
    const stale = { ...item, id: 'commons-1', audio: 'audio/commons-1.mp3', gloss: 'old' };
    await writeFile(path.join(dir, 'content.json'), JSON.stringify([stale]));
    const shim = path.join(dir, 'fail-save.mjs');
    await writeFile(
      shim,
      `import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';const rename=fs.rename;fs.rename=async(from,to)=>{if(to==='content.json'){const error=Error('Simulated busy manifest');error.code='EPERM';throw error;}return rename(from,to)};syncBuiltinESMExports();`,
    );
    const args = [importer, '--selection', 'queue.json', '--source-dir', 'originals', '--all'];
    assert.throws(
      () =>
        execFileSync(process.execPath, ['--import', pathToFileURL(shim).href, ...args], {
          cwd: dir,
          encoding: 'utf8',
          timeout: 30000,
          stdio: 'pipe',
        }),
      /Simulated busy manifest/,
    );
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'content.json'), 'utf8')), [stale]);
    assert.equal((await readdir(path.join(dir, 'audio'))).length, 0);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(dir, '.audio-import-cache/state.json'), 'utf8')).excluded,
      [],
    );
    execFileSync(process.execPath, args, { cwd: dir, encoding: 'utf8', timeout: 30000 });
    const saved = JSON.parse(await readFile(path.join(dir, 'content.json'), 'utf8'));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, 'commons-1');
    assert.equal(saved[0].gloss, 'you');
    assert.ok((await readFile(path.join(dir, saved[0].audio))).length > 1000);
  } finally {
    if (
      path.dirname(dir) !== tmpdir() ||
      !path.basename(dir).startsWith('jyutping-import-recovery-')
    )
      throw Error('Unsafe test cleanup');
    await rm(dir, { recursive: true, force: true });
  }
});
