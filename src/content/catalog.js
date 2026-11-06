// Adapt the normalized catalog to the recording rows used by the games and credits.
// Recording IDs remain unchanged, including IDs in saved practice history.
export function catalogRows(catalog) {
  if (
    catalog?.version !== 1 ||
    !Array.isArray(catalog.words) ||
    !Array.isArray(catalog.recordings)
  ) {
    throw Error('Unsupported recording catalog.');
  }
  const words = new Map(catalog.words.map((word) => [word.id, word]));
  return catalog.recordings.map((recording) => {
    const word = words.get(recording.wordId);
    if (!word) throw Error('Missing word for recording ' + recording.id);
    return { ...word, ...recording, wordId: word.id, tone: word.syllables[0].tone };
  });
}

export const wordIdentity = (recording) => recording.wordId || recording.id;

// Select a vocabulary item uniformly, then a speaker. The caller first filters
// for the required tone/stage, so additional speakers cannot bias word coverage.
export function chooseWordRecording(recordings, random = Math.random) {
  const groups = new Map();
  for (const recording of recordings) {
    const key = wordIdentity(recording);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(recording);
  }
  if (!groups.size) throw Error('No eligible recordings.');
  const choices = [...groups.values()];
  const group = choices[Math.floor(random() * choices.length)];
  return group[Math.floor(random() * group.length)];
}
