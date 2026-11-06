# Download the remaining audio

Double-click `download-audio.cmd`, or run this in PowerShell:

```powershell
cd C:\Users\John\projects\jyutping-trainer
node download-audio.mjs
```

Node.js, FFmpeg and FFprobe must be on PATH (they are installed on this computer). Keep the terminal open and the computer awake. Codex can be closed: this runs independently and uses no AI tokens.

The runner processes the selected queue in batches of up to 100, saves every completed recording with its credits, honors saved rate-limit deadlines, and retries after interruptions. It stops when the queue is finished. Source/dictionary and technical checks do not imply independent listening review.

Press Ctrl+C to stop. Run the same command to resume; completed recordings are skipped. Run only one downloader, and stop it before editing `content.json` or running source discovery/local import.

Progress is in `content.json`, `audio-download-list.csv`, and `.audio-import-cache/state.json`. The terminal log is `.audio-import-cache/downloader.log`. Keep these files and the `audio/` folder. If the computer sleeps, downloads pause until it wakes. No background service or scheduled task is installed.

When done or stopped, tell Codex: **“The downloader is stopped. Check the audio progress and validate the new recordings.”** Everything needed to pick up is saved locally.

Commons may still enforce long pauses. Running locally removes the need to keep the AI waiting; it does not promise a particular download speed.

The downloader still writes only its imported inventory. Run `npm run catalog`
after downloading to update the app's word/recording catalog, or restart with
`npm start`, which rebuilds it automatically. Manual corrections live separately
in `audio-corrections.json` and survive future imports. See `AUDIO-CATALOG.md`.
Run `npm run build` when preparing a new published version; it creates `dist/`.
