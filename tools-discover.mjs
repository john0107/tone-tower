import {writeFile,readFile,mkdir,rename} from 'node:fs/promises';
const endpoint='https://commons.wikimedia.org/w/api.php';
const categories=['Category:Cantonese pronunciation','Category:Lingua Libre pronunciation-other (Q9186)'];
const cachePath='.audio-import-cache/state.json', inventoryPath='audio-candidates.json';
await mkdir('.audio-import-cache',{recursive:true});
const atomic=async(file,text)=>{const tmp=file+'.tmp-'+process.pid;await writeFile(tmp,text);await rename(tmp,file)};
const readCache=async()=>{try{return JSON.parse(await readFile(cachePath,'utf8'))}catch(e){if(e.code==='ENOENT')return {metadata:{},retryAfter:0,excluded:[]};throw e}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const seen=new Map();let state={category:0,continuation:null,items:[]};try{state=JSON.parse(await readFile(inventoryPath,'utf8'));for(const x of state.items)seen.set(x.pageid,x)}catch(e){if(e.code!=='ENOENT')throw e}
if(process.argv.includes('--refresh'))state={...state,category:0,continuation:null};
for(let i=state.category;i<categories.length;i++){
 let next=i===state.category?state.continuation:null;
 do{
  const url=new URL(endpoint);url.search=new URLSearchParams({action:'query',format:'json',list:'categorymembers',cmtitle:categories[i],cmtype:'file',cmlimit:'500',...(next||{})});
  let response;
  for(let attempt=0;attempt<5;attempt++){
   const cache=await readCache(),remaining=Number(cache.retryAfter||0)-Date.now();if(remaining>0){console.log('Waiting',remaining,'ms for rate limit');await sleep(remaining)}
   response=await fetch(url,{headers:{'User-Agent':'TwoDoors/1.0 educational recording discovery'},signal:AbortSignal.timeout(30000)});
   if(response.status!==429)break;
   const retry=response.headers.get('retry-after'),seconds=Number(retry),parsed=retry&&!Number.isFinite(seconds)?Date.parse(retry)-Date.now():seconds*1000;
   const latest=await readCache();latest.retryAfter=Date.now()+Math.max(60000,Number.isFinite(parsed)?parsed:0);await atomic(cachePath,JSON.stringify(latest,null,2));console.log('Rate limited until',new Date(latest.retryAfter).toISOString());
  }
  if(!response.ok)throw Error('Commons returned '+response.status);
  const result=await response.json();for(const item of result.query.categorymembers)seen.set(item.pageid,item);next=result.continue||null;
  await atomic(inventoryPath,JSON.stringify({category:next?i:i+1,continuation:next,items:[...seen.values()]},null,2));console.log(categories[i],seen.size);if(next)await sleep(1200);
 }while(next)
}
