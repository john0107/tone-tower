import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const discovery = fileURLToPath(new URL('../../tools/audio/discover.mjs', import.meta.url));
test('discovery resumes, honors saved and date-formatted retry deadlines, and deduplicates', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'jyutping-discover-test-'));
  try {
    await mkdir(path.join(dir, '.audio-import-cache'));
    await writeFile(
      path.join(dir, '.audio-import-cache', 'state.json'),
      JSON.stringify({ metadata: {}, excluded: [], retryAfter: 1700000009000 }),
    );
    await writeFile(
      path.join(dir, 'audio-candidates.json'),
      JSON.stringify({
        category: 0,
        continuation: null,
        items: [{ pageid: 1, title: 'File:first.ogg' }],
      }),
    );
    const shim = path.join(dir, 'mock.mjs');
    await writeFile(
      shim,
      `import {writeFileSync} from 'node:fs';
let now=1700000000000,calls=0;Date.now=()=>now;globalThis.setTimeout=(fn,ms)=>{now+=ms;fn();return 0};
globalThis.fetch=async()=>{calls++;if(calls===1){writeFileSync('first-call.txt',String(now));return {status:429,ok:false,headers:{get:()=>new Date(now+120000).toUTCString()}}}return {status:200,ok:true,json:async()=>({query:{categorymembers:[{pageid:1,title:'File:first.ogg'},{pageid:calls,title:'File:new.ogg'}]},...(calls===2?{continue:{cmcontinue:'next',continue:'-||'}}:{})})}};
`,
    );
    execFileSync(process.execPath, ['--import', pathToFileURL(shim).href, discovery], {
      cwd: dir,
      timeout: 10000,
      encoding: 'utf8',
    });
    assert.equal(Number(await readFile(path.join(dir, 'first-call.txt'), 'utf8')), 1700000009000);
    const cache = JSON.parse(
      await readFile(path.join(dir, '.audio-import-cache', 'state.json'), 'utf8'),
    );
    assert.equal(cache.retryAfter, 1700000129000);
    const result = JSON.parse(await readFile(path.join(dir, 'audio-candidates.json'), 'utf8'));
    assert.equal(result.category, 2);
    assert.equal(new Set(result.items.map((x) => x.pageid)).size, result.items.length);
    assert.ok(result.items.length > 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
