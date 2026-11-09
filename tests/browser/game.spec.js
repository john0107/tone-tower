import { test, expect } from '@playwright/test';

// Keep smoke tests independent of downloads and speakers. Real recording playback
// still needs a quick check on a phone, particularly for browser audio permissions.
const singles = ['詩', '史', '試', '時', '市', '事'].map((character, i) => ({
  id: `si${i + 1}`,
  gloss: 'example',
  syllables: [{ character, jyutping: `si${i + 1}`, tone: i + 1 }],
}));
const words = [
  ...singles,
  {
    id: 'morning',
    gloss: 'good morning',
    syllables: [
      { character: '早', jyutping: 'zou2', tone: 2 },
      { character: '晨', jyutping: 'san4', tone: 4 },
    ],
  },
];
const catalog = {
  version: 1,
  words,
  recordings: [
    ...words.map((word) => ({ id: word.id, wordId: word.id, audio: `audio/${word.id}.mp3` })),
    ...singles.map((word) => ({
      id: `anchor-${word.id}`,
      wordId: word.id,
      audio: `audio/${word.id}.mp3`,
      anchor: true,
    })),
  ],
};
const errors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const pageErrors = [];
  errors.set(page, pageErrors);
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.clock.install();
  await page.route('**/catalog.json', (route) => route.fulfill({ json: catalog }));
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
  await page.goto('/');
  await expect(page.locator('.mode-cards')).toBeVisible();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

async function start(page, world) {
  await page.locator(`.mode-card[data-destination="${world === 'tide' ? 'rail' : world}"]`).click();
  await page.locator('#start-adventure').click();
  await expect(page.locator('#app')).toHaveAttribute('data-world', world);
}

async function currentTone(page) {
  const character = await page.locator('.is-target .prompt-character').innerText();
  return String(
    words.flatMap((word) => word.syllables).find((s) => s.character === character).tone,
  );
}

async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

test('Tower intro, crossing, mistake review and failed-run practice', async ({ page }) => {
  await start(page, 'tone');
  await page.clock.runFor(1900);
  expect(await page.evaluate(() => window.__audioPlays.length)).toBe(0);
  await expect(page.locator('[data-tone]').first()).toBeDisabled();
  await page.clock.runFor(300);
  await expect(page.locator('[data-tone]').first()).toBeEnabled();
  expect(await page.evaluate(() => window.__audioPlays.length)).toBe(1);
  const tone = await currentTone(page);
  await page.locator(`[data-tone="${tone}"]`).click();
  await expect(page.locator('#app')).toHaveAttribute('data-outcome', 'success');
  await page.clock.runFor(2700);
  expect(await page.evaluate(() => window.__audioPlays.length)).toBe(2);
  await expect(page.locator('[data-tone]').first()).toBeEnabled();
  for (let miss = 1; miss <= 4; miss++) {
    const correct = await currentTone(page);
    await page.locator(`[data-tone]:not([data-tone="${correct}"])`).first().click();
    await expect(page.locator('#practise-mistakes')).toHaveCount(0);
    if (miss < 4) {
      await expect(page.locator('#ending-practice')).toHaveCount(0);
      await page.locator('#continue-game').click();
      await page.clock.runFor(150);
    }
  }
  await page.clock.runFor(2900);
  await expect(page.locator('#ending-practice')).toBeEnabled();
  await page.locator('#ending-practice').click();
  await expect(page.getByRole('heading', { name: 'Practice tones' })).toBeVisible();
  await expectNoOverflow(page);
});

test('Skyrail retry, crossing, pause and timeout keep the input usable', async ({ page }) => {
  await start(page, 'tide');
  await page.clock.runFor(150);
  const input = page.getByRole('textbox');
  const originalInput = await input.elementHandle();
  await input.fill('wrong');
  await page.locator('#check-answer').click();
  await expect(page.locator('#input-status')).toContainText('No life lost');
  await expect(input).toBeEnabled();
  await input.fill('si');
  await expect(page.locator('#app')).toHaveAttribute('data-outcome', 'success');
  await page.clock.runFor(1050);
  await expect(input).toHaveValue('');
  expect(await input.evaluate((node, original) => node === original, originalInput)).toBe(true);
  await input.fill('unfinished');
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.clock.runFor(20000);
  await expect(input).toHaveValue('unfinished');
  await page.getByRole('button', { name: 'Resume', exact: false }).click();
  await page.clock.runFor(16000);
  await expect(page.locator('#app')).toHaveAttribute('data-outcome', 'timeout');
  await expect(input).toBeDisabled();
  await expect(page.locator('#continue-game')).toBeVisible();
  await page.locator('#continue-game').click();
  await page.clock.runFor(150);
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue('');
  await expectNoOverflow(page);
});

test('phone keyboard keeps the rail journey visible above the typing field', async ({ page }) => {
  test.skip(page.viewportSize().width > 700, 'Keyboard layout is only used on phones.');
  await start(page, 'tide');
  await page.clock.runFor(150);
  const size = page.viewportSize();
  await page.setViewportSize({ width: size.width, height: size.width === 360 ? 380 : 450 });
  await page.getByRole('textbox').focus();
  await expect(page.locator('body')).toHaveClass(/keyboard-open/);
  const scene = page.locator('.world-scene');
  await expect(scene).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('textbox')).toBeInViewport({ ratio: 1 });
  const rail = await scene.boundingBox();
  const field = await page.getByRole('textbox').boundingBox();
  expect(rail.height).toBeGreaterThanOrEqual(88);
  expect(rail.y + rail.height).toBeLessThanOrEqual(field.y);
  await page.getByRole('textbox').fill('si');
  await expect(scene).toBeInViewport({ ratio: 1 });
  await page.clock.runFor(1050);
  await expect(scene).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('textbox')).toBeFocused();
  await expectNoOverflow(page);
  await page.setViewportSize(size);
  await expect(page.locator('body')).not.toHaveClass(/keyboard-open/);
});

test('missed-sound practice retains multi-syllable recordings from the tower', async ({ page }) => {
  // Force every missed recording to be a word, so the default single-syllable filter cannot hide it.
  await page.route('**/catalog.json', (route) =>
    route.fulfill({
      json: {
        ...catalog,
        words: singles.map((word) => ({
          ...word,
          syllables: [...word.syllables, ...word.syllables],
        })),
        recordings: catalog.recordings.filter((recording) => recording.wordId !== 'morning'),
      },
    }),
  );
  await page.reload();
  await start(page, 'tone');
  await page.clock.runFor(2200);
  for (let miss = 0; miss < 4; miss++) {
    const correct = await currentTone(page);
    await page
      .locator('[data-tone]:not([data-tone="' + correct + '"])')
      .first()
      .click();
    if (miss < 3) {
      await page.locator('#continue-game').click();
      await page.clock.runFor(150);
    }
  }
  await page.clock.runFor(2900);
  await page.locator('#ending-practice').click();
  await expect(page.getByRole('heading', { name: 'Practice tones' })).toBeVisible();
  await expectNoOverflow(page);
});
