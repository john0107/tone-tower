export const tones = [1, 2, 3, 4, 5, 6];
export const shuffle = (a, r = Math.random) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export function normalize(w) {
  return {
    ...w,
    syllables: w.syllables || [{ character: w.character, jyutping: w.jyutping, tone: w.tone }],
  };
}

export const choiceCounts = [2, 3, 4, 6];
export function buildChoices(tone, count, pool = tones, random = Math.random) {
  if (
    !choiceCounts.includes(count) ||
    new Set(pool).size !== pool.length ||
    !pool.every((t) => tones.includes(t)) ||
    !pool.includes(tone) ||
    count > pool.length
  )
    throw Error('Choose enough different tones for these doors.');
  const choices = [
    tone,
    ...shuffle(
      pool.filter((t) => t !== tone),
      random,
    ).slice(0, count - 1),
  ];
  return count === 2 ? shuffle(choices, random) : choices.sort((a, b) => a - b);
}
