import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pages, site, pageFromLocation } from '../../src/site.js';
import { renderPage, sitemap } from '../../tools/publishing/pages.mjs';
test('every public page has crawler-visible metadata and resolves assets under a renamed project', async () => {
  const template = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  for (const [key, metadata] of Object.entries(pages)) {
    const html = renderPage(template, key);
    const url = new URL(metadata.path, site.siteUrl).href;
    assert.ok(html.includes('<title>' + metadata.title + '</title>'));
    assert.match(
      html,
      new RegExp(
        '<meta\\s+name="description"\\s+content="' +
          metadata.description.replace(/[.*+?^$()|[\]\\]/g, '\\$&') +
          '"',
      ),
    );
    for (const name of [
      'og:title',
      'og:description',
      'og:url',
      'twitter:title',
      'twitter:description',
    ]) {
      const value = name.endsWith('title')
        ? metadata.title
        : name.endsWith('description')
          ? metadata.description
          : url;
      assert.ok(
        new RegExp(
          '(?:property|name)="' +
            name +
            '"\\s+content="' +
            value.replace(/[.*+?^$()|[\]\\]/g, '\\$&') +
            '"',
        ).test(html),
        name + ': ' + key,
      );
    }
    assert.ok(html.includes('rel="canonical" href="' + url + '"'));
    const base = new URL(
      html.match(/<base href="([^"]+)"/)[1],
      'https://example.org/renamed/' + metadata.path,
    );
    assert.equal(base.href, 'https://example.org/renamed/');
    assert.equal(new URL('src/app.js', base).href, 'https://example.org/renamed/src/app.js');
    assert.ok(sitemap().includes(url));
    if (key === 'about') {
      assert.ok(html.includes('Help make it better'));
      assert.ok(html.includes(site.maintainerUrl));
    }
    if (key === 'sounds') assert.ok(html.includes('Syllable structure'));
  }
});
test('clean routes identify screens without depending on fragments', () => {
  for (const base of ['https://example.org/', 'https://example.org/a/renamed/']) {
    for (const [key, metadata] of Object.entries(pages)) {
      assert.equal(
        pageFromLocation(new URL(metadata.path + '?test=1#app', base), new URL(base)),
        key,
      );
      assert.equal(
        pageFromLocation(new URL(metadata.path + 'index.html', base), new URL(base)),
        key,
      );
    }
    assert.equal(pageFromLocation(new URL('#about', base), new URL(base)), 'home');
  }
});
