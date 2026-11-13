export const shuffle = (a, r = Math.random) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export function buildChoices(tone, count, pool, random = Math.random, allowed = pool) {
  if (
    !Number.isInteger(count) ||
    count < 2 ||
    new Set(pool).size !== pool.length ||
    !pool.every((t) => allowed.includes(t)) ||
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
  return count === 2
    ? shuffle(choices, random)
    : choices.sort((a, b) => allowed.indexOf(a) - allowed.indexOf(b));
}
