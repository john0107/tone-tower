# Downloading and resuming audio

From the project folder, use Node.js 22 or later with FFmpeg and FFprobe on PATH:

```sh
npm run audio:status
npm run audio:download
```

Use the same npm command on Windows, macOS and Linux. No Codex session is needed: keep the terminal open and the computer awake.

The downloader resumes `data/audio/review-queue.json`, skips recordings already saved with their MP3s, saves each completed import, honors Commons cooldowns, and retries temporary network failures. A cooldown can last several minutes. It stops when the queue is complete. Permanent errors are reported rather than retried indefinitely.

Requests identify Tone Tower and its project URL. The client maintains separate pacing and cooldowns for the Commons metadata API and the media host. After HTTP 429 or 503, it honors a valid `Retry-After` value, increases request spacing up to 60 seconds, and saves that spacing across restarts. Missing or invalid retry headers use exponential backoff. After sustained successful requests, spacing decreases gradually toward two seconds. Logs identify the host and HTTP status; `audio:status` shows saved spacing and cooldowns. This aims to reduce repeated throttling; faster throughput depends on the server and must be measured.

Saving progress retries temporary `EPERM`, `EACCES` and `EBUSY` rename failures
for up to about 4.6 seconds. This handles brief Windows file locks without deleting
the existing inventory. If a lock persists, the downloader stops with the error;
previously saved imports remain intact and the unsaved item is retried on resume.
Close programs holding the named file open, then run `npm run audio:download`
again. Do not delete `content.json` to work around a save error.

**To stop, press Ctrl+C and wait for the stopped message.** Completed imports are retained. Run the same command to resume. The downloader, direct importer, discovery, and registry synchronization share one operation lock. Stop the current operation before starting another; `audio:status` is read-only and can run at any time.

## Use newly downloaded recordings

After the downloader finishes or stops:

```sh
npm run audio:sync
npm start
```

`audio:sync` explicitly updates the stable word registry. Ordinary catalog generation, development startup, and production builds do not modify versioned metadata. If the registry is out of date, they explain that synchronization is required.

The selected queue is complete when status reports zero remaining. Running
`audio:download` again then skips every completed recording and exits; discovering
more files does not automatically expand the selected queue. After new vocabulary
is selected, the same command resumes it. See the [catalog reference](AUDIO-CATALOG.md)
for refreshing sourced word metadata with `npm run audio:metadata`.

The November expansion adds 2,614 recordings covering 2,299 new words/readings.
See [the batch selection notes](AUDIO-EXPANSION.md) for its sources, criteria,
limitations and expected totals. Start it with the same `npm run audio:download`
command above. After importing, run `npm run audio:sync` followed by
`npm run audio:metadata` to refresh the available factual metadata for the new words.

For a release, run:

```sh
npm run audio:sync
npm run test:all
npm run build
npm run audio:verify
```

Commit `data/audio/` and the matching new MP3s in `audio/` together. Do not commit generated catalogs, publication folders, caches, logs, or CSV exports.

## Saved files

- `data/audio/content.json`: imported recording inventory and credits.
- `data/audio/words.json`: stable word IDs and recording-to-word links.
- `data/audio/corrections.json`: manual corrections, separate from imports.
- `data/audio/review-queue.json`: the selected queue; dictionary matching does not mean independent listening review.
- `data/audio/import-review.json`: permanent rejection reasons. Correct the cause and remove the relevant entry to retry a rejected item.
- `.audio-import-cache/state.json`: disposable API metadata, cooldowns and request pacing.
- `.audio-import-cache/downloader.log`: download progress log.

Keep the cache to preserve the current cooldown and avoid repeat API requests. Deleting it does not discard completed imports or permanent review decisions.

Generate a spreadsheet-friendly progress list with `npm run audio:export`. It writes `.audio-import-cache/download-list.csv`; the export is not a source of truth.

## Other commands

Import downloaded originals without fetching their audio again:

```sh
npm run audio:import -- --source-dir ../audio-originals --batch 100
```

Keep originals outside the repository. Use original Commons filenames or `commons-<pageid>` plus the original extension. Missing local files are skipped. Cached source metadata is reused; missing metadata still requires internet access. Add `--all` to process the remaining local queue, or `--selection path/to/queue.json` to use a different selected queue.

`npm run audio:discover` scans Commons categories into the ignored `.audio-import-cache/candidates.json`. Add `-- --refresh` to rescan. Discovery does not automatically add candidates to the selected queue.

`npm run audio:select` selects an expansion using the cached dictionary, Wordnet
and corpus snapshots described in [the batch selection notes](AUDIO-EXPANSION.md).
It changes the selected queue and writes an ignored selection report; it does not
download audio. Repeating it with the same inputs leaves the queue unchanged.

Source, dictionary, and technical checks do not establish pronunciation correctness. Listen to recordings independently when curating them. See [the catalog reference](AUDIO-CATALOG.md) for word corrections and exclusions.
