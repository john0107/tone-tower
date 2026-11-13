// Beta assumptions are explicit and can be overridden without altering the archive.
// Dictionary spelling stays unchanged; these are estimated tones in connected speech.
export function estimateMandarinTones(pronunciation, entry) {
  const syllables = pronunciation.syllables;
  const dictionary = syllables.map((s) => s.tone);
  const realizedTones = [...dictionary];
  const toneTargets = [];
  const text = [...(entry.forms.simplified ?? entry.forms.default)];
  for (let i = 0; i < syllables.length; i++) {
    const base = syllables[i].transcription.replace(/[1-5]$/, '');
    if (dictionary[i] === 3 && dictionary[i + 1] === 3) realizedTones[i] = 2;
    if (
      text[i] === '一' &&
      base === 'yi' &&
      dictionary[i] === 1 &&
      i + 1 < syllables.length &&
      text[i - 1] !== '第'
    )
      realizedTones[i] = dictionary[i + 1] === 4 ? 2 : dictionary[i + 1] === 5 ? 1 : 4;
    if (text[i] === '不' && base === 'bu' && dictionary[i] === 4 && dictionary[i + 1] === 4)
      realizedTones[i] = 2;
    let first = i,
      last = i;
    if (dictionary[i] === 3) {
      while (dictionary[first - 1] === 3) first--;
      while (dictionary[last + 1] === 3) last++;
    }
    // Longer third-tone sequences depend on grouping, absent from this dictionary edition.
    if (dictionary[i] !== 3 || last - first < 2 || i === last) toneTargets.push(i);
  }
  return { realizedTones, toneTargets };
}

export function uniqueReading(candidates) {
  const readings = new Map();
  for (const candidate of candidates) {
    const signature = candidate.syllables.map((s) => s.transcription.toLowerCase()).join(' ');
    const previous = readings.get(signature);
    const secondary = (value) =>
      /^(?:surname\b|variant of\b|old variant of\b)/i.test(value.gloss ?? '');
    if (!previous || (secondary(previous) && !secondary(candidate)))
      readings.set(signature, candidate);
  }
  return readings.size === 1 ? [...readings.values()][0] : null;
}

export function displayMandarinGloss(gloss) {
  // Dictionary cross-references contain Pinyin, which must not reveal typing answers.
  const summary = String(gloss)
    .replace(/\[[^\]]*\]/g, '')
    .split(/;\s*/)
    .slice(0, 2)
    .join('; ')
    .replace(/\s+/g, ' ')
    .trim();
  return summary.length <= 160 ? summary : summary.slice(0, 157).replace(/\s+\S*$/, '') + '…';
}

export function chooseBetaReferences(catalog) {
  const selected = new Set(catalog.references.map((r) => r.tone));
  const pronunciations = new Map(catalog.pronunciations.map((p) => [p.id, p]));
  const entries = new Map(catalog.entries.map((e) => [e.id, e]));
  const preferred = ['妈', '麻', '马', '骂', '妈妈', '你', '好', '是', '的', '我们', '孩子'];
  const rank = (recording) => {
    const p = pronunciations.get(recording.pronunciationId),
      e = entries.get(p.entryId);
    const index = preferred.indexOf(e.forms.simplified);
    return (index < 0 ? 100 : index) + p.syllables.length;
  };
  const recordings = [...catalog.recordings].sort(
    (a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id),
  );
  for (const tone of [1, 2, 3, 4, 5]) {
    if (selected.has(tone)) continue;
    for (const recording of recordings) {
      const pronunciation = pronunciations.get(recording.pronunciationId);
      if (tone === 5 ? pronunciation.syllables.length < 2 : pronunciation.syllables.length !== 1)
        continue;
      const targetIndex = recording.realizedTones.findIndex(
        (t, i) => t === tone && (recording.toneTargets?.includes(i) ?? true),
      );
      if (targetIndex < 0) continue;
      catalog.references.push({ tone, recordingId: recording.id, targetIndex });
      break;
    }
  }
}
