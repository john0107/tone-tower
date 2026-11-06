# Downloading and resuming audio

From the project folder, use Node.js 22 or later with FFmpeg and FFprobe on PATH:

```sh
npm run audio:status
npm run audio:download
```

On Windows, double-clicking the root `download-audio.cmd` does the same download. The existing `node download-audio.mjs` command also works. No Codex session is needed: keep the terminal open and the computer awake.

The downloader resumes `data/audio/review-queue.json`, skips recordings already saved with their MP3s, saves each completed import, honors Commons cooldowns, and retries temporary network failures. A cooldown can last several minutes. It stops when the queue is complete. Permanent errors are reported rather than retried indefinitely.

**To stop, press Ctrl+C and wait for the stopped message.** Completed imports are retained. Run the same command to resume. The downloader, direct importer, discovery, and registry synchronization share one operation lock. Stop the current operation before starting another; `audio:status` is read-only and can run at any time.

## Use newly downloaded recordings

After the downloader finishes or stops:

```sh
npm run audio:sync
npm start
```

`audio:sync` explicitly updates the stable word registry. Ordinary catalog generation, development startup, and production builds do not modify versioned metadata. If the registry is out of date, they explain that synchronization is required.

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
- `.audio-import-cache/state.json`: disposable API metadata and the shared Commons cooldown.
- `.audio-import-cache/downloader.log`: download progress log.

Keep the cache to preserve the current cooldown and avoid repeat API requests. Deleting it does not discard completed imports or permanent review decisions. Old cached rejection decisions are migrated into the versioned review file when the importer next runs.

Generate a spreadsheet-friendly progress list with `npm run audio:export`. It writes `.audio-import-cache/download-list.csv`; the export is not a source of truth.

## Other commands

Import downloaded originals without fetching their audio again:

```sh
npm run audio:import -- --source-dir audio-inbox --batch 100
```

Use original Commons filenames or `commons-<pageid>` plus the original extension. Missing local files are skipped. Cached source metadata is reused; missing metadata still requires internet access. Add `--all` to process the remaining local queue, or `--selection path/to/queue.json` to use a different selected queue.

`npm run audio:discover` scans Commons categories into the ignored `.audio-import-cache/candidates.json`. Add `-- --refresh` to rescan. Discovery does not automatically add candidates to the selected queue.

Source, dictionary, and technical checks do not establish pronunciation correctness. Listen to recordings independently when curating them. See [the catalog reference](AUDIO-CATALOG.md) for word corrections and exclusions.
