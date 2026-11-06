# Tone Tower

A browser game for learning and practising Cantonese Jyutping. Tone Tower trains tone recognition; Skyrail trains spelling. Built with vanilla JavaScript and canvas, with no accounts, analytics, or runtime services.

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
  persistence/      Browser progress, settings, and migrations
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
design/             Design references and prototype studies
audio/              Credited speech recordings
assets/             Fonts and their licences
```

The browser imports only `src/`. Pure rules live in `src/game/game-core.js`; `game-controller.js` coordinates input, audio, countdowns, and the game view. Rendering and animation live in `src/world/`. Progress uses the existing `soundbound-cantonese-v1` storage key; migrations remain in `src/persistence/progress.js`.

Recording data stays at the repository root: `content.json` is the imported inventory, `words.json` stores stable word identities, and `audio-corrections.json` stores manual corrections. Candidate inventories, the review queue, and the download CSV support the audio workflow. `catalog.json` and `dist/` are generated and ignored by Git. See [the catalog reference](docs/AUDIO-CATALOG.md) before editing content.

## Checks

```sh
npm test                # Game tests; no FFmpeg required
npm run test:tooling    # Content and tooling tests; FFmpeg + FFprobe required
npm run test:all        # All tests, also run in CI
npm run format:check    # Consistent source formatting
npm run format          # Apply formatting
```

Prettier is a development dependency only. CI installs the locked dependencies, checks formatting, runs all tests, builds the site, and verifies publication paths before deploying passing changes on `main` to GitHub Pages.

## Build and preview

```sh
npm run build
npm run check:dist
npm run preview -- --base /tone-tower/
```

Open http://127.0.0.1:4173/tone-tower/. Publish only `dist/`. The build follows local runtime imports and asset references, includes recording/font credits, and excludes development files. Paths work under a renamed GitHub Pages repository as well as a domain root.

See [publishing](docs/PUBLISHING.md) for setup and release checks. Stop audio downloads before preparing a release; building synchronizes `words.json`, and CI requires registry changes to be committed.

## Reference

- [Games, controls, and visual behavior](docs/GAMEPLAY.md)
- [Audio catalog and manual corrections](docs/AUDIO-CATALOG.md)
- [Downloading recordings](docs/AUDIO-DOWNLOAD.md)
- [Publishing and rollback](docs/PUBLISHING.md)
- [Recording, dictionary, and typography attribution](THIRD_PARTY_NOTICES.md)

Application code is MIT licensed. Recordings, dictionary adaptations, and fonts retain their individual licences. Progress is stored only in the browser; closing or reloading the page ends the current run.
