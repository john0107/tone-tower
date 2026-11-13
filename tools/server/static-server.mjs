import { pages } from '../../src/site.js';
import { renderPage } from '../publishing/pages.mjs';
import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

// A local preview server, with no SPA fallback: missing Pages assets must fail.
export async function createStaticServer({ root, base = '/', sourceRoutes = false }) {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))
    throw Error('Base must be / or a slash-delimited project path ending in /.');
  const directory = await realpath(root);
  const within = (file) => file.startsWith(directory + path.sep);
  return http.createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (base !== '/' && pathname === base.slice(0, -1)) {
        res.writeHead(308, { Location: base });
        res.end();
        return;
      }
      if (!pathname.startsWith(base) || pathname.includes('\\')) throw Error('Outside base');
      const relative = pathname.slice(base.length);
      const page = Object.keys(pages).find((key) => pages[key].path === relative);
      if (sourceRoutes && page) {
        const template = await readFile(path.join(directory, 'src/shell.html'), 'utf8');
        const catalog = JSON.parse(
          await readFile(path.join(directory, 'catalogs', pages[page].language + '.json'), 'utf8'),
        );
        const data = Buffer.from(renderPage(template, page, catalog));
        res.writeHead(200, {
          'Content-Type': types['.html'],
          'Content-Length': data.length,
          'Cache-Control': 'no-store',
        });
        res.end(req.method === 'HEAD' ? undefined : data);
        return;
      }
      const route = Object.values(pages).find(
        (page) => page.path && relative === page.path.slice(0, -1),
      );
      if (route) {
        res.writeHead(308, {
          Location: base + route.path + new URL(req.url, 'http://localhost').search,
        });
        res.end();
        return;
      }
      const candidate = path.resolve(
        directory,
        relative.endsWith('/') || !relative ? relative + 'index.html' : relative,
      );
      if (!within(candidate)) throw Error('Outside root');
      const file = await realpath(candidate);
      if (!within(file) || !(await stat(file)).isFile()) throw Error('Outside root');
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type':
          types[path.extname(file)] ||
          (path.basename(file) === 'LICENSE'
            ? 'text/plain; charset=utf-8'
            : 'application/octet-stream'),
        'Content-Length': data.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });
}
