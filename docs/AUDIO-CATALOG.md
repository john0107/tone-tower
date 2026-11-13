# Audio catalog and internal curation

The app remains a static website. This document describes the Cantonese source inventory; see [Mandarin curation and the shared catalog](MANDARIN-WEBSITE.md) for the language sites and common browser format. Existing recordings are available by default;
players can report recording problems through prefilled GitHub issue links; source corrections remain internal.

## Files and ownership

- `data/audio/content.json`: the downloader's original inventory and source attribution.
  Keep this file and `audio/` so downloads can resume.
- `data/audio/words.json`: the persistent word/readings registry and recording-to-word links.
  Commit it. `npm run audio:sync` appends new words and links without replacing
  existing words or changing their IDs.
- `data/audio/corrections.json`: our manual corrections. The downloader never writes it.
  Commit it. Every correction requires a reason.
- `catalogs/yue.json` and `catalogs/cmn.json`: generated common browser catalogs with
  separate entries, pronunciations, recordings, and tone references. Do not edit it; it is ignored by Git.
- `dist/`: generated website ready to publish. Do not edit it; rebuilding replaces it.

Run `npm run audio:sync` after downloads to update the word registry. Run `npm run catalog` after synchronization or manual corrections to refresh the local catalog.
`npm start` does this automatically before starting the local server. Refresh the
browser to use the updated catalog. A published site keeps its existing snapshot
until we build and publish again.

The selected import queue is `data/audio/review-queue.json`. Durable importer rejection reasons live in `data/audio/import-review.json`, separate from manual gameplay corrections. Raw discovery results, API metadata, cooldowns, logs, and CSV exports live in the ignored `.audio-import-cache/` directory. No review decision depends on keeping that cache.

## Word identities and speakers

The initial grouping uses exact written characters and spaced Jyutping. Different
readings stay separate. Simplified/traditional forms and synonyms are not merged
automatically. The first recording seeds the word ID, which is then persisted in
`data/audio/words.json`; editing a word's spelling or reading does not change its ID.

Recordings retain their original IDs, audio paths and individual attribution.
Saved practice references to recording IDs remain valid. Credits list the
individual recordings. The games retain their tone and stage rules, choose a
word uniformly and then choose one of its eligible recordings. They prefer words
not yet heard and do not reuse a recording during an adventure. If vocabulary
for a required tone is exhausted, another speaker of an already heard word can
be used before any recording repeats.

## Correcting a word

Find the recording ID in `data/audio/content.json` or the word in `data/audio/words.json`. The
`recordingWords` object in `data/audio/words.json` gives the associated word ID. Add a patch
to `data/audio/corrections.json`, for example:

```json
{
  "version": 1,
  "words": {
    "word-si1": {
      "gloss": "poem; poetry",
      "reason": "Clarify the intended meaning"
    }
  },
  "recordings": {}
}
```

This changes the shared word information for all associated recordings. Supported
word fields are `character`, `jyutping`, `gloss`, `syllables`, `dictionarySource`,
`glossSource` and `metadata`. When changing a reading or characters, update its
aligned syllables too. Tone digits must agree with the syllable tones. Update
dictionary attribution when adapting information from another source.

## Sourced metadata

`words.json` stores exact written-form counts and ranks from the public-domain
[words.hk corpus frequency data](https://words.hk/faiman/analysis/existingwordcount/).
Each matched word's `metadata.frequency` records its `writtenForm`, `count`, `rank`,
source URL, source snapshot SHA-256 and `scope: "written-form"`. Ranks use all terms
in the supplied source, including Latin and numeric entries. Ties share competition
rank (for example 1, 1, 3). No frequency value is added for an unmatched spelling.

The source counts occurrences without word segmentation. Single characters may
be counted inside compounds, and homographs share counts across readings. These
are corpus counts, not spoken-language frequencies, pronunciation-specific counts
or learning difficulty labels. Missing matches mean unknown, not rare.

To enrich the synchronized registry, stop downloads and run:

```sh
curl -L --fail https://words.hk/faiman/analysis/existingwordcount.json -o .audio-import-cache/word-frequency-source.json
npm run audio:metadata
npm run catalog
```

The source file stays in the ignored cache; enriched metadata is committed in
`words.json`. Use `npm run audio:metadata -- --frequency-file path/to/source.json`
for a saved snapshot. The update preserves word IDs, recording links, unrelated
metadata and independently sourced frequency metadata. It uses the audio operation
lock and rejects an unsynchronized registry. Repeat it after adding new words.

Catalog generation also derives `metadata.phonetics.syllableCount` and
`metadata.phonetics.tonePattern` from the current aligned syllables, after manual
corrections. These values stay current when a reading is corrected. A spelling
correction suppresses an obsolete frequency match until metadata is refreshed for
that spelling. The metadata command uses corrected spellings for matching without
changing the registry's original labels or stable IDs.

No topic tags, frequency bands or learning levels are inferred. Metadata currently
has no effect on game selection or difficulty; it is available in the published
catalog for later filtering and analysis.

## Correcting one recording

If a clip says a different existing word, add a recording patch pointing to that
word's ID. Its audio, recording ID and source attribution stay intact:

```json
{
  "version": 1,
  "words": {},
  "recordings": {
    "commons-123456": {
      "wordId": "word-example",
      "reason": "This clip says the word identified above"
    }
  }
}
```

The IDs above are illustrative: use real IDs from the registry. If no suitable
word exists, add a complete word entry with a new stable ID to `data/audio/words.json`, then
reference it in the recording patch. A new word needs `id`, `character`,
`jyutping`, `gloss` and aligned `syllables`.

For a confirmed unusable clip, set `excluded: true` and give a reason in its
recording patch. It remains in the imported archive but is omitted from the
generated gameplay catalog and published audio. Remove the exclusion to restore
it. Recording patches also support attribution and audio-path corrections.

Corrections fail validation on unknown IDs, unknown patch fields, broken links,
missing reasons, missing attribution, or inconsistent syllables. They never
modify the downloader's inventory. Keep manual corrections in this file rather
than directly editing imported rows.

## Downloading and publishing

The downloader can keep adding to `data/audio/content.json` while code and corrections are
edited. The catalog builder reads one saved inventory snapshot and never changes versioned metadata. The downloader, direct importer, discovery, and `audio:sync` share an operation lock. Stop the downloader before synchronization, directly repairing its inventory, or changing importer code. Use one catalog build at a time.

Run:

```sh
npm run build
```

This validates the catalog, checks that eligible audio files exist, then creates
`dist/` with the catalog, referenced MP3s, runtime modules, styles, fonts and their
licences. It follows local HTML, JavaScript and CSS dependencies. Downloader
caches, internal curation files, tests, screenshots and browser profiles are not
published. Keep temporary review files outside the repository and delete them after use.

For GitHub, commit the source, `data/audio/content.json`, `data/audio/words.json`, corrections and MP3s.
The included Pages workflow builds and validates `dist/` before deploying it.
Stop downloads/imports before preparing a release, run `npm run audio:sync`, and
commit any registry changes with their matching inventory and MP3s. Builds reject
an unsynchronized registry; CI also checks that building leaves source data unchanged.
See `PUBLISHING.md` for setup. Serving the unbuilt source root will not
work after a fresh clone because `catalogs/` is generated. Hosting setup is a
separate step; the build command does not upload or deploy anything.

For local verification, `npm run test:all` checks catalog corrections, selection,
downloader recovery and the games. After building, `npm run check:dist` checks
every publication asset at root and an arbitrary nested project URL, without
requiring a separately running server. `npm run audio:verify` additionally
decodes the published MP3s using FFmpeg and FFprobe. Technical
validation does not claim independent listening review.
