# Tone Tower

Browser games for Cantonese Jyutping and Mandarin Pinyin. Each language has its own site and progress. Tone Tower trains tone recognition; Skyrail trains spelling. Built with vanilla JavaScript and canvas, with no accounts, analytics, or runtime services.

[Play Tone Tower](https://tone-tower.github.io/tone-tower/) · [Report a problem](https://github.com/tone-tower/tone-tower/issues/new?template=bug-report.yml) · [Suggest an idea](https://github.com/tone-tower/tone-tower/issues/new?template=idea.yml)

Maintained by [john0107](https://github.com/john0107). Feedback and contributions are welcome through GitHub Issues; reports are public.

## Development

Use Node.js 22 or later.

```sh
npm ci
npm start
```

Open http://127.0.0.1:4173. Starting the development server generates the recording catalog first.

## Project structure

```text
src/
  app.js            Application entry point and navigation
  audio/            Browser playback
  content/          Runtime catalog adapters
  game/             Game rules and input/playback controller
  persistence/      Browser progress and settings
  styles/           Application and game styles
  ui/               Settings, guide, credits, and map controls
  world/            Canvas rendering and animation

tests/
  game/             Game, controller, rendering, and progress tests
  tooling/          Content, catalog, audio-import, and publishing tests

tools/
  audio/            Discovery, import, download, and validation
  catalog/          Catalog assembly and word registry synchronization
  publishing/       Static site build and distribution checks
  server/           Local development and publication preview server

docs/               Gameplay, audio workflow, and publishing reference
audio/              Credited speech recordings
assets/             Fonts and their licences
data/audio/         Imported inventory, stable word IDs, queue, and corrections
```

The browser imports only `src/`. Pure rules live in `src/game/game-core.js`; `game-controller.js` coordinates input, audio, countdowns, and the game view. Rendering and animation live in `src/world/`. Progress and settings live in `src/persistence/progress.js`. Only the current save format is supported; older formats start fresh.

Versioned recording metadata lives in `data/audio/`: `content.json` is the imported inventory, `words.json` stores stable word identities, and `corrections.json` stores manual corrections. The selected queue and durable rejection reasons are versioned alongside them. API caches, raw discovery results, and CSV exports stay in the ignored `.audio-import-cache/` directory. `catalogs/` and `dist/` are generated and ignored by Git. See [the catalog reference](docs/AUDIO-CATALOG.md) before editing content.

Keep only current source, assets, content and documentation in the repository. Use the operating system's temporary directory for browser profiles, screenshots and one-off scripts, then delete them after review. Remove superseded implementations and assets instead of adding ignore rules or compatibility layers. Deleting tracked files removes them from future commits; it does not shrink existing Git history.

To resume downloads, run `npm run audio:download`. After downloading stops, run `npm run audio:sync` before playing or building. `npm run audio:status` shows progress without starting downloads. See [the download instructions](docs/AUDIO-DOWNLOAD.md).

Download the separate Mandarin archive with `npm run audio:download:mandarin`;
check it with `npm run audio:status:mandarin`. It resumes safely and preserves
source credits across speakers. The playable Mandarin beta uses unambiguous dictionary matches and common tone changes; incorrect clips can be corrected or excluded afterward. Existing Cantonese recordings do not need to
move. See [the Mandarin download instructions](docs/MANDARIN-DOWNLOAD.md).

The root is a language chooser. Open `/cantonese/` or `/mandarin/` for the independent language sites. The Mandarin beta includes Tone Tower, Skyrail, practice, and a Pinyin guide using real downloaded audio. See [language architecture and Mandarin beta](docs/MANDARIN-WEBSITE.md) for the content workflow and future language integration.

## Checks

```sh
npm test                # Game tests; no FFmpeg required
npm run test:tooling    # Content and tooling tests; FFmpeg + FFprobe required
npm run test:all        # Game + tooling tests, also run in CI
npm run test:browser    # Optional desktop + phone browser smoke checks
npm run format:check    # Consistent source formatting
npm run format          # Apply formatting
```

Prettier is a development dependency only. CI installs the locked dependencies, checks formatting, runs all tests, builds the site, and verifies publication paths before deploying passing changes on `main` to GitHub Pages.

For the browser smoke suite, install Chromium once with `npx playwright install chromium`, then run `npm run test:browser` before a release or after changing game controls or layout. It starts its own server and checks desktop (1280 × 800), phone (390 × 844) and small phone (360 × 640) layouts, including reduced viewport space for a phone keyboard. Tests use a small fixture catalog and simulated playback so downloads and speakers do not affect the results. Failure screenshots and traces go to `tone-tower-browser-results` in the operating system’s temporary directory. Use `npm run test:browser -- --project=phone --headed` to watch a run.

These checks cover the main flows and layout regressions. A quick real-phone check of audio and the on-screen keyboard is still useful before publishing; viewport emulation cannot reproduce every mobile browser behavior. Browser checks stay separate from the fast game tests and existing CI workflow.

## Build and preview

```sh
npm run build
npm run check:dist
npm run preview -- --base /tone-tower/
```

Open http://127.0.0.1:4173/tone-tower/. Publish only `dist/`. The build follows local runtime imports and asset references, includes recording/font credits, and excludes development files. Paths work under a renamed GitHub Pages repository as well as a domain root.

See [publishing](docs/PUBLISHING.md) for setup and release checks. Stop audio downloads before preparing a release, run `npm run audio:sync`, and commit the matching metadata and MP3s. Ordinary builds validate the registry and leave versioned metadata unchanged.

## Reference

- [Games, controls, and visual behavior](docs/GAMEPLAY.md)
- [Audio catalog and manual corrections](docs/AUDIO-CATALOG.md)
- [Downloading recordings](docs/AUDIO-DOWNLOAD.md)
- [Language architecture and Mandarin beta](docs/MANDARIN-WEBSITE.md)
- [Downloading the separate Mandarin archive](docs/MANDARIN-DOWNLOAD.md)
- [Mandarin sources and multilingual audio design](docs/MULTILINGUAL-AUDIO.md)
- [Publishing and rollback](docs/PUBLISHING.md)
- [Recording, dictionary, and typography attribution](THIRD_PARTY_NOTICES.md)

Application code is MIT licensed. Recordings, dictionary adaptations, and fonts retain their individual licences. Progress is stored only in the browser; closing or reloading the page ends the current run.
