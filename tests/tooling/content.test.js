import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('bundled recordings cover every tone with credited, aligned audio', async () => {
  const data = JSON.parse(await readFile('data/audio/content.json'));
  const items = data.filter((w) => !w.anchor);
  assert.equal(data.filter((w) => w.anchor).length, 6);
  assert.equal(new Set(data.map((w) => w.id)).size, data.length);
  for (const x of data) {
    assert.ok(x.source && x.license && x.author);
    assert.ok((await stat(x.audio)).size > 1000);
    if (x.syllables) {
      assert.ok([1, 2].includes(x.syllables.length));
      assert.equal(x.syllables.map((s) => s.character).join(''), x.character);
      for (const s of x.syllables) assert.equal(Number(s.jyutping.at(-1)), s.tone);
    }
  }
  for (const length of [1, 2]) {
    const recordings = items.filter((x) => (x.syllables?.length || 1) === length);
    assert.ok(recordings.length >= (length === 1 ? 72 : 40));
    for (let tone = 1; tone <= 6; tone++)
      assert.ok(
        recordings.filter((x) => (x.syllables || [x]).some((s) => s.tone === tone)).length >= 12,
      );
    for (const tone of [1, 3, 6])
      assert.ok(
        recordings.some((x) =>
          (x.syllables || [x]).some((s) => s.tone === tone && /[ptk][136]$/.test(s.jyutping)),
        ),
      );
  }
});
