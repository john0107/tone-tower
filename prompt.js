export function promptWord(w,escape){
  const syllables=w.syllables.map((s,i)=>{const jyutping=s.jyutping.replace(/[1-6]$/,'');return `<span class="pronunciation-syllable ${i===w.targetIndex?'pronunciation-target':''}">${i===w.targetIndex?'<span class="target-label">Listen here</span>':''}<span class="prompt-character">${escape(s.character)}</span><span>${escape(jyutping)}</span></span>`}).join('');
  return `<div class="pronunciation">${syllables}</div><p class="prompt-gloss">${escape(w.gloss)}</p>`;
}
