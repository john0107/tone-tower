import { jyutping } from './jyutping.js';
import { pinyin } from './pinyin.js';

const cedictSource = Object.freeze({
  name: 'CC-CEDICT',
  url: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
});
const cantoSource = Object.freeze({
  name: 'CC-Canto',
  url: 'https://github.com/amadeusine/cc-canto-data',
  attribution: '© 2015–2016 Pleco Software Incorporated',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
});

function tones(descriptions, paths) {
  return descriptions.map((description, i) =>
    Object.freeze({
      value: i + 1,
      label: i === 4 && descriptions.length === 5 ? 'Neutral' : `Tone ${i + 1}`,
      description,
      path: paths[i],
    }),
  );
}
export const cantonese = Object.freeze({
  ...jyutping,
  id: 'yue',
  dictionarySources: [cantoSource, cedictSource],
  slug: 'cantonese',
  label: 'Cantonese',
  toneSummary: 'six tones',
  learningResources: [
    [
      'https://opencantonese.org/books/cantonese-life-1/pronunciation-guide',
      'Open Cantonese pronunciation course',
    ],
    ['https://jyutping.org/en/learn/', 'Jyutping.org’s guide'],
  ],
  romanization: 'Jyutping',
  transcriptionSystem: 'jyutping',
  practiceToneContent: 'single',
  usesToneMarks: false,
  allowWordSpaces: false,
  storageKey: 'soundbound-cantonese-v1',
  defaultScript: 'traditional',
  scripts: ['traditional'],
  tones: [1, 2, 3, 4, 5, 6],
  choiceCounts: [2, 3, 4, 6],
  stageChoices: [2, 3, 4, 6, 6],
  challenges: ['tone', 'tide'],
  spellingFocuses: ['initials', 'finals', 'full'],
  toneDefinitions: tones(
    [
      'High and level',
      'Rises high',
      'Middle and level',
      'Low and falling',
      'Rises from low',
      'Low and level',
    ],
    [
      'M5 5 L95 5',
      'M5 27 L95 5',
      'M5 16 L95 16',
      'M5 21 L95 30',
      'M5 30 Q60 30 95 17',
      'M5 26 L95 26',
    ],
  ),
  example: {
    text: '你好',
    parts: ['nei5', 'hou2'],
    initial: 'f',
    final: 'u',
    tone: 2,
    transcription: 'fu2',
    written: '虎',
    gloss: 'tiger',
  },
});
export const mandarin = Object.freeze({
  ...pinyin,
  id: 'cmn',
  dictionarySources: [cedictSource],
  slug: 'mandarin',
  label: 'Mandarin',
  toneSummary: 'four tones and neutral tone',
  learningResources: [
    ['https://web.mit.edu/~jinzhang/www/pinyin/tones/', 'MIT’s Mandarin tone guide'],
  ],
  romanization: 'Pinyin',
  transcriptionSystem: 'pinyin',
  practiceToneContent: 'mixed',
  usesToneMarks: true,
  allowWordSpaces: true,
  storageKey: 'soundbound-mandarin-v1',
  defaultScript: 'simplified',
  scripts: ['simplified', 'traditional'],
  tones: [1, 2, 3, 4, 5],
  choiceCounts: [2, 3, 4, 5],
  stageChoices: [2, 3, 4, 5, 5],
  challenges: ['tone', 'tide'],
  spellingFocuses: ['initials', 'finals', 'full'],
  toneDefinitions: tones(
    [
      'High and level',
      'Rising',
      'Low or dipping',
      'Falling',
      'Short and unstressed; pitch depends on context',
    ],
    ['M5 5 L95 5', 'M5 30 L95 5', 'M5 19 Q45 45 95 12', 'M5 5 L95 31', 'M35 20 L65 20'],
  ),
  example: {
    text: '你好',
    parts: ['ni3', 'hao3'],
    initial: 'm',
    final: 'a',
    tone: 3,
    transcription: 'ma3',
    written: '马',
    forms: { simplified: '马', traditional: '馬' },
    gloss: 'horse',
  },
});
export const languages = Object.freeze({ yue: cantonese, cmn: mandarin });
export function requireProfile(profile) {
  if (
    !profile?.id ||
    !Array.isArray(profile.tones) ||
    !profile.tones.length ||
    typeof profile.evaluate !== 'function'
  )
    throw Error('An explicit language profile is required.');
  return profile;
}

export function decodeTonePair(key) {
  try {
    const pair = key.startsWith('[') ? JSON.parse(key) : key.split('-').map(Number);
    return Array.isArray(pair) ? pair : [];
  } catch {
    return [];
  }
}
