# Soundbound — The Highline Isles

One connected pixel world, one fixed palette, Tone Tower + Skyrail + Practice Workshop. The production game is at http://127.0.0.1:4173/. The former design prototype redirects there. All artwork is code-drawn on the same pixel grid; generated backdrop studies and Signal Engine are superseded.

## Shared world

The explorer walks along the map paths to the tower, station or workshop. Arrival enables entry. The map, rooms, railway, sprite, controls and learning panels share stonework, roofs, lights, colours and square edges. There is no light/dark toggle.

## Continuous Skyrail journey

The railcar and camera travel through persistent world coordinates. Correct answers repair real spans that remain behind the car. A 180ms answer handoff starts the next recording while the camera completes the crossing; ordinary success does not stop for Continue. The live input and canvas remain mounted, preserving keyboard focus and ambient animation.

The five stretches are Cliffside Station, Hanging Gardens, Copper Viaduct, Cloudline Pass and Last Platform. Landmarks grow from houses and vines to cranes, pavilions and monumental gateways. Twenty-span checkpoints upgrade the car from Local to Climber, Express, Skyglider and Comet. Shorter stage deadlines make its approach quicker: 15, 13, 11, 9 and 7 seconds. Both answer variants use these times. Easy/Normal/Hard/Extreme have 5/4/3/1 lives, matching Tower.

Hearts sit above the car, and a trackside sign carries the countdown. Numeric progress is visually hidden between checkpoints while accessible progress remains available. Wrong spelling gets amber retry feedback and never costs a life. Timeout freezes at the edge, deducts one life, and drops the car; the emptied heart and red answer review remain visible. Continue starts a rescue and moves forward to the next physical stretch, with no progress award for the missed answer. Checkpoints and failures share one fixed banner above the word and a blue Continue button. No Reveal or bottom Sound guide remains.

On short mobile viewports, the railway crops its sky to retain the car, lives and deadline below the word and input. Long prompts adjust type size without wrapping the Chinese characters into multiple rows. Reduced motion settles crossings, falls and rescues immediately and removes animated construction particles.

## Tower and workshop

Tower runs start with an entrance animation, then focus on the interior, sound, word and accessible doors. Correct doors open green and the character enters; wrong doors reveal a dark passage and the character recoils. The 2/3/4/6 layouts share geometry with the HTML hit regions. The canvas now persists across those layouts. Each cleared floor lights a grouped gauge in the five-district side tower; the active district and current floor are explicit. The prompt room is separate from earned progress, preventing the final clock callback from starting the ascent before the explorer enters the door; the next recording brings a 650ms ascent into the next room, with hit regions riding the artwork. Wrong answers, replays and replacements stay at the same height. Pause freezes the camera; reduced motion settles it immediately. Five district interiors add vines, rainy windows, copper mechanisms, tall plants and telescopes in the shared palette. Lives sit in the room, and checkpoints introduce the next district in a fixed feedback shelf above the word. Each checkpoint then becomes an open-sky recovery landing with sequential heart refills and a deliberate Continue. A bright filled door, a check and a text label mark the correct answer after mistakes. A small dust creature peeks out of the wrong door while the explorer recoils and the lost heart breaks into sparks. In-game tone references are removed; the shared Sound guide remains. Space and R replay. Defeat has a prominent end-of-climb panel; victory waits for the summit invitation instead of auto-skipping the last door. The summit is a fully lit tower with all five district beacon colours. Workshop supports independent practice, including Skyrail difficulty when standard lives are selected.

## Storage and publication

Skyrail difficulty and answer style are saved separately. New records are indexed by both. Previous 25-second-start Skyrail records move into an Earlier Skyrail archive once; Tower, Classic typing and practice history remain intact. The public challenge key remains tide. Git/GitHub setup and publication are deferred; no repository has been initialised.

## Verification

Regression coverage checks monotonic travel through rapid handoffs, preserved repairs, rescue after failure, bounded history, pause/reduced motion, stage deadlines, difficulty lives, archive migration, retry clearing, single life deductions and checkpoint pauses. Browser checks cover all five regions/cars, mobile six-syllable prompts, keyboard-height layouts, fixed feedback geometry, deadlines and checkpoint continuation. The production audio completeness test remains independent of the design changes; content.json and recording files were not edited by this work.
