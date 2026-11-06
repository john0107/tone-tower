import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {survivalQuestions,newSurvival,survivalAnswer,activateQuestion,doorCount,runSummary} from './survival.js';
import {buildChoices,practiceSession} from './logic.js';
import {emptySurvival,loadSurvival,saveSurvival,recordSurvival,practicePreferences,resetProgress} from './storage.js';
const question=()=>({word:{tone:1},doors:[1,2],answer:null});
const answer=(s,correct=true)=>survivalAnswer(s,question(),correct?1:2);

test('125 unique target recordings cover balanced shuffled blocks',async()=>{
 const words=JSON.parse(await readFile('content.json')).filter(x=>!x.anchor),qs=survivalQuestions(words);
 assert.equal(qs.length,125);assert.equal(new Set(qs.map(x=>x.word.id)).size,125);
 for(let i=0;i<120;i+=6)assert.deepEqual(qs.slice(i,i+6).map(x=>x.word.tone).sort(),[1,2,3,4,5,6]);
 for(const q of qs){assert.equal(q.doors.length,0);assert.equal(q.word.syllables[q.word.targetIndex].tone,q.word.tone)}
});
test('stages follow clears, not attempts, and boundary answers count in the old stage',()=>{
 const s=newSurvival();for(let i=0;i<100;i++){
  const q=question();q.doors=[];activateQuestion(s,q);assert.equal(q.doors.length,i<20?2:i<40?3:i<60?4:6);
  if([19,39,59,79].includes(i)){answer(s,false);assert.equal(s.opened,i);assert.equal(doorCount(s.opened),q.doors.length)}
  survivalAnswer(s,q,1);
 }assert.equal(s.status,'won');assert.deepEqual(s.stages.map(x=>x.correct),[20,20,20,20,20]);assert.deepEqual(s.stages.map(x=>x.mistakes),[1,1,1,1,0]);assert.equal(answer(s),null);
});
test('recovery, full refills, victory and answer locking',()=>{
 for(const [d,max] of [['easy',5],['normal',4],['hard',3],['extreme',1]]){
  const s=newSurvival(d);assert.equal(s.hearts,max);
  for(let i=1;i<=100;i++){
   if(max>1&&i%10===0)answer(s,false);
   const q=question(),out=survivalAnswer(s,q,1);assert.equal(survivalAnswer(s,q,1),null);
   assert.equal(out.kind,i===100?'won':i%20===0?'landing':i%10===0?'recovery':'progress');
   if(i<100&&i%10===0){assert.equal(s.hearts,max);assert.equal(out.recovered,max>1?1:0)}
   if(i===100)assert.equal(out.recovered,0);
  }assert.equal(s.status,'won');assert.equal(s.opened,100);
 }
});
test('a full refill replaces the small recovery and defeat cannot be revived',()=>{
 const s=newSurvival('easy');for(let i=0;i<19;i++)answer(s);answer(s,false);answer(s,false);assert.equal(answer(s).recovered,2);assert.equal(s.hearts,5);
 const extreme=newSurvival('extreme');for(let i=0;i<19;i++)answer(extreme);assert.equal(answer(extreme,false).kind,'lost');assert.equal(answer(extreme),null);assert.equal(extreme.opened,19);assert.equal(extreme.hearts,0);
});
test('the longest Easy win fits exactly 125 questions',()=>{
 const s=newSurvival('easy');for(let stage=0;stage<5;stage++){for(let i=0;i<4;i++)answer(s,false);for(let i=0;i<10;i++)answer(s);answer(s,false);for(let i=0;i<10;i++)answer(s)}
 assert.equal(s.status,'won');assert.equal(s.attempts,125);assert.equal(s.mistakes,25);
});
test('every supported Practice tone subset and choice count works',async()=>{
 const words=JSON.parse(await readFile('content.json')).filter(x=>!x.anchor);
 for(let mask=1;mask<64;mask++){const pool=[1,2,3,4,5,6].filter(t=>mask&(1<<(t-1)));for(const count of [2,3,4,6].filter(n=>n<=pool.length)){
  const qs=practiceSession(words,pool,count);assert.equal(qs.length,10);assert.equal(new Set(qs.map(q=>q.word.id)).size,10);
  const amounts=pool.map(t=>qs.filter(q=>q.word.tone===t).length);assert.ok(Math.max(...amounts)-Math.min(...amounts)<=1);
  for(const q of qs){assert.equal(q.doors.length,count);assert.equal(new Set(q.doors).size,count);assert.ok(q.doors.includes(q.word.tone));assert.ok(q.doors.every(t=>pool.includes(t)));if(count>2)assert.deepEqual(q.doors,[...q.doors].sort())}
 }}assert.throws(()=>buildChoices(1,6,[1,2]));assert.throws(()=>practiceSession([],[],2));
});
test('new records are separate, save once, and tolerate unavailable or corrupt storage',()=>{
 const data={'two-doors-survival-v1':JSON.stringify({version:1,records:{normal:{best:30}}})};
 globalThis.localStorage={getItem:k=>data[k],setItem:(k,v)=>data[k]=v,removeItem:k=>delete data[k]};
 assert.deepEqual(loadSurvival(),emptySurvival());const p=emptySurvival(),s=newSurvival();for(let i=0;i<100;i++)answer(s);recordSurvival(p,s);recordSurvival(p,s);assert.equal(p.records.normal.runs,1);assert.equal(p.records.normal.wins,1);saveSurvival(p);assert.deepEqual(loadSurvival(),p);assert.ok(data['two-doors-survival-v1']);assert.match(runSummary(s),/Stage 5 \(6 doors\)/);
 data['two-doors-survival-v2']='{';assert.deepEqual(loadSurvival(),emptySurvival());resetProgress();assert.equal(Object.keys(data).length,0);
 globalThis.localStorage={getItem(){throw Error()},setItem(){throw Error()}};assert.deepEqual(loadSurvival(),emptySurvival());assert.equal(saveSurvival(p),false);
});
test('Practice preferences restore legacy choices and validate custom selections',()=>{
 assert.deepEqual(practicePreferences({mode:'focused',pair:[3,6]}),{tones:[3,6],count:2});assert.deepEqual(practicePreferences({mode:'mixed'}),{tones:[1,2,3,4,5,6],count:2});assert.deepEqual(practicePreferences({practice:{tones:[4,2,1],count:3}}),{tones:[1,2,4],count:3});assert.equal(practicePreferences({practice:{tones:[2,4],count:6}}).count,2);
});
