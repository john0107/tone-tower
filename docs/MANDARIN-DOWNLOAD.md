# Downloading Mandarin recordings

From the project folder, run:

```sh
npm run audio:download:mandarin
```

This discovers, downloads and validates a separate Mandarin audio archive. Run the
same command to resume; completed files are checked and skipped. Keep the terminal
open and the computer awake. No Codex session is needed. Press **Ctrl+C** and wait
for the stopped message to stop safely.

Node.js 22 or later, FFmpeg and FFprobe must be on PATH, as for the Cantonese
downloader. The script checks FFmpeg/FFprobe before accessing the source. The npm
command works on Windows, macOS and Linux.

For a smaller batch, or to check progress in another terminal:

```sh
npm run audio:download:mandarin -- --limit 20
npm run audio:status:mandarin
```

`--limit 20` saves up to twenty successful downloads/repairs in that run, in
addition to any files already saved. Discovery still scans the source category
first. Status is read-only and checks MP3 sizes and SHA-256 hashes; it does not
make network requests or decode every recording again.

## What is selected

The initial source is Commons'
[Mandarin Lingua Libre category](https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-cmn).
Selection keeps recognized Mandarin filenames whose text consists of one to four
Han characters. This includes short words, names and expressions; it does not
claim that every selected clip is common vocabulary, one dictionary word or an
HSK item. Longer phrases, numeric/Latin labels and ambiguous language categories
are left out of this first collection.

Discovery found 4,108 source files and 3,692 matching candidates in the live trial
on 13 November 2026. Counts can change. Per-file inspection may send additional
candidates to review, so the final number downloaded may be lower.

The queue alternates between filename speaker groups, so a small batch can
include different speakers early. Actual speaker identities come from the file's
creator credits, using Lingua Libre identity links where available. Unlinked
speaker names and missing identities are retained without guessing from the
uploader or merging people with similar names.

Only source files with a recognized CC0 1.0, CC BY 4.0 or CC BY-SA 4.0 licence and
creator attribution are accepted. The exact label and licence URL must agree.
Source deletion/disputed-permission templates detected during inspection are
routed to review. Each inventory row preserves the selected licence, original
licence evidence, creator credits, speaker/recorder claims, uploader, source page,
file URL, source timestamp and checksums. The original licence evidence may
contain alternative licence information; the downloader uses the explicit
selected licence returned by Commons, rather than guessing additional grants.

The original is checked against Commons' SHA-1 and file size. Suitable MP3
originals are preserved; other supported audio formats are converted with
FFmpeg. The resulting MP3 must decode successfully and be longer than 0.1 seconds
and shorter than 10 seconds. Conversion notes and original/MP3 SHA-256 hashes are
retained. These checks establish file integrity, not pronunciation accuracy.

## Saved files

| Location                                     | Purpose                                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `data/audio/collections/cmn/sources.json`    | Versioned source and selection policy                                                               |
| `data/audio/collections/cmn/recordings.json` | Durable inventory, source evidence, speaker links and file hashes; created after the first download |
| `data/audio/collections/cmn/review.json`     | Durable reasons a candidate needs review; created when needed                                       |
| `audio/cmn/commons-<pageid>.mp3`             | Validated downloaded audio                                                                          |
| `.audio-import-cache/cmn/discovery.json`     | Resumable source listing                                                                            |
| `.audio-import-cache/cmn/metadata.json`      | Cached file metadata and source templates                                                           |
| `.audio-import-cache/cmn/originals/`         | Original source audio, keyed by recording ID and source checksum                                    |
| `.audio-import-cache/state.json`             | Commons host pacing/cooldowns, shared with Cantonese downloads                                      |

Speakers are embedded in each recording's evidence for now, with stable
source-linked IDs where available. This keeps each completed download and its
credits in one atomic inventory update. Separate vocabulary, pronunciation and
HSK registries can be added when we curate the archive. Unknown annotations stay
absent; the downloader never invents a Pinyin reading or meaning.

Commit the Mandarin inventory, source policy, any review decisions and matching
MP3s together when keeping the archive in Git. Originals and discovery/API caches
are ignored. Preserve the inventory even if removing caches: it pins the source
version used for each recording and contains the attribution needed for reuse.
Never delete `recordings.json` to fix a filesystem save error.

## Resuming, repair and review

The downloader saves each recording before moving on. Missing or corrupted MP3s
are repaired from the pinned original, using the original cache if it is valid.
Deleting that cache does not delete the MP3 archive, but a repair may then need
internet access. If upstream bytes have changed, checksum validation prevents
silently substituting the newer recording; that item needs review. A valid saved
recording is not automatically replaced when a source is refreshed.

To find newly uploaded files and refresh metadata for pending candidates:

```sh
npm run audio:download:mandarin -- --refresh
```

Review items are skipped on ordinary runs. After investigating their reasons,
retry them with fresh source metadata:

```sh
npm run audio:download:mandarin -- --retry-review
```

The flags can be combined with `--limit`. A successfully retried recording clears
its download review entry. These entries are download/source checks, not the
future pronunciation annotations or listening-review decisions.

Transport errors and temporary server errors receive bounded retries. Commons
429/503 responses use the shared client's persisted pacing and Retry-After
handling. After persistent network or filesystem failure, the command exits with
the error; rerun it to resume. A missing original, unaccepted licence, source
checksum mismatch or undecodable clip is recorded for review, allowing other
candidates to continue. Temporary Windows file locks use the same atomic rename
retry as existing metadata writes.

The Mandarin and Cantonese tools share an operation lock and host cooldowns. Run
only one downloading, importing, discovery or synchronization operation at a time.
Both status commands can run while a downloader is working.

## Effect on Cantonese and the game

**No Cantonese migration is required to download Mandarin audio.** Existing
recordings remain under their current paths, with their word IDs, inventory,
corrections and progress unchanged. `npm run audio:download` remains the Cantonese
command; `npm run audio:download:mandarin` uses its own archive.

There is no need to run `audio:sync` after a Mandarin download: that command
belongs to the current Cantonese catalog. The Mandarin beta uses downloaded clips with unambiguous dictionary matches, applies common tone changes, and keeps corrections separately. Run `npm run mandarin:dictionary` and `npm run catalog` to include newly downloaded written forms. Manual listening approval is optional. See [the Mandarin beta workflow](MANDARIN-WEBSITE.md).
