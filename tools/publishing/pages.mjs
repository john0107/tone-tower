import { pages, site, languagePages } from '../../src/site.js';
import { languages } from '../../src/languages/profiles.js';
import { aboutPageMarkup, soundPageMarkup } from '../../src/ui/info-pages.js';
import { catalogRows, referenceRows } from '../../src/content/catalog.js';
const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
export const generatedFiles = [
  ...Object.values(pages).map((page) => page.path + 'index.html'),
  'sitemap.xml',
];
export function localizeLinks(html, profile) {
  const routes = languagePages(profile);
  for (const [from, to] of [
    ['./', routes.home.path],
    ['guide/', routes.sounds.path],
    ['about/', routes.about.path],
    ['practice/', routes.practice.path],
  ])
    html = html.replaceAll('href="' + from + '"', 'href="' + to + '"');
  return html;
}
export function renderPage(template, key, catalog) {
  const metadata = pages[key];
  if (!metadata) throw Error('Unknown language page: ' + key);
  const profile = languages[metadata.language],
    page = metadata.page;
  const url = new URL(metadata.path, site.siteUrl).href;
  let html = localizeLinks(template, profile);
  html = html.replace('<html lang="en">', '<html lang="en" data-language="' + profile.id + '">');
  html = html.replace(
    /<base href="[^"]*"\s*\/>/,
    '<base href="' + '../'.repeat(metadata.path.split('/').filter(Boolean).length) + '" />',
  );
  html = html.replace(/<title>[^<]*<\/title>/, '<title>' + escape(metadata.title) + '</title>');
  for (const [attribute, name, value] of [
    ['name', 'description', metadata.description],
    ['property', 'og:title', metadata.title],
    ['property', 'og:description', metadata.description],
    ['property', 'og:url', url],
    ['name', 'twitter:title', metadata.title],
    ['name', 'twitter:description', metadata.description],
  ]) {
    const expression = new RegExp(
      '(<meta\\s+' + attribute + '="' + name + '"\\s+content=")[^"]*("\\s*\\/>)',
    );
    html = html.replace(expression, (_, before, after) => before + escape(value) + after);
  }
  html = html.replace(/(<link rel="canonical" href=")[^"]*/, '$1' + url);
  html = html.replace(
    'class="skip-link" href="#app"',
    'class="skip-link" href="' + metadata.path + '#app"',
  );
  html = html.replace(
    '<span>TONE TOWER</span>',
    '<span>TONE TOWER<small class="brand-language">' + profile.label + '</small></span>',
  );
  html = html.replace(
    '<nav aria-label="Main navigation">',
    '<nav aria-label="Main navigation"><a class="nav-link language-link" href="./">Languages</a>',
  );
  html = html.replace('>Jyutping guide</a', '>' + profile.romanization + ' guide</a');
  html = html
    .replaceAll('Train your ear for Cantonese.', 'Train your ear for ' + profile.label + '.')
    .replace(
      'Play Tone Tower and Skyrail to practise Cantonese tones and Jyutping spelling.',
      'Play Tone Tower and Skyrail to practise ' +
        profile.label +
        ' tones and ' +
        profile.romanization +
        ' spelling.',
    );
  if (profile.scripts.length > 1)
    html = html.replace(
      '<div class="project-links"',
      '<label class="script-setting">Characters <select id="script-display"><option value="simplified">简体 · Simplified</option><option value="traditional">繁體 · Traditional</option></select></label><div class="project-links"',
    );
  const rows = catalog ? catalogRows(catalog, profile) : [],
    anchors = catalog ? referenceRows(catalog, rows) : [];
  let content;
  if (page === 'about')
    content = aboutPageMarkup({
      recordingCount: rows.length,
      profile,
      availability: catalog?.availability,
    });
  if (page === 'sounds') content = soundPageMarkup(anchors, profile.toneDefinitions, rows, profile);
  if (page === 'practice')
    content =
      '<div class="loading-state"><h1>Practice Workshop</h1><p>' +
      escape(metadata.description) +
      '</p><p>Loading your exercises…</p><noscript>Enable JavaScript to practise.</noscript></div>';
  if (content)
    html = html.replace(
      /(<main id="app" tabindex="-1">)[\s\S]*?(<\/main>)/,
      '$1' + localizeLinks(content, profile) + '$2',
    );
  html = html
    .replace(/ aria-current="page"/g, '')
    .replace('data-nav-page="' + page + '"', 'data-nav-page="' + page + '" aria-current="page"');
  return html;
}
export function sitemap() {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    ['', ...Object.values(pages).map((page) => page.path)]
      .map((route) => '  <url><loc>' + new URL(route, site.siteUrl).href + '</loc></url>')
      .join('\n') +
    '\n</urlset>\n'
  );
}
