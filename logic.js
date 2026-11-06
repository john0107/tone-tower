export const tones=[1,2,3,4,5,6];
export const shuffle=(a,r=Math.random)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
export function normalize(w){return {...w,syllables:w.syllables||[{character:w.character,jyutping:w.jyutping,tone:w.tone}]}}
export function candidates(words,tone,excluded=new Set()){return words.flatMap(raw=>{const w=normalize(raw);if(excluded.has(w.id))return [];return w.syllables.flatMap((s,i)=>s.tone===tone?[{...w,tone:s.tone,targetIndex:i}]:[])})}
export function recordingOptions(words,tone,excluded=new Set(),r=Math.random){const grouped=new Map();for(const c of candidates(words,tone,excluded)){if(!grouped.has(c.id))grouped.set(c.id,[]);grouped.get(c.id).push(c)}return shuffle([...grouped.values()],r).map(group=>group[Math.floor(r()*group.length)])}
export function session(words,mode,pair,r=Math.random,recent=[]){if(mode==='focused'&&(pair[0]===pair[1]||!pair.every(t=>tones.includes(t))))throw Error('Choose two different tones.');const targets=mode==='focused'?shuffle([...Array(5).fill(pair[0]),...Array(5).fill(pair[1])],r):shuffle([...tones,...shuffle(tones,r).slice(0,4)],r);const used=new Set(),chosen=[];function pick(i){if(i===targets.length)return true;const remaining=targets.slice(i);const available=words.filter(w=>!used.has(w.id)&&normalize(w).syllables.some(s=>remaining.includes(s.tone)));if(available.length<remaining.length)return false;for(const tone of new Set(remaining)){if(available.filter(w=>normalize(w).syllables.some(s=>s.tone===tone)).length<remaining.filter(t=>t===tone).length)return false}const options=recordingOptions(words,targets[i],used,r).sort((a,b)=>Number(recent.includes(a.id))-Number(recent.includes(b.id)));for(const w of options){used.add(w.id);chosen[i]=w;if(pick(i+1))return true;used.delete(w.id)}return false}if(!pick(0))throw Error('Not enough distinct recordings for these tones.');return chosen.map((word,i)=>{const tone=targets[i],other=mode==='focused'?pair.find(t=>t!==tone):shuffle(tones.filter(t=>t!==tone),r)[0];return{word,doors:shuffle([tone,other],r),hinted:false,answer:null}})}
export function answer(round,tone){if(round.answer!==null||!round.doors.includes(tone))return false;round.answer=tone;return true}
export function stats(rounds){let streak=0,best=0;const done=rounds.filter(r=>r.answer!==null);for(const r of done){streak=!r.hinted&&r.answer===r.word.tone?streak+1:0;best=Math.max(best,streak)}const unaided=done.filter(r=>!r.hinted);return{correct:done.filter(r=>r.answer===r.word.tone).length,hints:done.filter(r=>r.hinted).length,unaided:unaided.length,unaidedCorrect:unaided.filter(r=>r.answer===r.word.tone).length,best}}
export function recommended(confusions){return Object.entries(confusions).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0].split('-').map(Number)||[3,6]}

export const choiceCounts=[2,3,4,6];
export function buildChoices(tone,count,pool=tones,random=Math.random){
  if(!choiceCounts.includes(count)||new Set(pool).size!==pool.length||!pool.every(t=>tones.includes(t))||!pool.includes(tone)||count>pool.length)throw Error('Choose enough different tones for these doors.');
  const choices=[tone,...shuffle(pool.filter(t=>t!==tone),random).slice(0,count-1)];
  return count===2?shuffle(choices,random):choices.sort((a,b)=>a-b);
}
export function balancedTargets(pool,length,random=Math.random){
  const result=[];while(result.length<length)result.push(...shuffle(pool,random));return result.slice(0,length);
}
// Match target slots to unique recordings. Reassign earlier slots when a
// multi-syllable recording is needed for a less common tone.
export function selectRecordings(words,targets,random=Math.random,recent=[]){
  const options=new Map([...new Set(targets)].map(t=>[t,recordingOptions(words,t,new Set(),random).sort((a,b)=>Number(recent.includes(a.id))-Number(recent.includes(b.id)))]));
  const owners=new Map(),selected=[];
  function assign(slot,seen){for(const word of options.get(targets[slot])){if(seen.has(word.id))continue;seen.add(word.id);const owner=owners.get(word.id);if(owner===undefined||assign(owner,seen)){owners.set(word.id,slot);selected[slot]=word;return true}}return false}
  for(let i=0;i<targets.length;i++)if(!assign(i,new Set()))throw Error('Not enough distinct recordings for these tones.');
  return selected;
}
export function practiceSession(words,pool,count,random=Math.random,recent=[]){
  buildChoices(pool[0],count,pool,random);
  const targets=balancedTargets(pool,10,random);
  return selectRecordings(words,targets,random,recent).map(word=>({word,doors:buildChoices(word.tone,count,pool,random),hinted:false,answer:null}));
}
