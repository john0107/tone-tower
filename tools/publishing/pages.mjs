import { pages, site } from '../../src/site.js';
import { aboutPageMarkup, soundPageMarkup } from '../../src/ui/info-pages.js';
import { cantonese } from '../../src/game/game-core.js';
import { catalogRows } from '../../src/content/catalog.js';
const escape = (value) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
export const generatedFiles = [
  ...Object.values(pages)
    .filter((page) => page.path)
    .map((page) => page.path + 'index.html'),
  'sitemap.xml',
];
export function renderPage(template, page, catalog) {
  const metadata = pages[page];
  const url = new URL(metadata.path, site.siteUrl).href;
  let html = template.replace(
    /<base href="[^"]*"\s*\/>/,
    '<base href="' + (metadata.path ? '../' : './') + '" />',
  );
  html = html.replace(/<title>[^<]*<\/title>/, '<title>' + escape(metadata.title) + '</title>');
  for (const [attribute, name, value] of [
    ['name', 'description', metadata.description],
    ['property', 'og:title', metadata.title],
    ['property', 'og:description', metadata.description],
    ['property', 'og:url', url],
    ['name', 'twitter:title', metadata.title],
    ['name', 'twitter:description', metadata.description],
  ])
    html = html.replace(
      new RegExp('(<meta\\s+' + attribute + '="' + name + '"\\s+content=")[^"]*("\\s*\\/>)'),
      (_, before, after) => before + escape(value) + after,
    );
  html = html.replace(/(<link rel="canonical" href=")[^"]*/, '$1' + url);
  html = html.replace(
    'class="skip-link" href="#app"',
    'class="skip-link" href="' + (metadata.path || './') + '#app"',
  );
  const rows = catalog ? catalogRows(catalog) : [];
  let content;
  if (page === 'about') content = aboutPageMarkup({ recordingCount: rows.length });
  if (page === 'sounds')
    content = soundPageMarkup(
      rows.filter((row) => row.anchor),
      cantonese.toneDefinitions,
      rows,
    );
  if (page === 'practice')
    content =
      '<div class="loading-state"><h1>Practice Workshop</h1><p>' +
      metadata.description +
      '</p><p>Loading your exercises…</p><noscript>Enable JavaScript to practise.</noscript></div>';
  if (content)
    html = html.replace(/(<main id="app" tabindex="-1">)[\s\S]*?(<\/main>)/, '$1' + content + '$2');
  html = html
    .replace(/ aria-current="page"/g, '')
    .replace('data-nav-page="' + page + '"', 'data-nav-page="' + page + '" aria-current="page"');
  return html;
}
export function sitemap() {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    Object.values(pages)
      .map((page) => '  <url><loc>' + new URL(page.path, site.siteUrl).href + '</loc></url>')
      .join('\n') +
    '\n</urlset>\n'
  );
}
