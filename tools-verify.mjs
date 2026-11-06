import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {catalogRows} from './catalog.js';
import {checkDistribution} from './tools-check-dist.mjs';
const catalog=JSON.parse(await readFile('dist/catalog.json','utf8'));
const content=catalogRows(catalog);
await checkDistribution();
const run=promisify(execFile);
let next=0, checked=0;
// Bound subprocesses so the full library can be checked without flooding a laptop.
await Promise.all(Array.from({length:Math.min(4,content.length)},async()=>{
  while(next<content.length){
    const item=content[next++],audio=path.join('dist',item.audio);
    const {stdout}=await run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',audio],{encoding:'utf8',timeout:30000});
    const duration=Number(stdout);
    assert.ok(duration>.1&&duration<10,item.id+' has an unexpected duration');
    await run('ffmpeg',['-v','error','-i',audio,'-f','null','-'],{timeout:30000});
    if(++checked%100===0)console.log(`Decoded ${checked}/${content.length} recordings.`);
  }
}));
console.log(`Decoded ${content.length} published MP3s; static hosting checks passed.`);
