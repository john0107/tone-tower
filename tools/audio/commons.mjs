import { atomicJSON, readJSON } from '../lib/json.mjs';

export const emptyCache = () => ({ metadata: {}, retryAfter: 0 });
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

export function commonsClient(cachePath, signal) {
  return async function request(url) {
    for (let attempt = 0; attempt < 5; attempt++) {
      signal?.throwIfAborted();
      const cache = await readJSON(cachePath, emptyCache);
      const remaining = Number(cache.retryAfter || 0) - Date.now();
      if (remaining > 0) {
        console.log('Waiting', remaining, 'ms for rate limit');
        await sleep(remaining, signal);
      }
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ToneTower/1.0 educational audio importer' },
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
          : AbortSignal.timeout(30000),
      });
      if (response.status !== 429) {
        if (!response.ok) throw Error('HTTP ' + response.status);
        return response;
      }
      const retry = response.headers.get('retry-after');
      const seconds = Number(retry);
      const delay =
        retry && !Number.isFinite(seconds) ? Date.parse(retry) - Date.now() : seconds * 1000;
      cache.retryAfter = Date.now() + Math.max(60000, Number.isFinite(delay) ? delay : 0);
      await atomicJSON(cachePath, cache);
      console.log('Rate limited until', new Date(cache.retryAfter).toISOString());
    }
    throw Error('Wikimedia rate limit');
  };
}
