import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createStaticServer} from './static-server.mjs';

test('preview serves only its configured project path and returns real asset failures',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'tone-tower-server-'));
  t.after(async()=>{
    if(path.dirname(root)!==tmpdir()||!path.basename(root).startsWith('tone-tower-server-'))throw Error('Unsafe cleanup');
    await rm(root,{recursive:true,force:true});
  });
  await writeFile(path.join(root,'index.html'),'<h1>Preview</h1>');
  await writeFile(path.join(root,'app.js'),'export const game=true;');
  const server=await createStaticServer({root,base:'/new-name/'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(origin+'/new-name/');
  assert.equal(response.status,200);assert.equal(await response.text(),'<h1>Preview</h1>');
  const redirect=await fetch(origin+'/new-name',{redirect:'manual'});
  assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/new-name/');
  const head=await fetch(origin+'/new-name/app.js',{method:'HEAD'});
  assert.equal(head.status,200);assert.match(head.headers.get('content-type'),/^text\/javascript/);assert.equal(await head.text(),'');
  for(const route of ['/app.js','/new-name/missing.js','/new-name/%2e%2e%2fpackage.json','/new-name/%5c..%5cpackage.json'])assert.equal((await fetch(origin+route)).status,404,route);
  assert.equal((await fetch(origin+'/new-name/',{method:'POST'})).status,405);
  await assert.rejects(()=>createStaticServer({root,base:'/missing-trailing-slash'}),/Base must/);
});
