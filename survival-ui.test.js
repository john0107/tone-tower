import test from 'node:test';
import assert from 'node:assert/strict';
import {createSurvival} from './survival-ui.js';
function fixture(t,difficulty='normal'){
 const originals={document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,requestAnimationFrame:globalThis.requestAnimationFrame,localStorage:globalThis.localStorage};
 t.after(()=>Object.assign(globalThis,originals));
 const data={'two-doors-survival-v2':JSON.stringify({version:2,difficulty})},timers=new Map();let serial=0,focused=null;
 globalThis.localStorage={getItem:k=>data[k],setItem:(k,v)=>data[k]=v};
 globalThis.setTimeout=fn=>{timers.set(++serial,fn);return serial};globalThis.clearTimeout=id=>timers.delete(id);globalThis.requestAnimationFrame=()=>{};
 const keys=[];globalThis.document={addEventListener:(name,fn)=>{if(name==='keydown')keys.push(fn)}};
 class Element{constructor(){this.dataset={};this.listeners={};this.disabled=false}addEventListener(name,fn){assert.equal(typeof fn,'function');this.listeners[name]=fn}querySelector(){return this.child||(this.child=new Element())}focus(){focused=this}click(){(this.onclick||this.listeners.click)?.()}}
 const app={dataset:{},nodes:{},doors:[],references:[],set innerHTML(value){this.html=value;this.nodes={};this.doors=[...value.matchAll(/data-door="(\d)"/g)].map(m=>{const e=new Element();e.dataset.door=m[1];return e});this.references=[...value.matchAll(/data-reference="([^"]+)"/g)].map(m=>{const e=new Element();e.dataset.reference=m[1];return e});for(const m of value.matchAll(/id="([^"]+)"/g))this.nodes['#'+m[1]]=new Element()},get innerHTML(){return this.html},querySelector(s){return this.nodes[s]||null},querySelectorAll(s){return s==='[data-door]'?this.doors:s==='[data-reference]'?this.references:[]}};
 const words=Array.from({length:180},(_,i)=>{const tone=i%6+1;return {id:String(i),tone,character:'字',jyutping:'sampleT'+tone+'x'+tone,gloss:'word',audio:i+'.mp3'}}),anchors=Array.from({length:6},(_,i)=>({tone:i+1,character:'字',jyutping:'zi6',gloss:'word',audio:'anchor.mp3'}));
 const player={preload(){},stop(){},async play(){if(this.error)throw Error('missing')}};const dialog={open:false};
 const ui=createSurvival({app,player,dialog,words,anchors,hall:x=>x,escape:String,shape:()=>'',descriptions:Array(6).fill('tone'),onHome(){ui.home()},onPractice(){}});
 const tick=()=>{const entry=timers.entries().next().value;assert.ok(entry);timers.delete(entry[0]);entry[1]()};
 const key=k=>keys.forEach(fn=>fn({key:k,code:k===' '?'Space':'',repeat:false,target:{tagName:'BODY'},preventDefault(){}}));
 const choose=correct=>{const tone=Number(app.html.match(/sampleT(\d)x/)[1]);app.doors.find(d=>(Number(d.dataset.door)===tone)===correct).click()};
 ui.home();app.querySelector('#survival-start').click();
 return {app,ui,player,dialog,data,timers,tick,key,choose,focused:()=>focused};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve()};
test('mistakes continue by click and Enter with a fresh question on the same floor',async t=>{
 const f=fixture(t);await flush();f.choose(false);assert.match(f.app.html,/Listen once more/);assert.equal(f.app.references.length,2);assert.equal(f.focused(),f.app.querySelector('#continue'));
 f.app.querySelector('#continue').click();await flush();assert.match(f.app.html,/Which tone did you hear/);assert.match(f.app.html,/0 \/ 100 floors/);assert.ok(f.app.doors.every(d=>!d.disabled));
 f.choose(false);f.key('Enter');await flush();assert.match(f.app.html,/Which tone did you hear/);assert.match(f.app.html,/2 of 4 hearts/);
});
test('complete winning climb pauses at every landing and saves once',async t=>{
 const f=fixture(t);await flush();
 for(let floor=1;floor<=100;floor++){
  assert.equal(f.app.doors.length,floor<=20?2:floor<=40?3:floor<=60?4:6);f.choose(true);
  if(floor%20===0&&floor<100){assert.match(f.app.html,/A landing/);assert.equal(f.timers.size,0);if(floor===40){f.app.querySelector('#continue').click()}else f.key('Enter')}
  else f.tick();await flush();
 }
 assert.match(f.app.html,/You made it to the top/);const p=JSON.parse(f.data['two-doors-survival-v2']);assert.equal(p.records.normal.runs,1);assert.equal(p.records.normal.wins,1);assert.equal(p.records.normal.best,100);assert.equal(f.timers.size,0);
});
test('Extreme defeat saves immediately and retry starts at the bottom',async t=>{
 const f=fixture(t,'extreme');await flush();f.choose(false);assert.match(f.app.html,/0\/100/);assert.ok(f.app.querySelector('#retry'));assert.equal(f.app.references.length,2);assert.equal(JSON.parse(f.data['two-doors-survival-v2']).records.extreme.runs,1);f.app.querySelector('#retry').click();await flush();assert.match(f.app.html,/0 \/ 100 floors/);assert.equal(f.app.doors.length,2);
});
test('audio failure is unscored and credits pause automatic progression',async t=>{
 const f=fixture(t);await flush();f.player.error=true;f.app.querySelector('#replay').listeners.click();await flush();assert.ok(f.app.querySelector('#audio-error').innerHTML.includes('without penalty'));assert.ok(f.app.doors.every(d=>d.disabled));f.player.error=false;f.app.querySelector('#replay').listeners.click();await flush();f.choose(true);assert.equal(f.timers.size,1);f.dialog.open=true;f.ui.pause();assert.equal(f.timers.size,0);f.dialog.open=false;f.ui.resume();assert.equal(f.timers.size,1);f.ui.home();assert.equal(f.timers.size,0);
});

test('practice climb survives more than 125 mistakes and saves separately',async t=>{
 const f=fixture(t);f.ui.startPractice();await flush();
 for(let i=0;i<130;i++){f.choose(false);assert.match(f.app.html,/Unlimited lives/);assert.equal(f.app.references.length,2);f.key('Enter');await flush()}
 for(let floor=1;floor<=100;floor++){f.choose(true);if(floor%20===0&&floor<100)f.key('Enter');else f.tick();await flush()}
 assert.match(f.app.html,/You made it to the top/);assert.equal(JSON.parse(f.data['two-doors-practice-climb-v1']).completed,1);assert.equal(JSON.parse(f.data['two-doors-practice-climb-v1']).lastMistakes,130);assert.equal(JSON.parse(f.data['two-doors-survival-v2']).records.normal.runs,0);
});
