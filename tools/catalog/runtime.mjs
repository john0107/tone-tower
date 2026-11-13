// Cantonese inventory remains a source format; only this common format is published.
export function cantoneseCatalog(source) {
  return {
    version: 2,
    language: 'yue',
    transcriptionSystem: 'jyutping',
    entries: source.words.map((word) => ({
      id: word.id,
      forms: { default: word.character, traditional: word.character },
      gloss: word.gloss,
      dictionarySource: word.dictionarySource,
      glossSource: word.glossSource,
      metadata: word.metadata,
    })),
    pronunciations: source.words.map((word) => ({
      id: word.id,
      entryId: word.id,
      kind: word.syllables.length === 1 ? 'syllable' : 'word',
      syllables: word.syllables.map((s) => ({
        text: s.character,
        transcription: s.jyutping,
        tone: s.tone,
      })),
    })),
    recordings: source.recordings.map((row) => ({
      ...row,
      wordId: undefined,
      anchor: undefined,
      pronunciationId: row.wordId,
      referenceOnly: row.anchor === true,
      realizedTones: source.words
        .find((word) => word.id === row.wordId)
        .syllables.map((s) => s.tone),
    })),
    references: source.recordings
      .filter((row) => row.anchor)
      .map((row) => ({
        tone: source.words.find((word) => word.id === row.wordId).syllables[0].tone,
        recordingId: row.id,
        targetIndex: 0,
      })),
  };
}
