// The browser consumes only the common v2 catalog, never source inventories.
export function validateCatalog(catalog, profile) {
  if (
    catalog?.version !== 2 ||
    catalog.language !== profile.id ||
    catalog.transcriptionSystem !== profile.transcriptionSystem ||
    !['entries', 'pronunciations', 'recordings', 'references'].every((key) =>
      Array.isArray(catalog[key]),
    )
  )
    throw Error('Unsupported language recording catalog.');
  for (const key of ['entries', 'pronunciations', 'recordings']) {
    const ids = catalog[key].map((row) => row.id);
    if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length)
      throw Error('Missing or duplicate catalog identity.');
  }
  return catalog;
}
export function catalogRows(catalog, profile, script = profile.defaultScript) {
  validateCatalog(catalog, profile);
  const entries = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  const pronunciations = new Map(catalog.pronunciations.map((p) => [p.id, p]));
  return catalog.recordings.map((recording) => {
    const pronunciation = pronunciations.get(recording.pronunciationId);
    const entry = entries.get(pronunciation?.entryId);
    if (!pronunciation?.syllables?.length || (pronunciation.entryId && !entry))
      throw Error('Missing pronunciation or entry for ' + recording.id);
    if (
      !Array.isArray(recording.realizedTones) ||
      recording.realizedTones.length !== pronunciation.syllables.length ||
      !recording.realizedTones.every((t) => profile.tones.includes(t))
    )
      throw Error('Missing spoken tone annotations for ' + recording.id);
    const forms = entry?.forms ?? pronunciation.forms ?? {};
    const text = forms[script] ?? forms.default ?? Object.values(forms)[0] ?? '';
    return {
      ...entry,
      ...recording,
      text,
      forms,
      wordId: entry?.id,
      pronunciationId: pronunciation.id,
      anchor: recording.referenceOnly === true,
      transcription: pronunciation.syllables.map((s) => s.transcription).join(' '),
      syllables: pronunciation.syllables.map((s, i) => ({
        ...s,
        text: s.forms?.[script] ?? s.forms?.default ?? s.text ?? '',
        toneEligible: recording.toneTargets?.includes(i) ?? true,
        dictionaryTone: s.tone,
        tone: recording.realizedTones[i],
      })),
      tone: recording.realizedTones[0],
    };
  });
}
export function referenceRows(catalog, rows) {
  return catalog.references.map((reference) => {
    const row = rows.find((row) => row.id === reference.recordingId);
    if (!row || row.syllables[reference.targetIndex]?.tone !== reference.tone)
      throw Error('Invalid tone reference.');
    return { ...row, tone: reference.tone, targetIndex: reference.targetIndex };
  });
}
export const wordIdentity = (recording) =>
  recording.pronunciationId || recording.wordId || recording.id;

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
