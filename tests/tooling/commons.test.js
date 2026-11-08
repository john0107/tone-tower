import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { commonsClient, retryDelay, COMMONS_USER_AGENT } from '../../tools/audio/commons.mjs';

test('Retry-After supports seconds and dates, with exponential fallback for missing values', () => {
  const now = Date.parse('2026-11-08T00:00:00Z');
  assert.equal(retryDelay('3', now, 0), 3000);
  assert.equal(retryDelay(new Date(now + 120000).toUTCString(), now, 0), 120000);
  for (const header of [null, '', 'invalid', '-1', '0', new Date(now - 1).toUTCString()]) {
    assert.equal(retryDelay(header, now, 1), 120000);
  }
});

async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'tone-tower-commons-'));
  t.after(async () => {
    assert.equal(path.dirname(dir), tmpdir());
    assert.ok(path.basename(dir).startsWith('tone-tower-commons-'));
    await rm(dir, { recursive: true, force: true });
  });
  const file = path.join(dir, 'state.json');
  let time = 1700000000000;
  const waits = [],
    logs = [];
  return {
    file,
    waits,
    logs,
    options: {
      now: () => time,
      sleep: async (ms) => {
        waits.push(ms);
        time += ms;
      },
      log: (line) => logs.push(line),
    },
  };
}
const ok = () => ({ status: 200, ok: true });
const limited = (status, retry) => ({
  status,
  ok: false,
  headers: { get: () => retry },
});

test('host pacing survives a restart, preserves metadata and isolates media cooldowns', async (t) => {
  const f = await fixture(t);
  await writeFile(f.file, JSON.stringify({ metadata: { saved: true }, retryAfter: 0 }));
  let requests = 0;
  const fetch = async (url, options) => {
    assert.equal(options.headers['User-Agent'], COMMONS_USER_AGENT);
    assert.match(COMMONS_USER_AGENT, /https:\/\/github.com\/john0107\/tone-tower/);
    return ++requests === 1 ? limited(429, '600') : ok();
  };
  await commonsClient(f.file, null, { ...f.options, fetch })('https://upload.wikimedia.org/a.wav');
  assert.deepEqual(f.waits, [600000]);
  let saved = JSON.parse(await readFile(f.file, 'utf8'));
  assert.equal(saved.metadata.saved, true);
  assert.equal(saved.hosts['upload.wikimedia.org'].intervalMs, 10000);
  await commonsClient(f.file, null, { ...f.options, fetch: async () => ok() })(
    'https://upload.wikimedia.org/b.wav',
  );
  assert.deepEqual(f.waits, [600000, 10000]);
  // A long media cooldown must not block a request to the metadata API.
  saved = JSON.parse(await readFile(f.file, 'utf8'));
  saved.hosts['upload.wikimedia.org'].retryAfter = f.options.now() + 600000;
  saved.retryAfter = f.options.now() + 600000;
  await writeFile(f.file, JSON.stringify(saved));
  await commonsClient(f.file, null, { ...f.options, fetch: async () => ok() })(
    'https://commons.wikimedia.org/w/api.php',
  );
  assert.deepEqual(f.waits, [600000, 10000]);
  assert.match(f.logs[0], /upload\.wikimedia\.org.*HTTP 429/);
});

test('legacy cooldowns are retained and 503 retries back off without Retry-After', async (t) => {
  const f = await fixture(t);
  await writeFile(f.file, JSON.stringify({ metadata: {}, retryAfter: f.options.now() + 9000 }));
  let requests = 0;
  await commonsClient(f.file, null, {
    ...f.options,
    fetch: async () => (++requests <= 2 ? limited(503, null) : ok()),
  })('https://commons.wikimedia.org/w/api.php');
  assert.deepEqual(f.waits, [9000, 60000, 120000]);
  const saved = JSON.parse(await readFile(f.file, 'utf8'));
  assert.equal(saved.hosts['commons.wikimedia.org'].intervalMs, 20000);
  assert.match(f.logs.join('\n'), /HTTP 503/);
});

test('aborting a cooldown sends no request and keeps the saved deadline', async (t) => {
  const f = await fixture(t);
  const saved = { metadata: {}, retryAfter: f.options.now() + 600000 };
  await writeFile(f.file, JSON.stringify(saved));
  const abort = new AbortController();
  const request = commonsClient(f.file, abort.signal, {
    ...f.options,
    sleep: async () => {
      abort.abort();
      throw abort.signal.reason;
    },
    fetch: async () => assert.fail('No request should be made'),
  });
  await assert.rejects(request('https://upload.wikimedia.org/a.wav'), { name: 'AbortError' });
  assert.deepEqual(JSON.parse(await readFile(f.file, 'utf8')), saved);
});
