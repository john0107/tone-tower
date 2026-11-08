import { atomicJSON, readJSON } from '../lib/json.mjs';

export const emptyCache = () => ({ metadata: {}, retryAfter: 0 });
export const COMMONS_USER_AGENT =
  'ToneTower/1.0 (https://github.com/john0107/tone-tower) educational audio importer';
const MIN_INTERVAL = 2000;
const MAX_INTERVAL = 60000;

export function retryDelay(header, now, attempt) {
  const seconds = header?.trim() ? Number(header) : NaN;
  const delay = Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - now : NaN;
  return Number.isFinite(delay) && delay > 0 ? delay : Math.min(600000, 60000 * 2 ** attempt);
}
export const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });

export function commonsClient(cachePath, signal, options = {}) {
  const requestFetch = options.fetch || globalThis.fetch;
  const now = options.now || Date.now;
  const wait = options.sleep || sleep;
  const log = options.log || console.log;
  return async function request(url) {
    const host = new URL(url).hostname;
    for (let attempt = 0; attempt < 5; attempt++) {
      signal?.throwIfAborted();
      const cache = await readJSON(cachePath, emptyCache);
      // Old caches had one shared cooldown. Honor it before adopting host state.
      const legacyDeadline = cache.hosts ? 0 : Number(cache.retryAfter || 0);
      cache.hosts ||= {};
      const state = (cache.hosts[host] ||= {
        retryAfter: legacyDeadline,
        nextRequestAt: 0,
        intervalMs: MIN_INTERVAL,
        successes: 0,
      });
      const remaining = Math.max(state.retryAfter, state.nextRequestAt) - now();
      if (remaining > 0) {
        log('[' + host + '] Waiting ' + remaining + ' ms for cooldown/request spacing');
        await wait(remaining, signal);
      }
      const response = await requestFetch(url, {
        headers: { 'User-Agent': COMMONS_USER_AGENT },
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
          : AbortSignal.timeout(30000),
      });
      if (response.status !== 429 && response.status !== 503) {
        if (!response.ok) throw Error('HTTP ' + response.status + ' from ' + host);
        // Recover slowly after sustained success rather than bursting after a cooldown.
        if (++state.successes >= 10) {
          state.intervalMs = Math.max(MIN_INTERVAL, Math.ceil(state.intervalMs * 0.9));
          state.successes = 0;
        }
        state.nextRequestAt = now() + state.intervalMs;
        await atomicJSON(cachePath, cache);
        return response;
      }
      await response.body?.cancel();
      const delay = retryDelay(response.headers.get('retry-after'), now(), attempt);
      state.retryAfter = now() + delay;
      state.intervalMs = Math.min(MAX_INTERVAL, Math.max(10000, state.intervalMs * 2));
      state.nextRequestAt = now() + state.intervalMs;
      state.successes = 0;
      cache.retryAfter = Math.max(...Object.values(cache.hosts).map((row) => row.retryAfter));
      await atomicJSON(cachePath, cache);
      log(
        '[' +
          host +
          '] HTTP ' +
          response.status +
          '; rate limited until ' +
          new Date(state.retryAfter).toISOString() +
          '; request spacing ' +
          state.intervalMs +
          ' ms',
      );
      if (attempt === 4)
        throw Error('HTTP ' + response.status + ' from ' + host + ' after 5 attempts');
    }
  };
}
