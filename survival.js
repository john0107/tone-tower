import {tones, balancedTargets, selectRecordings, buildChoices} from './logic.js';

export const towerRules=Object.freeze({length:100,stageLength:20,choices:[2,3,4,6,6],recoveryInterval:10,questionCount:125,lives:{easy:5,normal:4,hard:3,extreme:1}});
export const livesByDifficulty=towerRules.lives;
export const stageIndex=opened=>Math.min(towerRules.choices.length-1,Math.floor(opened/towerRules.stageLength));
export const doorCount=opened=>towerRules.choices[stageIndex(opened)];
export function survivalQuestions(words,random=Math.random,recent=[]){
  return selectRecordings(words,balancedTargets(tones,towerRules.questionCount,random),random,recent).map(word=>({word,doors:[],answer:null}));
}
export function activateQuestion(state,round,random=Math.random){
  if(!round.doors.length)round.doors=buildChoices(round.word.tone,doorCount(state.opened),tones,random);
  return round;
}
export function newSurvival(difficulty='normal',practice=false){
  const max=livesByDifficulty[difficulty];if(!max)throw Error('Invalid difficulty');
  return {difficulty,practice,max,hearts:practice?null:max,opened:0,attempts:0,mistakes:0,status:'playing',confusions:{},stages:towerRules.choices.map(choices=>({choices,attempts:0,correct:0,mistakes:0}))};
}
export function survivalAnswer(state,round,tone){
  if(state.status!=='playing'||round.answer!==null||!round.doors.includes(tone))return null;
  const stage=state.stages[stageIndex(state.opened)];round.answer=tone;state.attempts++;stage.attempts++;
  if(tone===round.word.tone){
    stage.correct++;state.opened++;let kind='progress',recovered=0;
    if(state.opened===towerRules.length){state.status='won';kind='won'}
    else if(state.opened%towerRules.stageLength===0){kind='landing';recovered=state.practice?0:state.max-state.hearts}
    else if(!state.practice&&state.opened%towerRules.recoveryInterval===0){kind='recovery';recovered=Math.min(1,state.max-state.hearts)}
    if(!state.practice)state.hearts+=recovered;return {correct:true,kind,recovered};
  }
  state.mistakes++;stage.mistakes++;if(!state.practice)state.hearts--;
  const key=[tone,round.word.tone].sort((a,b)=>a-b).join('-');state.confusions[key]=(state.confusions[key]||0)+1;
  if(!state.practice&&!state.hearts)state.status='lost';return {correct:false,kind:state.status==='lost'?'lost':'mistake',recovered:0};
}
export function runSummary(state){
  return ['100-door tower · v2',(state.practice?'Practice climb':state.difficulty)+' · '+state.opened+'/100 floors · '+state.mistakes+' mistakes · '+Math.round(100*state.opened/state.attempts)+'% accuracy',...state.stages.map((s,i)=>s.attempts?'Stage '+(i+1)+' ('+s.choices+' doors): '+s.correct+'/'+s.attempts+' correct, '+s.mistakes+' mistakes':null).filter(Boolean)].join('\n');
}
