# Tone Tower

A little world for learning and practising Cantonese Jyutping, built with vanilla JavaScript and a shared, code-drawn pixel world. No account, analytics, or runtime service is required. A small local script assembles the recording catalog and prepares publishing files.

## Run locally

Use Node.js 22 or later. Run `npm start` and open http://127.0.0.1:4173. `npm start` refreshes the catalog first. For an isolated preview, run `npm run catalog`, then `node server.mjs 4174`. Run `npm test` for the complete game, migration, controller, content and audio-tool checks.

## The adventures

**Tone Tower** is an untimed, 100-floor listening challenge. Five pixel-art districts increase the choices from 2 to 3 to 4 to 6. Each correct answer lights a floor; the explorer enters the door before the camera climbs into the next room. Replays, mistakes and replacement recordings stay on the same floor. Easy, Normal, Hard and Extreme start with 5, 4, 3 and 1 lives. Mistakes reveal a bright, check-marked correct door and a small dust creature behind your choice, with a recoiling explorer and a breaking heart. Continue gives a new word on the same floor. Recover a life at intermediate ten-floor milestones and refill at twenty-floor landings.

**Skyrail** is one continuous, 100-span typing journey. Spell the recording to build the bridge before the car reaches the gap. Easy, Normal, Hard and Extreme start with the same 5, 4, 3 and 1 lives as Tone Tower, independently of Spelling or Full Jyutping. Both variants start at 15 seconds; stage deadlines are 15, 13, 11, 9 and 7 seconds. Full Jyutping requires tone digits. Begin with single syllables, then highlighted syllables, then whole words. Wrong spelling is free. Timeout costs one life, makes the car fall, and waits for review; Continue brings a rescue and a new recording without awarding a span. Recovery matches Tone Tower.

The camera and repaired track persist between recordings. Five stretches grow from cliffside houses and hanging gardens into copper cranes, cloudline pavilions and monumental gateways. The car upgrades at twenty-span checkpoints. Lives float above the car and the countdown appears on a trackside signal; numeric progress appears at checkpoints. The authoritative countdown begins after audio finishes, and replay never resets it. Correct answers allow a smooth 900ms crossing before the next recording. A missed car coasts until its rear wheel has passed the unsupported edge, then falls and is met by a rescue lantern. District stations remain in world space after departure. The input and scene stay mounted, including through audio recovery.

Each challenge variant has independent records. Adventures keep their animated ending, final word, summary and retry/map actions in the same mounted game view. Victories open into a lantern-filled summit or moonlit final station; defeats finish with a recovery scene. There is no second results page or ending replay. Runs are not saved when closing or reloading the page.

## Practice and help

Practice is a tab inside each game’s existing settings panel. Tone Tower lets you select a tone pair or a larger tone set and 2, 3, 4 or 6 answer choices. Skyrail offers initials only, finals only or full spelling, with optional tone numbers, defaulting to whole words with a Single syllable only checkbox beneath Include tone numbers. Sessions default to 20 questions, counting incorrect submissions as well as correct ones, with 10, 50 and Unlimited also available. Practice stays at the selected difficulty and uses the starting game scene, with no timer or lives. There is no separate Workshop page or building. Practice results never affect game records.

The home page introduces Jyutping as initial + final + tone with the example f + u + 2 = fu2 and a playable Hear fu2 button. The two enlarged map destinations are balanced on either side of the scene. Two main mode cards introduce Tone Tower and Skyrail. Game settings, Start and the smaller practice action sit beside the compact map on desktop and above it on mobile. The shared settings frame reserves space for Skyrail’s extra controls, keeping its dimensions stable when switching games. The Jyutping guide (`#sounds`) is a bookmarkable introduction to initials, finals and tones, with six playable tone references, real word examples and answer formats. About (`#about`) explains the games, recording sources and browser-local records. Page navigation supports browser back/forward and direct links. During a run, Jyutping guide and About open as dialogs over the paused game; closing them resumes the same run. The compact in-game guide is shared with the same reference recordings. Ambient animation and persistent in-scene endings are included; reduced-motion settings receive stationary alternatives.

The guide starts with an introduction and worked syllable, then distinguishes learning the notation for familiar Cantonese sounds from learning pronunciation and spelling together. Separate sections cover all 19 initials, representative final structures and the six tones. Real recordings illustrate aspiration, and the saam1/sam1 vowel comparison links to Jyutping.org’s audio examples; fuller pronunciation lessons are linked beside each topic. An optional, cited note explains the influence of prior language experience without ranking language groups by difficulty. Resources are labelled by teaching language, purpose and assumed knowledge, including TypeDuck’s Cantonese-narrated video. Game and practice links follow the references. The in-game reference shares the same tone examples and resource links. About describes the exercises, their role alongside pronunciation study, recording sources and local storage. See `design/jyutping-guide-research.md` for source notes.

## Controls

- World map: left/right or up/down arrows select Tone Tower and Skyrail; Enter starts the selected mode. Home/End select the first/last mode. Shortcuts respect form controls and open dialogs. Destination walking and the Tower entrance are decorative and never delay Start or the first recording.

- Tone Tower: choose a door by click/tap or 1–6. With two doors, use left/right. With three, up/down chooses the middle. Four doors form a compass: up, left, right, down. R or Space replays. The question is displayed on its own opaque panel; scene artwork stays mounted during review.
- Skyrail: type in one field; spaces between syllables are welcome. Complete correct answers advance automatically. Enter builds; R or Space replays even from the answer field (IME and modifier shortcuts are respected). Spaced answers are still accepted when pasted. Wrong partial typing is harmless.
- Enter continues after review or a landing. Escape pauses or resumes. Returning from a hidden tab requires Resume.
- Audio errors stop the clock and offer retry or an unscored replacement.

## Progress and architecture

Progress is stored locally under `soundbound-cantonese-v1` using schema 3. Current Tower and difficulty-specific Skyrail records, settings and Workshop history are preserved. Retired Classic typing, Earlier Skyrail and prototype archives are discarded. Reset clears all generations. Blocked browser storage does not prevent play.

- `game-core.js` defines the language adapter, challenge registry and pure run rules.
- `game-controller.js` owns input, playback coordination, countdown and controller lifecycle.
- `pixel-world.js` draws the connected map, tower interiors and workshop on one pixel grid. `skyrail-world.js` draws the continuous route, and `rail-journey.js` keeps its camera and repair history between recordings. `tower-journey.js` preserves the climb between rooms and through door-count changes. `tower-details.js` draws the grouped gauge, doorway creature, hearts and rest landing. `world-runtime.js` handles animation lifecycle; `world-motion.js` maps controller outcomes to animation. `worlds.js` / `worlds.css` provide accessible scene markup and the focused gameplay layout.
- `app.js` supplies navigation, inline practice entry, learning, credits and results. `map-navigation.js` scopes home arrow/Enter shortcuts and leaves native form controls alone. `progress.js` handles records and migration.

The language and challenge boundaries allow future modes and Mandarin content without making the shared world assume towers or six tones. Only Cantonese is included today.

## Static hosting / GitHub Pages

The GitHub Actions workflow tests and builds pull requests, then deploys passing changes on `main` to GitHub Pages. It publishes only `dist/`, never the source directory. No npm dependencies, deployment tokens or separate publishing branch are needed.

See [PUBLISHING.md](PUBLISHING.md) for the one-time GitHub setup, local release checks, phone/browser checklist, updates and rollback. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for recording, dictionary and font attribution.

```sh
npm test
npm run build
npm run check:dist
npm run preview -- --base /tone-tower/
```

Open http://127.0.0.1:4173/tone-tower/ to preview the actual publication folder. Paths work under any repository name. The display name can change without changing the existing browser-storage keys.

## Audio and content

`content.json` is the downloader's imported inventory. `words.json` maintains stable word/readings identities and links to individual recordings; `audio-corrections.json` holds internal corrections separately. The app loads generated `catalog.json`. Run `npm run catalog` to incorporate downloads and corrections; `npm start` does this automatically. Future word categories can live in optional metadata without changing current game difficulty. See `AUDIO-CATALOG.md` for examples.

`content.json` records the source page, author, licence and MP3 conversion credit for every sound. The Audio & credits dialog exposes those records. Recordings are human speech from Wikimedia Commons and retain their individual licences; application code is MIT. Tone shapes are teaching schematics, not measured pitch traces. English glosses identify the intended word, rather than every possible meaning of a syllable. Regional and lexical readings can differ.

`tools-audio.mjs` documents the selected words and retrieves recording metadata and files. It requires internet access, resumes from the manifest, and spaces requests. The bundled pack includes Wikimedia MP3 derivatives and locally converted originals. `node tools-verify.mjs` checks decoding with FFprobe and checks root/subdirectory serving while the local server runs. It is a development tool, not used by the deployed game. Review pronunciation against the intended word before extending the pack; do not generate new entries by substituting tone digits.

No analytics or accounts. Local progress includes completed-session totals, confusion counts, and your last mode/pair. Browser storage can be cleared or unavailable; the game still runs.

`node tools-discover.mjs` saves a resumable candidate inventory; add `--refresh` to scan the categories again. Run discovery and importing separately so they share the cached Commons retry deadline safely. `audio-review-queue.json` contains dictionary-matched candidates and recorded exclusions; matching does not imply an independent listening review. Run `node tools-import-curated.mjs --batch 100` for the next batch, or add `--all` to process the full queue in batches of at most 100. Metadata and retry deadlines are cached in `.audio-import-cache/`, and each successful import is saved immediately. Run `node tools-import-curated.mjs --export-only` to refresh `audio-download-list.csv`. To import locally downloaded originals instead, place them in `audio-inbox/` with their Commons filenames (or `commons-<pageid>` plus the original extension), then run `node tools-import-curated.mjs --source-dir audio-inbox --batch 100`. Missing local files are skipped. FFmpeg and FFprobe are required for conversion and validation.

Some readings and glosses are adapted from [CC-Canto](https://github.com/amadeusine/cc-canto-data), copyright © 2015–2016 Pleco Software Incorporated, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Adapted entries are identified by `dictionarySource` in the manifest and selection.

Some glosses were checked and adapted with reference to [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict), published by MDBG and licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). These entries identify that source in `glossSource`.

Recording credits are searchable and paginated (20 rows per page), with dictionary and typography credits available in an expandable section.


## World and focused gameplay

The main menu is a connected night map: a central pagoda, upturned teal eaves, floating lanterns, a workshop and a railway station above the clouds. The character walks between the destinations; mode numbers and advance disclosure of the final floor/span are omitted. Saved difficulty and answer variants are selected beside the entry action. Tower runs begin playback immediately, with a decorative entrance during the first recording, followed by an interior that frames the actual choices. Success opens a green doorway and the character enters it; mistakes reveal a dark passage and the character recoils. Higher choice counts use tiered interior platforms. Root Court has climbing vines, Rain Gallery has rainlit windows, Lantern Workshop has copper mechanisms, Sky Conservatory has tall plants, and the Observatory has telescopes and stars. Hearts and a current-stretch floor gauge belong to the room, with a full-height miniature tower with 100 windows and a floor / 100 label; completed windows light from the bottom while the complete climb remains visible. Every twenty floors, the explorer reaches an open-sky rest landing: missing hearts refill one at a time beside a lantern fountain, and Continue waits until you are ready. Defeat dims the room, settles the explorer beside a companion and releases the last lantern; the summary stays below that scene. Victory transitions directly into the lit pagoda, rising lanterns and slow constellation bursts. Feedback and audio replacement use a fixed shelf above the word; review Continue belongs to the lower edge of the scene. The canvas stays mounted through review, audio recovery and changes in door count.

The word, highlighted syllable and Replay are always on an opaque panel. Skyrail places the input before the scenery on all screens. The mobile layout adapts to the visual viewport and also supports short keyboard-height viewports, preserving the word, input, replay and deadline while compressing the railway. Skyrail feedback has a fixed slot above the word. Review Continue appears in the scene; district stops tuck away the word and input to give the station a readable breather composition. Reveal and the bottom Jyutping guide have been removed. Reduced motion settles animation immediately. There is one fixed palette and no theme selector.

The earlier prototype URL redirects to the main game. The underlying saved challenge key remains `tide` for Skyrail, with a versioned local migration that preserves earlier records and settings.
