import { test, expect } from '@playwright/test';

const entries = [1, 2, 3, 4].map((t) => ({
  id: 'ma' + t,
  forms: { default: '妈', simplified: '妈', traditional: '媽' },
  gloss: 'fixture',
}));
entries.push(
  {
    id: 'mother',
    forms: { default: '妈妈', simplified: '妈妈', traditional: '媽媽' },
    gloss: 'mother',
  },
  {
    id: 'greeting',
    forms: { default: '你好', simplified: '你好', traditional: '你好' },
    gloss: 'hello',
  },
);
const pronunciations = [1, 2, 3, 4].map((t) => ({
  id: 'ma' + t,
  entryId: 'ma' + t,
  syllables: [{ forms: { simplified: '妈', traditional: '媽' }, transcription: 'ma' + t, tone: t }],
}));
pronunciations.push(
  {
    id: 'mother',
    entryId: 'mother',
    syllables: [
      { forms: { simplified: '妈', traditional: '媽' }, transcription: 'ma1', tone: 1 },
      { forms: { simplified: '妈', traditional: '媽' }, transcription: 'ma5', tone: 5 },
    ],
  },
  {
    id: 'greeting',
    entryId: 'greeting',
    syllables: [
      { text: '你', transcription: 'ni3', tone: 3 },
      { text: '好', transcription: 'hao3', tone: 3 },
    ],
  },
);
const catalog = {
  version: 2,
  language: 'cmn',
  transcriptionSystem: 'pinyin',
  entries,
  pronunciations,
  recordings: pronunciations.map((p) => ({
    id: p.id,
    pronunciationId: p.id,
    audio: 'audio/' + p.id + '.mp3',
    realizedTones: p.id === 'greeting' ? [2, 3] : p.syllables.map((s) => s.tone),
  })),
  references: [1, 2, 3, 4]
    .map((t) => ({ tone: t, recordingId: 'ma' + t, targetIndex: 0 }))
    .concat([{ tone: 5, recordingId: 'mother', targetIndex: 1 }]),
  availability: { ready: true, mode: 'beta' },
};

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.route('**/catalogs/cmn.json', (route) => route.fulfill({ json: catalog }));
  await page.addInitScript(() => {
    window.__audioPlays = [];
    window.Audio = class {
      constructor(src) {
        this.src = src;
      }
      load() {}
      pause() {
        clearTimeout(this.end);
      }
      play() {
        window.__audioPlays.push(this.src);
        this.end = setTimeout(() => this.onended?.(), 100);
        return Promise.resolve();
      }
    };
  });
});
async function loaded(page, url = '/mandarin/') {
  await page.goto(url);
  await expect(page.locator('.mode-cards')).toBeVisible();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
}
const noOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

test('chooser loads no catalog and language navigation stays in Mandarin', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => {
    if (/catalogs\/|\.mp3/.test(r.url())) requests.push(r.url());
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Which language will you explore?' }),
  ).toBeVisible();
  expect(requests).toEqual([]);
  await page.locator('.language-card--mandarin').click();
  await expect(page.locator('h1')).toHaveText('Practise Pinyin.');
  await page.locator('#credits').click();
  await expect(page.locator('#dialog')).toContainText('CC-CEDICT');
  await expect(page.locator('#dialog')).not.toContainText('CC-Canto');
  await page.locator('#close-dialog').click();
  expect(
    requests.filter((url) => url.includes('/catalogs/')).every((url) => url.endsWith('/cmn.json')),
  ).toBe(true);
  await page.locator('#learn').click();
  await expect(page).toHaveURL(/\/mandarin\/guide\/$/);
  await expect(page.getByRole('heading', { name: 'Written tones and heard tones' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A short guide to Pinyin' })).toBeVisible();
  await page.locator('.brand').click();
  await expect(page).toHaveURL(/\/mandarin\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/mandarin\/guide\/$/);
  expect((await page.request.get('/guide/')).status()).toBe(404);
  await noOverflow(page);
});

test('Mandarin practice renders five doors and accepts neutral-tone keyboard answers', async ({
  page,
}) => {
  await loaded(page);
  await page.locator('#setup-practice').click();
  await page.locator('[data-practice-setting="choices"]').selectOption('5');
  await page.locator('#start-adventure').click();
  await page.clock.runFor(150);
  await expect(page.locator('.tone-door')).toHaveCount(5);
  await expect(page.locator('.tone-door').first()).toBeEnabled();
  const clip = await page.evaluate(() => window.__audioPlays.at(-1));
  const recording = catalog.recordings.find((r) => r.audio === clip);
  const target = await page.locator('.is-target .prompt-character').innerText();
  // Single reference words and the first mother syllable share text; use the highlighted index.
  const index = await page
    .locator('.prompt-syllable')
    .evaluateAll((nodes) => nodes.findIndex((n) => n.classList.contains('is-target')));
  await page.keyboard.press(String(recording.realizedTones[index]));
  await expect(page.locator('#app')).toHaveAttribute('data-outcome', 'success');
  await expect(page.locator('.recording-report')).toHaveAttribute(
    'href',
    /github\.com.*issues\/new/,
  );
  await noOverflow(page);
});

test('Pinyin typing supports composition, spaces, mobile helpers, and script switching', async ({
  page,
}) => {
  await loaded(page);
  await page.locator('[data-mode-card][data-destination="rail"]').click();
  await page.locator('#setup-practice').click();
  await page.locator('[data-practice-setting="variant"]').check();
  await page.locator('#start-adventure').click();
  await page.clock.runFor(150);
  const input = page.locator('#transcription-answer');
  await expect(page.locator('.pinyin-tools')).toBeVisible();
  await page.locator('#script-display').selectOption('traditional');
  await expect(input).toBeEnabled();
  const clip = await page.evaluate(() => window.__audioPlays.at(-1));
  const p = pronunciations.find((p) => 'audio/' + p.id + '.mp3' === clip);
  const expected = p.syllables.map((s) => s.transcription).join(' ');
  await input.dispatchEvent('compositionstart');
  await input.fill(expected);
  await expect(page.locator('#app')).not.toHaveAttribute('data-outcome', 'success');
  await input.dispatchEvent('compositionend');
  await expect(page.locator('#app')).toHaveAttribute('data-outcome', 'success');
  await page.clock.runFor(1050);
  await input.focus();
  await input.fill('er');
  await input.press('Space');
  await expect(input).toHaveValue('er ');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('soundbound-mandarin-v1')).settings.script,
    ),
  ).toBe('traditional');
  if (page.viewportSize().width <= 700) {
    await page.setViewportSize({ width: page.viewportSize().width, height: 450 });
    await input.focus();
    await expect(input).toBeInViewport();
  }
  await noOverflow(page);
});

test('unavailable collection keeps the guide usable and games closed', async ({ page }) => {
  await page.route('**/catalogs/cmn.json', (route) =>
    route.fulfill({
      json: {
        ...catalog,
        entries: [],
        pronunciations: [],
        recordings: [],
        references: [],
        availability: { ready: false },
      },
    }),
  );
  await loaded(page);
  await expect(page.locator('.content-preview')).toContainText('gathering enough recordings');
  await expect(page.locator('#start-adventure')).toBeDisabled();
  await page.locator('#learn').click();
  await expect(page.getByRole('heading', { name: 'A short guide to Pinyin' })).toBeVisible();
  await noOverflow(page);
});

test('reduced motion and blocked local storage still allow a language game', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw Error('blocked storage');
      },
    });
  });
  await loaded(page);
  await page.locator('#setup-practice').click();
  await page.locator('#start-adventure').click();
  await page.clock.runFor(150);
  await expect(page.locator('.tone-door').first()).toBeEnabled();
  await noOverflow(page);
});

test('home examples use sourced script forms and never substitute an unrelated tone reference', async ({
  page,
}) => {
  const differentReference = structuredClone(catalog);
  differentReference.pronunciations.find((p) => p.id === 'ma1').syllables[0].transcription = 'ni1';
  await page.route('**/catalogs/cmn.json', (route) => route.fulfill({ json: differentReference }));
  await loaded(page);
  await expect(page.locator('.hear-example')).toBeDisabled();
  await page.locator('#script-display').selectOption('traditional');
  await expect(page.locator('.syllable-result')).toContainText('馬');
});

test('About retains the original sections, game cards, privacy, and feedback links', async ({
  page,
}) => {
  for (const language of ['cantonese', 'mandarin']) {
    await page.goto('/' + language + '/about/');
    await expect(page.locator('.about-page h1')).toHaveText('About Tone Tower');
    await expect(page.locator('.about-page .info-card')).toHaveCount(2);
    for (const name of [
      'What you can practise',
      'Games and practice',
      'Recordings and sources',
      'Progress and privacy',
      'An open-source side project',
      'Help make it better',
    ])
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Report a problem ↗' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Suggest an idea ↗' })).toBeVisible();
    await noOverflow(page);
  }
});
