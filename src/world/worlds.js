export { doorSlots } from './pixel-world.js';
/**
 * Soundbound's illustrated places.
 * All artwork is drawn locally on a shared pixel grid. The game owns controls, timing and progression;
 * these renderers only turn a snapshot into a scene.
 */
export const districts = {
  tone: [
    { id: 'root-court', name: 'Root Court', color: '#79a68a' },
    { id: 'rain-gallery', name: 'Rain Gallery', color: '#89b9c1' },
    { id: 'lantern-workshop', name: 'Lantern Workshop', color: '#e4b46e' },
    { id: 'sky-conservatory', name: 'Sky Conservatory', color: '#a9c89a' },
    { id: 'observatory', name: 'Observatory', color: '#b4b2dc' },
  ],
  tide: [
    { id: 'intake-gardens', name: 'Cliffside Station', color: '#8ab99b' },
    { id: 'glass-stacks', name: 'Hanging Gardens', color: '#94c4cb' },
    { id: 'copper-channels', name: 'Copper Viaduct', color: '#d8a072' },
    { id: 'deep-cistern', name: 'Cloudline Pass', color: '#969bc5' },
    { id: 'grand-reservoir', name: 'Last Platform', color: '#dfc983' },
  ],
};

export function worldScene(
  world,
  { position = 1, phase = 'answering', content = '', count = 2 } = {},
) {
  return (
    '<div class="world-scene world-scene--' +
    world +
    '" data-world="' +
    world +
    '" data-phase="' +
    phase +
    '" data-count="' +
    count +
    '"><span class="world-sr-only">' +
    (world === 'tone' ? 'Tower interior' : 'Skyrail viaduct') +
    ', ' +
    (world === 'tone' ? 'floor ' : 'span ') +
    position +
    '.</span><canvas class="world-canvas" width="480" height="240" aria-hidden="true"></canvas><div class="scene-content">' +
    content +
    '</div></div>'
  );
}
