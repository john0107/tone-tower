import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publicationFiles, publish } from '../../tools/publishing/build.mjs';
import { syncWordRegistry } from '../../tools/catalog/catalog.mjs';
import { checkDistribution } from '../../tools/publishing/check.mjs';

test('publication follows runtime dependencies, includes credits, and excludes local work files', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'soundbound-publish-'));
  t.after(async () => {
    if (path.dirname(root) !== tmpdir() || !path.basename(root).startsWith('soundbound-publish-'))
      throw Error('Unsafe test cleanup');
    await rm(root, { recursive: true, force: true });
  });
  const put = async (name, text) => {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), text);
  };
  const input = Array.from({ length: 6 }, (_, i) => ({
    id: 'fu' + (i + 1),
    character: '字',
    jyutping: 'fu' + (i + 1),
    gloss: 'reference',
    tone: i + 1,
    anchor: true,
    audio: 'audio/fu' + (i + 1) + '.mp3',
    author: 'Speaker',
    source: 'https://example.org/' + i,
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    conversion: 'MP3',
  }));
  await put('data/audio/content.json', JSON.stringify(input));
  await put(
    'data/audio/corrections.json',
    JSON.stringify({ version: 1, words: {}, recordings: {} }),
  );
  for (const row of input) await put(row.audio, Buffer.alloc(1200));
  await put(
    'index.html',
    '<link rel="stylesheet" href="src/styles/style.css"><a href="./">Home</a><a href="#guide">Guide</a><script type="module" src="src/app.js"></script>',
  );
  await put('src/app.js', "import {run} from './game/game.js'; run();");
  await put('src/game/game.js', "export {play as run} from '../audio/audio.js';");
  await put('src/audio/audio.js', 'export function play() {}');
  await put(
    'src/styles/style.css',
    "body {font-family:Game} @font-face{font-family:Game;src:url('../../assets/fonts/game.ttf')}",
  );
  await put('assets/fonts/game.ttf', 'font');
  await put('assets/fonts/game-LICENSE.txt', 'Font licence');
  await put('LICENSE', 'Code licence');
  await put('.nojekyll', '');
  await put('THIRD_PARTY_NOTICES.md', 'Third-party attribution');
  await put('.preview/profile/cache', 'local browser profile');
  await put('unused.js', 'not in the game');
  await put('dist/stale-file.txt', 'old build');
  await assert.rejects(() => publish(root), /audio:sync/);
  await assert.rejects(() => readFile(path.join(root, 'data/audio/words.json')), {
    code: 'ENOENT',
  });
  await syncWordRegistry(root);
  const registryBefore = await readFile(path.join(root, 'data/audio/words.json'), 'utf8');
  const { files } = await publish(root);
  assert.equal(await readFile(path.join(root, 'data/audio/words.json'), 'utf8'), registryBefore);

  for (const name of [
    'src/app.js',
    'src/game/game.js',
    'src/audio/audio.js',
    'assets/fonts/game.ttf',
    'assets/fonts/game-LICENSE.txt',
    'catalog.json',
    '.nojekyll',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
  ])
    assert.ok(files.includes(name), name);
  for (const name of [
    'data/audio/content.json',
    'data/audio/corrections.json',
    'data/audio/words.json',
    'unused.js',
    '.preview/profile/cache',
  ])
    assert.ok(!files.includes(name), name);
  assert.ok(!(await readdir(path.join(root, 'dist'))).includes('stale-file.txt'));
  const catalog = JSON.parse(await readFile(path.join(root, 'dist/catalog.json'), 'utf8'));
  assert.equal(catalog.recordings.length, 6);
  assert.equal((await readFile(path.join(root, 'dist/audio/fu1.mp3'))).length, 1200);
  assert.deepEqual(await publicationFiles(root, catalog), files);
  assert.deepEqual(await checkDistribution(path.join(root, 'dist')), files);
  await put('dist/private-cache.txt', 'must not be published');
  await assert.rejects(() => checkDistribution(path.join(root, 'dist')), /unexpected files/);
  await put('src/game/game.js', "import '/root-only.js';");
  await assert.rejects(() => publicationFiles(root, catalog), /relative paths/);
  await put('src/game/game.js', "import '../missing.js';");
  await assert.rejects(() => publicationFiles(root, catalog), /ENOENT/);
});
