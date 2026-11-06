const key='two-doors-v1';
export const empty=()=>({version:1,sessions:0,correct:0,answered:0,confusions:{},mode:'focused',pair:[3,6],recent:[]});
const clean=a=>Array.isArray(a)?a.filter(x=>typeof x==='string'):[];
export function load(){try{const v=JSON.parse(localStorage.getItem(key));if(v?.version===1&&Number.isFinite(v.sessions)&&v.confusions&&['focused','mixed'].includes(v.mode)&&v.pair?.length===2&&v.pair.every(t=>Number.isInteger(t)&&t>=1&&t<=6)&&v.pair[0]!==v.pair[1]){let recent;if(Array.isArray(v.recent))recent=clean(v.recent);else{const preferred=v.format==='words'?'words':'single',other=preferred==='words'?'single':'words';recent=[...clean(v.recent?.[other]),...clean(v.recent?.[preferred])]}const {format,...rest}=v;return{...empty(),...rest,recent:[...new Set(recent.reverse())].reverse().slice(-20)}}}catch{}return empty()}
export function save(v){try{localStorage.setItem(key,JSON.stringify(v));return true}catch{return false}}

const climbKey='two-doors-practice-climb-v1';
export function recordPracticeClimb(state){try{const old=JSON.parse(localStorage.getItem(climbKey)||'{}');localStorage.setItem(climbKey,JSON.stringify({completed:(Number.isSafeInteger(old.completed)?old.completed:0)+1,lastMistakes:state.mistakes}));}catch{}}
const survivalKey='two-doors-survival-v2';
export const emptySurvival=()=>({version:2,difficulty:'normal',recent:[],records:Object.fromEntries(['easy','normal','hard','extreme'].map(d=>[d,{runs:0,wins:0,best:0,fewest:null}]))});
export function loadSurvival(){const base=emptySurvival();try{const v=JSON.parse(localStorage.getItem(survivalKey));if(v?.version!==2)return base;if(Object.hasOwn(base.records,v.difficulty))base.difficulty=v.difficulty;base.recent=clean(v.recent).slice(-20);for(const d of Object.keys(base.records)){const r=v.records?.[d];if(!r)continue;for(const k of ['runs','wins','best'])if(Number.isSafeInteger(r[k])&&r[k]>=0&&(k!=='best'||r[k]<=100))base.records[d][k]=r[k];if(Number.isSafeInteger(r.fewest)&&r.fewest>=0)base.records[d].fewest=r.fewest}return base}catch{return base}}
export function saveSurvival(v){try{localStorage.setItem(survivalKey,JSON.stringify(v));return true}catch{return false}}
export function recordSurvival(progress,state){if(state.recorded||!['won','lost'].includes(state.status))return progress;state.recorded=true;const r=progress.records[state.difficulty];r.runs++;r.best=Math.max(r.best,state.opened);if(state.status==='won'){r.wins++;r.fewest=r.fewest===null?state.mistakes:Math.min(r.fewest,state.mistakes)}return progress}
export function practicePreferences(progress){
  const p=progress.practice,pool=p?.tones;
  if(Array.isArray(pool)&&pool.length>=2&&new Set(pool).size===pool.length&&pool.every(t=>Number.isInteger(t)&&t>=1&&t<=6))return {tones:[...pool].sort((a,b)=>a-b),count:[2,3,4,6].includes(p.count)&&p.count<=pool.length?p.count:2};
  return {tones:progress.mode==='focused'?[...progress.pair]:[1,2,3,4,5,6],count:2};
}
export function resetProgress(){for(const k of [key,'two-doors-survival-v1',survivalKey,climbKey,'two-doors-typed-survival-v1','two-doors-typed-survival-v2'])try{localStorage.removeItem(k)}catch{}}
