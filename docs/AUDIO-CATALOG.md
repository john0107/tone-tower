# Audio catalog and internal curation

The app remains a static website. Existing recordings are available by default;
there is no player-facing review or reporting workflow.

## Files and ownership

- `content.json`: the downloader's original inventory and source attribution.
  Keep this file and `audio/` so downloads can resume.
- `words.json`: the persistent word/readings registry and recording-to-word links.
  Commit it. The catalog builder appends new words and links without replacing
  existing words or changing their IDs.
- `audio-corrections.json`: our manual corrections. The downloader never writes it.
  Commit it. Every correction requires a reason.
- `catalog.json`: generated, compact browser catalog with separate word and
  recording collections. Do not edit it; it is ignored by Git.
- `dist/`: generated website ready to publish. Do not edit it; rebuilding replaces it.

Run `npm run catalog` after downloads or corrections to refresh the local catalog.
`npm start` does this automatically before starting the local server. Refresh the
browser to use the updated catalog. A published site keeps its existing snapshot
until we build and publish again.

## Word identities and speakers

The initial grouping uses exact written characters and spaced Jyutping. Different
readings stay separate. Simplified/traditional forms and synonyms are not merged
automatically. The first recording seeds the word ID, which is then persisted in
`words.json`; editing a word's spelling or reading does not change its ID.

Recordings retain their original IDs, audio paths and individual attribution.
Saved practice references to recording IDs remain valid. Credits list the
individual recordings. The games retain their tone and stage rules, choose a
word uniformly and then choose one of its eligible recordings. They prefer words
not yet heard and do not reuse a recording during an adventure. If vocabulary
for a required tone is exhausted, another speaker of an already heard word can
be used before any recording repeats.

## Correcting a word

Find the recording ID in `content.json` or the word in `words.json`. The
`recordingWords` object in `words.json` gives the associated word ID. Add a patch
to `audio-corrections.json`, for example:

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

For optional future classification, a word can have metadata such as:

```json
{
  "tags": ["greeting"],
  "frequency": { "band": "common", "source": "name of reference" },
  "learningLevel": "beginner"
}
```

Metadata is optional and has no effect on current difficulty. Missing values mean
unclassified, not easy or rare. Frequency and learning level remain independent.

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
word exists, add a complete word entry with a new stable ID to `words.json`, then
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

The downloader can keep adding to `content.json` while code and corrections are
edited. The catalog builder reads one saved inventory snapshot. Use one catalog
build at a time. Stop the downloader before directly repairing its inventory,
changing importer code, or running another import/discovery process.

Run:

```sh
npm run build
```

This validates the catalog, checks that eligible audio files exist, then creates
`dist/` with the catalog, referenced MP3s, runtime modules, styles, fonts and their
licences. It follows local HTML, JavaScript and CSS dependencies. Downloader
caches, internal curation files, tests, screenshots and browser profiles are not
published. `.preview/` is also ignored by Git.

For GitHub, commit the source, `content.json`, `words.json`, corrections and MP3s.
The included Pages workflow builds and validates `dist/` before deploying it.
Stop downloads/imports before preparing a release, run `npm run catalog`, and
commit any registry changes; CI rejects a build that changes `words.json`.
See `PUBLISHING.md` for setup. Serving the unbuilt source root will not
work after a fresh clone because `catalog.json` is generated. Hosting setup is a
separate step; the build command does not upload or deploy anything.

For local verification, `npm run test:all` checks catalog corrections, selection,
downloader recovery and the games. After building, `npm run check:dist` checks
every publication asset at root and an arbitrary nested project URL, without
requiring a separately running server. `npm run audio:verify` additionally
decodes the published MP3s using FFmpeg and FFprobe. Technical
validation does not claim independent listening review.
