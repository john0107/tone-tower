import test from 'node:test';
import assert from 'node:assert/strict';
import { cantonese, mandarin } from '../../src/languages/profiles.js';
import { parsePinyin, formatPinyin, pinyinSpelling } from '../../src/languages/pinyin.js';
import { createRun, defaultPractice, validatePractice } from '../../src/game/game-core.js';
import { catalogRows, referenceRows } from '../../src/content/catalog.js';
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  resetProgress,
} from '../../src/persistence/progress.js';
import { doorSlots } from '../../src/world/pixel-world.js';
import { arrowChoiceIndex } from '../../src/game/game-controller.js';

test('Pinyin compares syllables, tone marks, neutral tone, umlauts, and explicit boundaries', () => {
  for (const input of ['NI3 HAO3', 'ni3hao3', 'nǐ hǎo', 'nǐhǎo', 'nǐ hǎo'])
    assert.equal(mandarin.evaluate(input, ['ni3', 'hao3'], true), true, input);
  for (const input of ['ni2hao3', 'nihao', 'ni3hao', 'ni3 haǒ4', 'ni33 hao3'])
    assert.equal(mandarin.evaluate(input, ['ni3', 'hao3'], true), false, input);
  for (const input of ['lǜ', 'lü4', 'lv4', 'lu:4'])
    assert.equal(mandarin.evaluate(input, ['lü4'], true), true, input);
  assert.equal(mandarin.evaluate('lu4', ['lü4'], true), false);
  assert.equal(mandarin.evaluate('lü', ['lu4']), false);
  for (const input of ['māma', 'ma1 ma5', 'ma1 ma0', 'ma1ma'])
    assert.equal(mandarin.evaluate(input, ['ma1', 'ma5'], true), true, input);
  assert.equal(mandarin.evaluate("xī'ān", ['xi1', 'an1'], true), true);
  assert.equal(mandarin.evaluate('xian1', ['xi1', 'an1'], true), false);
  assert.equal(mandarin.evaluate('ni hao', ['ni3', 'hao3']), true);
  assert.equal(mandarin.evaluate('', ['ni3']), null);
  assert.equal(parsePinyin('nǐ🙂'), null);
  assert.equal(formatPinyin('lü4 shui3 liu2 ou1'), 'lǜ shuǐ liú ōu');
  assert.equal(mandarin.withoutTones('lü4'), 'lü');
});

test('Pinyin spelling focus uses written initials and finals, with exact tones', () => {
  for (const [value, focus, expected] of [
    ['zhong1', 'initials', 'zh1'],
    ['shui3', 'finals', 'ui3'],
    ['yuan2', 'initials', 'y2'],
    ['ai4', 'initials', '-4'],
    ['lü4', 'finals', 'ü4'],
  ])
    assert.equal(pinyinSpelling(value, focus), expected);
  assert.equal(mandarin.evaluate('n3 h3', ['n3', 'h3'], true, 'initials'), true);
  assert.equal(mandarin.evaluate('n h', ['n3', 'h3'], true, 'initials'), false);
  assert.equal(mandarin.evaluate('ǐ ǎo', ['i3', 'ao3'], true, 'finals'), true);
});

function mandarinWords() {
  return Array.from({ length: 240 }, (_, i) => ({
    id: 'cmn-' + i,
    pronunciationId: 'reading-' + i,
    text: i < 80 ? '你' : '你好',
    audio: 'fixture.mp3',
    syllables:
      i < 80
        ? [{ text: '你', transcription: 'ni' + ((i % 4) + 1), tone: (i % 4) + 1 }]
        : [
            { text: '你', transcription: 'ni3', dictionaryTone: 3, tone: (i % 5) + 1 },
            { text: '好', transcription: 'hao3', dictionaryTone: 3, tone: 3 },
          ],
  }));
}
test('both Mandarin challenges complete 100 questions with the correct profile progression', () => {
  for (const challenge of ['tone', 'tide']) {
    const run = createRun(
      { challenge, variant: challenge === 'tide' ? 'full' : 'normal' },
      mandarinWords(),
      { profile: mandarin, random: () => 0.31 },
    );
    const used = new Set();
    for (let i = 0; i < 100; i++) {
      assert.ok(!used.has(run.word.id));
      used.add(run.word.id);
      if (challenge === 'tone')
        assert.equal(run.choices.length, [2, 3, 4, 5, 5][Math.floor(i / 20)]);
      else {
        assert.equal(run.word.syllables.length, i < 20 ? 1 : 2);
        assert.equal(run.timeLimit(), [15, 13, 11, 9, 7][Math.floor(i / 20)] * 1000);
      }
      assert.equal(run.answer(challenge === 'tone' ? run.word.tone : run.expected()).correct, true);
      if (i < 99) run.next();
    }
    assert.equal(run.status, 'won');
  }
});

test('common catalog separates dictionary spelling, heard tones, scripts and contextual references', () => {
  const catalog = {
    version: 2,
    language: 'cmn',
    transcriptionSystem: 'pinyin',
    entries: [
      { id: 'greeting', forms: { simplified: '你好', traditional: '你好' }, gloss: 'hello' },
    ],
    pronunciations: [
      {
        id: 'greeting-reading',
        entryId: 'greeting',
        syllables: [
          { text: '你', transcription: 'ni3', tone: 3 },
          { text: '好', transcription: 'hao3', tone: 3 },
        ],
      },
    ],
    recordings: [
      {
        id: 'voice',
        pronunciationId: 'greeting-reading',
        audio: 'fixture.mp3',
        realizedTones: [2, 3],
      },
    ],
    references: [{ tone: 2, recordingId: 'voice', targetIndex: 0 }],
  };
  const rows = catalogRows(catalog, mandarin);
  assert.deepEqual(
    rows[0].syllables.map((s) => s.tone),
    [2, 3],
  );
  assert.deepEqual(
    rows[0].syllables.map((s) => s.dictionaryTone),
    [3, 3],
  );
  assert.equal(referenceRows(catalog, rows)[0].targetIndex, 0);
  const tone = createRun(
    { ...defaultPractice('tone', mandarin), content: 'multi', focusIds: ['voice'], tones: [2, 4] },
    rows,
    { profile: mandarin, random: () => 0 },
  );
  assert.equal(tone.word.tone, 2);
  assert.equal(tone.answer(2).correct, true);
  const spelling = createRun(
    { ...defaultPractice('tide', mandarin), variant: 'full', content: 'multi', target: 'whole' },
    rows,
    { profile: mandarin },
  );
  assert.equal(spelling.answer('ni2 hao3').correct, false);
  spelling.next();
  assert.equal(spelling.answer('nǐ hǎo').correct, true);
  assert.throws(() => catalogRows(catalog, cantonese), /Unsupported/);
  assert.throws(
    () =>
      catalogRows(
        { ...catalog, recordings: [{ ...catalog.recordings[0], realizedTones: [] }] },
        mandarin,
      ),
    /spoken tone/,
  );
});

test('language saves, reset, tone confusions, and script settings are isolated', () => {
  const data = new Map(),
    storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const yue = emptyProgress(cantonese),
    cmn = emptyProgress(mandarin);
  yue.records.tone.normal.best = 35;
  cmn.records.tone.normal.best = 80;
  cmn.settings.script = 'traditional';
  cmn.confusions = { '2-5': 3, '5-6': 2 };
  saveProgress(cantonese, yue, storage);
  saveProgress(mandarin, cmn, storage);
  assert.equal(loadProgress(cantonese, storage).records.tone.normal.best, 35);
  assert.equal(loadProgress(mandarin, storage).settings.script, 'traditional');
  assert.deepEqual(loadProgress(mandarin, storage).confusions, { '2-5': 3 });
  resetProgress(mandarin, storage);
  assert.equal(loadProgress(cantonese, storage).records.tone.normal.best, 35);
  assert.equal(loadProgress(mandarin, storage).records.tone.normal.best, 0);
});

test('five doors have distinct hit regions and spatial keyboard choices', () => {
  const doors = doorSlots(5);
  assert.equal(doors.length, 5);
  for (let i = 0; i < doors.length; i++) {
    const [x, y, w, h] = doors[i];
    assert.ok(x >= 0 && y >= 0 && x + w <= 480 && y + h <= 240);
    for (const [a, b, c, d] of doors.slice(i + 1))
      assert.ok(x + w <= a || a + c <= x || y + h <= b || b + d <= y);
  }
  assert.equal(arrowChoiceIndex(5, 'ArrowUp'), 0);
  assert.equal(arrowChoiceIndex(5, 'ArrowDown'), 4);
});

test('an additional language uses non-Han text and named tones without core branches', () => {
  const profile = {
    ...mandarin,
    id: 'test-language',
    transcriptionSystem: 'native-writing',
    tones: ['level', 'rising'],
    stageChoices: [2, 2, 2, 2, 2],
    choiceCounts: [2],
    practiceToneContent: 'single',
    evaluate: (value, expected) =>
      String(value).normalize('NFC') === expected.join(' ').normalize('NFC'),
    practiceSpelling: (value) => value,
    format: (value) => value,
    withoutTones: (value) => value,
  };
  const rows = [
    { id: 'one', text: 'má', syllables: [{ text: 'má', transcription: 'má', tone: 'rising' }] },
    { id: 'two', text: 'ma', syllables: [{ text: 'ma', transcription: 'ma', tone: 'level' }] },
  ];
  const run = createRun(defaultPractice('tone', profile), rows, { profile });
  assert.equal(run.answer(run.word.tone).correct, true);
  const spelling = createRun(defaultPractice('tide', profile), rows, { profile });
  assert.equal(spelling.answer(spelling.expected()).correct, true);
  assert.equal(validatePractice(defaultPractice('tone', profile), rows, profile).valid, true);
  assert.throws(() => createRun({}, rows), /explicit language/);
});

test('tone exercises skip ineligible targets without losing their spelling practice', () => {
  const row = {
    id: 'triple',
    text: '我很好',
    syllables: [
      { text: '我', transcription: 'wo3', tone: 3, toneEligible: false },
      { text: '很', transcription: 'hen3', tone: 3, toneEligible: false },
      { text: '好', transcription: 'hao3', tone: 3, toneEligible: true },
    ],
  };
  const tone = createRun(
    { ...defaultPractice('tone', mandarin), content: 'multi', tones: [2, 3], focusIds: ['triple'] },
    [row],
    { profile: mandarin, random: () => 0 },
  );
  assert.deepEqual(tone.targets, [2]);
  const spelling = createRun(
    { ...defaultPractice('tide', mandarin), content: 'multi', target: 'whole', variant: 'full' },
    [row],
    { profile: mandarin },
  );
  assert.equal(spelling.answer('wo3 hen3 hao3').correct, true);
});
