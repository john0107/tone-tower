# Language sites and the Mandarin beta

The root is a language chooser. Cantonese lives at `/cantonese/`; Mandarin lives
at `/mandarin/`. Each has its own guide, practice, About page, and saved progress.
There are no old root-level route aliases.

## Running the prototype

```sh
npm start
```

Open http://127.0.0.1:4173/mandarin/. Both games and practice use real downloaded
speech. The beta trusts source labels and unambiguous CC-CEDICT matches; listening
approval is optional and is not required to play or build.

To include newly downloaded written forms, refresh the pinned dictionary subset:

```sh
npm run mandarin:dictionary
npm run catalog
npm run mandarin:status
```

The default dictionary input is the existing cached CC-CEDICT snapshot. To use
another snapshot, provide `--file path/to/cedict.txt.gz --edition v1` (or an
explicit supported `v2`/`mixed` edition). Its date, edition, source entry lines,
licence, and SHA-256 are retained. A build never fetches a dictionary or changes
versioned source data.

The downloader can continue while developing, matching, correcting, or building.
These commands never rewrite its inventory or MP3s. Keep a matched inventory,
content files, and MP3s together when preparing a committed release.

## Content assumptions and corrections

The beta includes a clip when its source text resolves to one dictionary reading
and its bytes match the downloaded inventory. Equivalent senses with the same
reading do not create a pronunciation ambiguity; ordinary definitions are
preferred over surname/variant-only entries. Unresolved readings, missing matches,
and invalid/missing MP3s stay outside the playable catalog.

Skyrail uses dictionary Pinyin. Tone Tower starts with the same tones and applies
common connected-speech changes: third tone before third tone, 一, and 不.
For example, 你好 remains `ni3 hao3` for spelling and normally has `2 3` listening
answers. Longer third-tone sequences need prosodic grouping, so their uncertain
targets are omitted from tone questions while the words remain usable for
spelling. A shortened third tone is still third tone.

The game provides “Report this recording” links after an answer and in Voices &
credits. They open a GitHub issue form with the language, recording ID, written
form, reading, tone answers, and original source prefilled. The player decides
whether to submit; the app sends no reports itself.

Corrections live in `data/content/cmn/corrections.json`, separately from the
download archive. Each patch requires a reason. Examples:

```sh
# Exclude a wrong or unsuitable clip.
npm run mandarin:correct -- --recording commons-123 --exclude --reason "Wrong word"

# Restore an excluded clip.
npm run mandarin:correct -- --recording commons-123 --restore --reason "Confirmed correct"

# Override the spoken tones without changing dictionary spelling.
npm run mandarin:correct -- --recording commons-123 --tones 2,3 --reason "Corrected tone sequence"

# Resolve an ambiguous dictionary reading by a candidate pronunciation ID.
npm run mandarin:correct -- --recording commons-123 --pronunciation cedict-example --reason "Confirmed reading"

npm run catalog
```

Use real IDs from the catalog or review export. Corrections survive rebuilding,
dictionary preparation, and further downloads. Exclusions trigger reselection of
a tone reference when needed. The app retains a recording's ID, source, speaker
credits, and licence when its exercise annotation changes.

## Shared engine and catalog

Profiles in `src/languages/profiles.js` own tone identities, answer rules,
spelling focuses, exercise capabilities, examples, and input behavior.
`createRun(config, rows, { profile, random })`, controllers, practice setup, and
persistence require an explicit profile. Scoring, timing, playback recovery,
rendering, and animation remain shared.

The root loads no game JavaScript, catalogs, or audio. A language site fetches
only its own catalog. Cantonese keeps its existing browser storage key and IDs;
Mandarin has separate records and settings. Its simplified/traditional toggle
changes presentation without changing pronunciation, timing, or score.

`catalogs/yue.json` and `catalogs/cmn.json` use the common v2 format:
`language`, `transcriptionSystem`, `entries`, `pronunciations`, `recordings`,
and `references`. Entries own sourced forms and meanings; pronunciations own
dictionary syllables; recordings own credited audio and spoken-tone annotations.
A reference identifies a recording and target syllable, preserving neutral-tone
word context. `toneTargets` can restrict eligible listening targets without
removing spelling exercises.

`toneEvidence` distinguishes beta assumptions, explicit corrections, and optional
listening review. Automatically matching a clip never fabricates a human review.
Selection chooses a pronunciation before its recording, preventing additional
speakers from increasing one item's probability.

Pinyin accepts marked or numbered tones, Unicode combining marks, `ü`/`v`/`u:`,
and neutral `0`/`5`. In tone-inclusive answers an unmarked syllable is neutral.
Spaces and apostrophes establish syllable boundaries; plain `u` and `ü` remain
distinct. Input composition completes before checking the answer.

## Coverage and publication

```sh
npm run mandarin:status -- --release
npm run test:all
npm run test:browser
npm run build
npm run check:dist
```

The readiness check requires five tone references (neutral in word context),
coverage of all enabled tones, 20 single-syllable clips covering tones 1–4, and
80 multi-syllable clips. These pools support both complete 100-question games.
It checks the beta's playable coverage, without requiring manual approval.

Only referenced catalog audio is published. Dictionaries, correction registries,
review tooling, unmatched archive clips, and caches stay out of the distribution.
Builds verify audio hashes and leave source data unchanged.

## Optional listening review

The existing `mandarin:review` and `mandarin:import-review` tools remain available
for systematic annotation. Generate the local page with `npm run mandarin:review`
and open
http://127.0.0.1:4173/.audio-import-cache/cmn/pronunciation-review.html.
Review decisions are kept separately in `annotations.json`; confirmed readings
and tones override automatic estimates, and rejected clips are excluded.
This is optional quality improvement, not a beta launch prerequisite.

## Adding another language

Register a profile, sourced content adapter, and guide, then extend the catalog
build and verification language lists. Keep orthography and pronunciation
independent: shared rules support non-Han text and named tone IDs, and do not
require a separate romanization system.

Dictionary: [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict).
Tone reference: [MIT Mandarin tone guide](https://web.mit.edu/~jinzhang/www/pinyin/tones/).
