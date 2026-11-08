export const FREQUENCY_SOURCE = 'https://words.hk/faiman/analysis/existingwordcount.json';

export function addFrequencyMetadata(registry, counts, snapshotSha256, writtenForms = {}) {
  if (
    !counts ||
    typeof counts !== 'object' ||
    Array.isArray(counts) ||
    !Object.keys(counts).length ||
    Object.values(counts).some((count) => !Number.isSafeInteger(count) || count < 0)
  )
    throw Error('Expected a nonempty written-form frequency map with nonnegative integer counts.');
  if (!/^[a-f0-9]{64}$/.test(snapshotSha256)) throw Error('Invalid frequency snapshot checksum.');
  // Competition rank: equal counts share a rank (1, 1, 3). Include every source
  // term, including Latin/numeric terms, rather than silently changing the corpus.
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const ranks = new Map();
  let previous, rank;
  for (let index = 0; index < entries.length; index++) {
    const [form, count] = entries[index];
    if (count !== previous) rank = index + 1;
    previous = count;
    ranks.set(form, rank);
  }
  const result = structuredClone(registry);
  for (const word of result.words) {
    const writtenForm = writtenForms[word.id] ?? word.character;
    word.metadata ||= {};
    const previousFrequency = word.metadata.frequency;
    // Keep independently curated frequency metadata intact.
    if (previousFrequency && previousFrequency.source !== FREQUENCY_SOURCE) continue;
    if (!Object.hasOwn(counts, writtenForm)) {
      delete word.metadata.frequency;
      if (!Object.keys(word.metadata).length) delete word.metadata;
      continue;
    }
    word.metadata.frequency = {
      writtenForm,
      count: counts[writtenForm],
      rank: ranks.get(writtenForm),
      source: FREQUENCY_SOURCE,
      snapshotSha256,
      scope: 'written-form',
    };
  }
  return result;
}

export function withPhoneticMetadata(word) {
  const metadata = { ...word.metadata };
  // Corrections can change spelling. Do not publish an old exact-form match as
  // frequency evidence for the newly corrected form.
  if (
    metadata.frequency?.source === FREQUENCY_SOURCE &&
    metadata.frequency.writtenForm !== word.character
  )
    delete metadata.frequency;
  metadata.phonetics = {
    syllableCount: word.syllables.length,
    tonePattern: word.syllables.map((syllable) => syllable.tone),
  };
  return { ...word, metadata };
}
