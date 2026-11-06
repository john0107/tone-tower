import { pages } from '../../src/site.js';
import { renderPage, generatedFiles, sitemap } from './pages.mjs';
import {
  readFile,
  readdir,
  mkdir,
  copyFile,
  writeFile,
  rm,
  lstat,
  realpath,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../catalog/catalog.mjs';

// Follow local runtime dependencies instead of uploading the working directory.
export async function publicationFiles(root, catalog) {
  const pending = [
    'index.html',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    '.nojekyll',
    'catalog.json',
    // Social crawlers read og:image, which is not a local href.
    ...((await readFile(path.join(root, 'index.html'), 'utf8')).includes(
      'assets/brand/share-card.png',
    )
      ? ['assets/brand/share-card.png']
      : []),
    ...catalog.recordings.map((row) => row.audio),
  ];
  const files = new Set();
  function addReference(from, reference) {
    if (!reference || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(reference)) return;
    if (reference.startsWith('/'))
      throw Error('Publication assets must use relative paths: ' + reference);
    const clean = reference.split(/[?#]/)[0];
    if (!clean || Object.values(pages).some((page) => page.path && clean === page.path)) return;
    const name = path.posix.normalize(
      path.posix.join(path.posix.dirname(from), clean.endsWith('/') ? clean + 'index.html' : clean),
    );
    if (name.startsWith('../') || path.posix.isAbsolute(name))
      throw Error('Asset outside publication root: ' + reference);
    pending.push(name);
  }
  while (pending.length) {
    const name = pending.pop();
    if (files.has(name)) continue;
    files.add(name);
    const absolute = path.join(root, name);
    const info = await lstat(absolute);
    if (!info.isFile() || info.isSymbolicLink())
      throw Error('Expected a regular publication file: ' + name);
    if (!/\.(?:html|css|js)$/.test(name)) continue;
    const source = await readFile(absolute, 'utf8');
    if (name.endsWith('.html'))
      for (const match of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g))
        addReference(name, match[1]);
    if (name.endsWith('.js'))
      for (const match of source.matchAll(
        /\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g,
      ))
        addReference(name, match[1]);
    if (name.endsWith('.css'))
      for (const match of source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g))
        addReference(name, match[1]);
  }
  // Font licences accompany the deployed fonts even though CSS does not link them.
  for (const name of await readdir(path.join(root, 'assets/fonts')))
    if (/LICENSE|OFL/i.test(name)) files.add('assets/fonts/' + name);
  return [...files].sort();
}

export async function publish(root = process.cwd()) {
  const catalog = await buildCatalog(root);
  const files = await publicationFiles(root, catalog);
  const actualRoot = await realpath(root);
  const destination = path.resolve(actualRoot, 'dist');
  // Only this generated directory may be cleared, never an arbitrary CLI path.
  if (path.dirname(destination) !== actualRoot || path.basename(destination) !== 'dist')
    throw Error('Unsafe publishing directory.');
  try {
    const info = await lstat(destination);
    if (
      info.isSymbolicLink() ||
      !info.isDirectory() ||
      (await realpath(destination)) !== destination
    )
      throw Error('Publishing directory must be a local directory.');
    await rm(destination, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(destination, { recursive: true });
  for (const name of files) {
    const target = path.join(destination, name);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, name), target);
  }
  const template = await readFile(path.join(root, 'index.html'), 'utf8');
  for (const [page, metadata] of Object.entries(pages)) {
    const target = path.join(destination, metadata.path, 'index.html');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, renderPage(template, page, catalog));
  }
  await writeFile(path.join(destination, 'sitemap.xml'), sitemap());
  const allFiles = [...files, ...generatedFiles].sort();
  console.log(
    `Prepared dist/: ${catalog.recordings.length} recordings, ${allFiles.length} files. Upload the contents of dist/.`,
  );
  return { destination, files: allFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await publish();
