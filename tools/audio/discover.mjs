import { audioPaths } from './paths.mjs';
import { withAudioLock } from './lock.mjs';
import { commonsClient, sleep } from './commons.mjs';
import { readJSON, atomicJSON } from '../lib/json.mjs';

await withAudioLock(async () => {
  const paths = audioPaths();
  const request = commonsClient(paths.state);
  const categories = [
    'Category:Cantonese pronunciation',
    'Category:Lingua Libre pronunciation-other (Q9186)',
  ];
  let state = await readJSON(paths.candidates, { category: 0, continuation: null, items: [] });
  const seen = new Map(state.items.map((item) => [item.pageid, item]));
  if (process.argv.includes('--refresh')) state = { ...state, category: 0, continuation: null };
  for (let i = state.category; i < categories.length; i++) {
    let next = i === state.category ? state.continuation : null;
    do {
      const url = new URL('https://commons.wikimedia.org/w/api.php');
      url.search = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'categorymembers',
        cmtitle: categories[i],
        cmtype: 'file',
        cmlimit: '500',
        ...(next || {}),
      });
      const result = await (await request(url)).json();
      for (const item of result.query.categorymembers) seen.set(item.pageid, item);
      next = result.continue || null;
      await atomicJSON(paths.candidates, {
        category: next ? i : i + 1,
        continuation: next,
        items: [...seen.values()],
      });
      console.log(categories[i], seen.size);
      if (next) await sleep(1200);
    } while (next);
  }
});
