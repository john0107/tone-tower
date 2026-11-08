# November 2026 audio expansion

The completed batch added **2,614 Wikimedia Commons recordings**, covering **2,299
new words/readings**. There are 2,541 two-syllable recordings and 73 single-syllable
recordings. Some words have two speakers, and 72 existing words/readings gain
another voice. The queue's 1,098 earlier entries are preserved.

All selected recordings passed import checks. The synchronized collection now
contains **3,864 recordings and 3,269 words/readings**, with no queue entries
remaining and no missing audio files. Corpus metadata matches 3,191 words/readings;
the other 78 have no source match. The audio has not been independently auditioned.

## Start and resume

From the project folder:

```sh
npm run audio:status
npm run audio:download
```

This queue is complete; running the downloader again skips completed entries and
exits. The same command resumes future queue additions.
New vocabulary is ahead of alternate voices. Examples near the beginning include
多謝 (thanks), 學校 (school), 聽日 (tomorrow), 尋日 (yesterday), 咖啡 (coffee),
手機 (mobile phone), and 巴士 (bus).

Press Ctrl+C and wait for the stopped message to pause. Resume with the same
command. After finishing, or after stopping to use a partial batch:

```sh
npm run audio:sync
npm run audio:metadata
```

`audio:metadata` adds only available corpus counts/ranks and mechanically derived
phonetic facts. It does not invent topics or difficulty labels. Run `npm start`
to use the updated collection. See [download instructions](AUDIO-DOWNLOAD.md) for
release checks and [the catalog reference](AUDIO-CATALOG.md) for corrections.

## How the batch was chosen

The selection uses one- or two-character Han filenames from the discovered
Lingua Libre Cantonese recordings. Readings must align one syllable per character.
All parsed CC-Canto and Cantonese reading-supplement entries for the written form
must agree on the reading. Traditional spelling must be unambiguous and a sourced,
standalone English meaning must be available.

Of the selected recordings, **2,491** have a matching written form and Jyutping
reading in Cantonese Wordnet. The other **123** are two-syllable CC-Canto words
with at least five exact written-form occurrences in the corpus, and no conflicting
Wordnet entry for that spelling. Corpus frequency measures written forms; it does
not establish which pronunciation occurs in a text.

Selection prioritizes new vocabulary, a short explicit list of everyday words,
then descending corpus frequency. It selects at most two distinct speakers per
word/reading, counting saved and already queued recordings. Existing review
decisions are retained. Eleven old incomplete-gloss exclusions were recovered
after fixing the parser to preserve slashes inside parenthesized parts of speech.
Their dictionary readings were cross-checked again.

Ambiguous pronunciations, conflicting traditional forms, missing meanings and
insufficiently supported vocabulary remain outside this batch. Longer phrases
and sentence recordings are also outside this selection. Common characters with
several readings need listening review before a filename can establish which
reading the speaker used. Dictionary matching alone is not a pronunciation audit.
Authorship, licence, checksum and audio decoding checks run during import.

## Sources and reproduction

- **Audio:** [Lingua Libre recordings on Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-yue).
  Each imported recording retains its own source page, author and licence.
- **Cantonese readings and meanings:** [CC-Canto and the Cantonese CC-CEDICT reading supplement](https://github.com/amadeusine/cc-canto-data),
  CC BY-SA 3.0. Inline alternative readings are included in ambiguity checks.
- **Supplementary English meanings:** [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict),
  CC BY-SA 4.0. Meanings are joined by traditional spelling, simplified spelling
  and Pinyin, rather than spelling alone.
- **Independent reading cross-check:** [Cantonese Wordnet](https://github.com/lmorgadodacosta/CantoneseWN),
  CC BY 4.0. This uses its public text dataset, not unreleased audio.
- **Written-form counts:** [words.hk corpus word-frequency data](https://words.hk/faiman/analysis/existingwordcount/),
  public-domain counts; separate from the dictionary's licence.

`data/audio/review-queue.json` records the exact source URLs, snapshot SHA-256
checksums and selection criteria in `selectionHistory`. New rows retain their
dictionary filename and line, plus the sources of their reading and meaning.

`npm run audio:select` reads `.audio-import-cache/candidates.json` plus these cached
source files: `cccanto-webdist.txt`, `cccedict-canto-readings.txt`,
`cedict-source.txt.gz`, `cantown-source.xml`, and `word-frequency-source.json`.
The command reports the download URL for a missing snapshot. It appends eligible
entries without fetching audio, and writes `.audio-import-cache/selection-report.json`
with deferred-file reasons. Repeating the command with the same snapshots and
inventory makes no further additions. Source changes require reviewing a new
selection; the prepared queue does not depend on the cache to download.

Generate an optional progress CSV with `npm run audio:export`. Caches, source
snapshots, reports and CSV exports remain ignored by Git.
