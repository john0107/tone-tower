import assert from 'node:assert/strict';
import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicationFiles } from './build.mjs';
import { createStaticServer } from '../server/static-server.mjs';

async function listFiles(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const name = prefix + entry.name;
    assert.ok(!entry.isSymbolicLink(), 'Unexpected publication symlink: ' + name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, name + '/')));
    else files.push(name);
  }
  return files.sort();
}

export async function checkDistribution(root = path.resolve('dist')) {
  const catalogs = Object.fromEntries(
    await Promise.all(
      ['yue', 'cmn'].map(async (id) => [
        id,
        JSON.parse(await readFile(path.join(root, 'catalogs', id + '.json'), 'utf8')),
      ]),
    ),
  );
  const expected = await publicationFiles(root, catalogs);
  assert.deepEqual(await listFiles(root), expected, 'Built site contains unexpected files.');
  for (const base of ['/', '/release-check/renamed-project/']) {
    const server = await createStaticServer({ root, base });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    try {
      for (const name of ['', ...expected]) {
        const response = await fetch(origin + base + name);
        assert.equal(response.status, 200, base + name);
        const file = name || 'index.html';
        assert.equal(
          (await response.arrayBuffer()).byteLength,
          (await lstat(path.join(root, file))).size,
          base + name,
        );
        const mime = response.headers.get('content-type');
        if (file.endsWith('.js')) assert.match(mime, /^text\/javascript/);
        if (file.endsWith('.json')) assert.match(mime, /^application\/json/);
        if (file.endsWith('.mp3')) assert.match(mime, /^audio\/mpeg/);
      }
      assert.equal((await fetch(origin + base + 'missing-file.js')).status, 404);
      if (base !== '/')
        assert.equal(
          (await fetch(origin + '/src/app.js')).status,
          404,
          'Root assets must not mask broken project-relative URLs.',
        );
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
  console.log(
    `Checked ${expected.length} publication files at root and a renamed project path (${Object.values(catalogs).reduce((n, catalog) => n + catalog.recordings.length, 0)} recordings).`,
  );
  return expected;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await checkDistribution();
