> Archived direction: Signal Engine and generated scenery were rejected. See highline-isles.md for the current connected-world / Skyrail study.

# Soundbound — The Silent Tower

Status: visual proposal, not a replacement of the running game. The image is an art-direction target; progress and labels will be driven by real state in implementation.

## One story, two activities
A silent tower is waiting to be brought back to life. Tone Tower is the ascent: hear the tone, choose a door, light the next floor. Signal Engine is the proposed replacement for Tideworks: spell what you hear to send power through the tower's machinery. Both modes retain separate runs and records. Their achievements should not imply a shared completion requirement.

## Composition
One centred stage above one opaque learning dock. No scene/form columns. The tower dominates the stage and is also the progress display. Completed floors are amber, current floor has a cyan marker, untouched floors remain dark. Five visibly distinct architectural districts divide the 100-floor ascent. A foreground room is a cutaway in the same building, with large grounded doors. The words never overlay scenery. On a phone the stage crops decorative surroundings, while the dock and door targets stay readable. No scrolling is required just to move between the current word and its controls on a normal gameplay viewport; larger accessibility text may grow naturally.

## Progress that feels alive
Each correct answer lights one floor. A short signal travels to the current-floor marker. Every 20 clears, a district landmark wakes: a bridge lamp, a bell, an observatory mechanism. The physical tower gets brighter as the run progresses; a compact FLOOR n / 100 marker remains readable without counting windows. The active room, question and controls remain anchored. A district transition may crossfade the art behind them.

Life crystals replace plain hearts. Four or five crystal slots reflect actual configured lives, with empty outlines for lost lives. On damage one crystal flashes, cracks, then becomes an outline. On recovery the crystal fills with a short glint. No perpetual flashing on the HUD.

## Motion language
Ambient: clouds drift behind the tower, lanterns flicker, small particles rise, sprite breathes/blinks. Engine uses restrained stepped rotation and pulses along wires. Success: door opens or charge travels, sprite celebrates once, one window/circuit lights. Failure: chosen door rattles briefly, one life crystal cracks, correct answer is labelled without celebration. Keep all UI bounds stable. Reduced motion uses static illumination and text/icon changes.

## Signal Engine proposal
An immense resonance dynamo replaces the current generic pipe room. A segmented charge halo is the timer, with an explicit seconds label. Correct spelling sends an amber pulse along cables into the tower; completed circuits stay lit during the run. The charge fades while waiting, and a timeout makes the engine power down, with one crystal lost. It remains in that state for review. Next prompt restarts the charge. Wrong typing remains freely retryable. Replay does not extend the timer. This is a presentation change first; retain existing challenge rules unless separately agreed.

Other directions worth considering: Flooded Vault (retain water, but use a monumental submerged archive, tide gates, warning lamps and an escape platform); Storm Lift (a glass elevator ascending inside the tower while a storm builds). Signal Engine is preferred because it connects both modes through the same visible building and is distinct from tone-door selection.

## Names and controls
- The courtyard → Main menu
- Your travels → Records
- Practice Workshop → Practice
- Field guide → Sound guide
- The Tideworks → Signal Engine (proposed; keep legacy saved-data keys)
- Try a fresh word → Continue
- Begin the climb → Start ascent
- Next-district action → Continue ascent / Continue powering up
- Repeat audio → Replay [R] everywhere; reserve bare R in the answer field too, while respecting IME composition and modifier shortcuts. Preserve typed input and countdown. Tone mode may also retain Space.

Use direct learning feedback alongside the story: 'Correct', 'Not quite — 1 life lost', 'Time’s up — 1 life lost'. Avoid vague narrative language for penalties. The main menu can show the same tower and two world-entry actions rather than destination catalogue cards.

## Themes
Design dark mode as a first-class theme: midnight navy panels, violet architecture, warm amber windows and cyan power. Day mode uses a warm sky, pale stone and a light opaque dock with dark text. Keep geometry, contrast and meaning identical. Offer System / Dark / Light, default System, and persist an explicit choice. Selection and success/error states remain distinguishable in both themes.

## Next design gate
Resolve the central tower scale, the learning dock and the second-mode identity before rebuilding the game. Build a responsive animated design prototype from the chosen composition, with controls for floor 1/24/60/100, life loss/recovery, correct/wrong and day/night. Validate 2/3/4/6 doors, long multi-syllable prompts, focused typing, reduced motion and phone height before integrating real gameplay. Detailed raster architecture should be treated as scenery, with animated lights, sprites, doors and accessible controls layered independently so the concept's detail is retained.

## Generated concept
- Image: soundbound-direction-v2.png
- Tool: built-in image_gen (not CLI)
- Purpose: UI/art-direction proposal, not a screenshot of implemented gameplay.

## Final generation prompt
Use case: ui-mockup. Create a beautifully art-directed HIGH FIDELITY GAME UI DESIGN STUDY for SOUNDBOUND, a Cantonese listening game. This is a fresh proposed direction, not an edit. One landscape image with TWO complete, equally sized game-screen mockups beside each other, each screen internally a SINGLE VERTICAL COMPOSITION (absolutely NO scene-and-form side-by-side layout within a screen). Discreet labels above screens: '01 / TONE TOWER' and '02 / SIGNAL ENGINE'. Premium richly detailed hand-crafted 16-bit pixel art with a disciplined pixel grid, intentional clusters, architectural detail, atmospheric layered colour; evoke an outstanding indie game, not basic vector rectangles or a SaaS dashboard. Colourful arcade spirit with a real dark theme: midnight navy backgrounds, deep violet stonework, cyan electrical light, warm amber windows, coral life crystals. All UI must be convincingly usable, with restrained clean typography and ample negative space. Left game: a MASSIVE fascinating pixel tower rising above clouds, little bridges, terraces, glowing architectural details, overgrown balconies, subtly different districts as it rises. The lower quarter of the tower has amber-lit windows representing floors completed, upper floors remain blue and unlit. A cyan outline identifies the player's current floor. The tower itself IS the progress display, not a tiny separate minimap or progress bar. A foreground cutaway room elegantly integrated at the bottom of the tower scene contains TWO large grounded pixel door choices labelled '2' and '5' and a tiny adorable amber sprout explorer. Do not place words over artwork. Top of each screen has small 'SOUNDBOUND' brand, pixel heart-shaped crystal lives (four filled coral and one empty outline), pause symbol, tiny moon theme control. Left current floor label 'FLOOR 24 / 100' attached to current-floor architecture. Beneath scene, an OPAQUE dark navy learning dock across full screen width, visual hierarchy clean and readable. Dock sample content only: large Chinese '你好', smaller 'nei hou', English 'hello', a clear amber underline under first syllable, instruction 'Which tone do you hear?' and compact 'Replay [R]' button. Right game: SIGNAL ENGINE inside the tower's base, a gorgeous immense circular turquoise-and-amber resonance dynamo, copper wiring, banks of small unlit lamps, floating signal motes, tiny same sprout character. Correct spelling powers this engine to relight the tower above. A segmented charge halo around engine is the timer, cyan charged segments and dim blue spent segments, with legible '18s' in a tiny attached badge. Completed power circuits glow amber, remaining circuits dark. Beneath scene same opaque readable learning dock: 'Type what you hear', Chinese '你好', wide input with sample 'nei hou', blue 'Send' button, 'Replay [R]'. Both screen compositions should feel spatially cohesive, fixed UI positions and illustration integrated, detailed beautiful pixel scenery but clear calm learning areas. No marketing slogans. No browser chrome, no laptops, no floating generic rounded cards. Crisp pixel world paired with legible text, not fake illegible UI. Entire image is the two mockups with minimal outer dark frame, professional design presentation.

## Selected direction and prototype
Signal Engine selected by the user. Interactive prototype: prototype.html (serve through the existing local server). Scenery: scenery-atlas-v1.png, generated with the built-in image tool. Prototype has isolated theme preference storage; it never writes game progress. The sample is the existing human recording audio/fu2.mp3 (虎, tiger). Bare R replays even from the answer field; typed text is preserved. Controls simulate outcomes and progress for visual review rather than implementing a full game. Day mode is a first-pass palette/lighting study; a dedicated daylight scenery pass remains for production.
