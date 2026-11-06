import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProgress,saveProgress,recordRun,resetProgress,emptyProgress,PROGRESS_KEY} from './progress.js';
import {createRun,defaultPractice} from './game-core.js';
const storage=values=>{const data=new Map(Object.entries(values??{}).map(([key,value])=>[key,JSON.stringify(value)]));return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}};
const words=Array.from({length:12},(_,i)=>({id:String(i),syllables:[{character:'字',jyutping:`zi${i%6+1}`,tone:i%6+1}]}));

test('current adventure records and preferences survive while retired archives are removed',()=>{
 const current=emptyProgress();current.version=2;current.settings.toneVariant='hard';current.settings.tideVariant='full';current.records.tone.normal={runs:4,wins:2,best:100,fewest:3};current.records.tide.full.hard={runs:3,wins:0,best:42,fewest:null};current.classic={spelling:{runs:5,wins:1,best:100}};current.previousSkyrail={full:{runs:3,wins:0,best:80}};
 const target=storage({[PROGRESS_KEY]:current,'two-doors-typed-survival-v2':{records:{plain:{runs:5,wins:1,best:100}}}}),progress=loadProgress(target);
 assert.equal(progress.version,3);assert.equal(progress.settings.toneVariant,'hard');assert.equal(progress.settings.tideVariant,'full');assert.equal(progress.records.tone.normal.wins,2);assert.equal(progress.records.tide.full.hard.best,42);
 assert.equal(progress.classic,undefined);assert.equal(progress.previousSkyrail,undefined);assert.equal(progress.legacyPractice,undefined);assert.equal(target.data.has('two-doors-typed-survival-v2'),false);assert.deepEqual(loadProgress(target),progress);
});

test('challenge records save once and practice never changes official records',()=>{
  const progress=emptyProgress();
  const run=createRun({challenge:'tone',variant:'extreme'},words,()=>0.2);
  run.answer(run.choices.find(t=>t!==run.word.tone));
  recordRun(progress,run);recordRun(progress,run);
  assert.equal(progress.records.tone.extreme.runs,1);
  assert.deepEqual(progress.missedIds,[run.word.id]);
  assert.equal(Object.values(progress.confusions)[0],1);
  const practice=createRun({...defaultPractice('tone'),format:'rehearsal',start:100},words,()=>0.2);
  practice.answer(practice.word.tone);
  recordRun(progress,practice);
  assert.equal(progress.practice.runs,1);
  assert.equal(progress.practice.completed,1);
  assert.equal(progress.practice.cleared,1);
  assert.equal(progress.records.tone.normal.wins,0);
  const target=storage();
  assert.equal(saveProgress(progress,target),true);
  assert.deepEqual(loadProgress(target),progress);
});

test('malformed, blocked and unavailable storage fail safely',()=>{
  const target=storage();target.data.set(PROGRESS_KEY,'{broken');
  assert.equal(loadProgress(target).version,3);
  const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
  assert.deepEqual(loadProgress(blocked),emptyProgress());
  assert.equal(saveProgress(emptyProgress(),blocked),false);
  assert.equal(resetProgress(blocked).version,3);
  const invalid=storage({[PROGRESS_KEY]:{version:1,settings:{toneVariant:'wrong'},records:{tone:{normal:{runs:-1,wins:999,best:500,fewest:-2}}},missedIds:['a','a',3]}});
  const safe=loadProgress(invalid);
  assert.equal(safe.settings.toneVariant,'normal');
  assert.deepEqual(safe.records.tone.normal,{runs:0,wins:0,best:100,fewest:null});
  assert.deepEqual(safe.missedIds,['a']);
});

test('reset clears all old generations so migration cannot resurrect progress',()=>{
  const target=storage({'two-doors-survival-v2':{version:2,records:{normal:{runs:8,wins:1,best:100}}},'two-doors-typed-survival-v1':{records:{plain:{runs:4,wins:1,best:100}}}});
  assert.equal(loadProgress(target).records.tone.normal.runs,0);
  resetProgress(target);
  assert.deepEqual(loadProgress(target),emptyProgress());
  assert.equal(target.data.has('two-doors-survival-v2'),false);
  assert.equal(target.data.has('two-doors-typed-survival-v1'),false);
});

test('retired preview records cannot return after cleanup or reset',()=>{
 const previous=emptyProgress();previous.records.tone.easy.runs=3;const target=storage({'soundbound-v1':previous});
 assert.equal(loadProgress(target).records.tone.easy.runs,0);assert.equal(target.data.has('soundbound-v1'),false);resetProgress(target);assert.deepEqual(loadProgress(target),emptyProgress());
});

test('old ungrouped Skyrail scores are discarded and new difficulty records save independently',()=>{
 const old=emptyProgress();old.version=1;old.records.tide={spelling:{runs:9,wins:2,best:100,fewest:1},full:{runs:2,wins:0,best:42,fewest:null}};
 const target=storage({[PROGRESS_KEY]:old}),progress=loadProgress(target);assert.equal(progress.previousSkyrail,undefined);assert.equal(progress.records.tide.spelling.normal.runs,0);assert.deepEqual(loadProgress(target),progress);
 const run=createRun({challenge:'tide',variant:'full',difficulty:'extreme'},[...words,{id:'multi',syllables:[{character:'你',jyutping:'nei5',tone:5},{character:'好',jyutping:'hou2',tone:2}]}],()=>.2);run.fail('timeout');recordRun(progress,run);recordRun(progress,run);assert.equal(progress.records.tide.full.extreme.runs,1);assert.equal(progress.records.tide.full.normal.runs,0);saveProgress(progress,target);assert.deepEqual(loadProgress(target),progress);
});
