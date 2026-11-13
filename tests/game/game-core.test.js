import { practiceSpelling } from '../../src/languages/jyutping.js';
import { cantonese } from '../../src/languages/profiles.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, defaultPractice, validatePractice } from '../../src/game/game-core.js';

const words = Array.from({ length: 240 }, (_, i) => {
  const tone = (i % 6) + 1;
  const syllables = [{ text: '字', transcription: `zi${tone}`, tone }];
  if (i >= 90)
    syllables.push({ text: '音', transcription: `jam${(tone % 6) + 1}`, tone: (tone % 6) + 1 });
  return {
    id: String(i),
    text: syllables.map((s) => s.text).join(''),
    gloss: 'sound',
    audio: `${i}.mp3`,
    syllables,
  };
});
const random = () => 0.3;
const clear = (run) => run.answer(run.world === 'tone' ? run.word.tone : run.expected());

test('official tone climb retains stage, recovery, win, and difficulty rules', () => {
  const run = createRun({ challenge: 'tone', variant: 'normal' }, words, {
    profile: cantonese,
    random: random,
  });
  assert.equal(run.lives, 4);
  assert.equal(run.timeLimit(), 0);
  for (let i = 0; i < 100; i++) {
    assert.equal(run.choices.length, [2, 3, 4, 6, 6][Math.floor(i / 20)]);
    if (i === 0 || i === 10 || i === 19) {
      const wrong = run.choices.find((t) => t !== run.word.tone);
      assert.equal(run.answer(wrong).correct, false);
      assert.equal(run.opened, i);
      run.next();
    }
    const result = clear(run);
    if (i === 9) {
      assert.equal(result.recovered, 1);
      assert.equal(run.lives, 4);
    }
    if (i === 19) {
      assert.equal(result.landing, true);
      assert.equal(result.recovered, 2);
    }
    if (i < 99) run.next();
  }
  assert.equal(run.status, 'won');
  assert.equal(run.cleared, 100);
  assert.equal(run.mistakes, 3);
  assert.equal(run.attempts, 103);
  assert.equal(run.next(), false);
  const extreme = createRun({ challenge: 'tone', variant: 'extreme' }, words, {
    profile: cantonese,
    random: random,
  });
  extreme.answer(extreme.choices.find((t) => t !== extreme.word.tone));
  assert.equal(extreme.status, 'lost');
});

test('Skyrail stages shorten the deadline; full typing requires tone digits', () => {
  for (const variant of ['spelling', 'full']) {
    const run = createRun({ challenge: 'tide', variant }, words, {
      profile: cantonese,
      random: random,
    });
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      assert.equal(run.timeLimit(), [15, 13, 11, 9, 7][Math.floor(i / 20)] * 1000);
      assert.equal(run.word.syllables.length, i < 20 ? 1 : 2);
      assert.equal(run.targets.length, i < 40 ? 1 : 2);
      assert.equal(ids.has(run.word.id), false);
      ids.add(run.word.id);
      if (i === 0 && variant === 'full') {
        assert.equal(run.answer(run.expected().replace(/[1-6]/g, '')).kind, 'wrong');
        assert.equal(run.lives, 4);
      }
      clear(run);
      if (i < 99) run.next();
    }
    assert.equal(run.status, 'won');
  }
});

test('wrong typing is free; timeout and reveal cost one life without progress', () => {
  const run = createRun({ challenge: 'tide' }, words, { profile: cantonese, random: random });
  assert.equal(run.answer(' ').kind, 'empty');
  assert.equal(run.guesses, 0);
  for (let i = 0; i < 8; i++) assert.equal(run.answer('wrong').terminal, false);
  assert.equal(run.guesses, 8);
  assert.equal(run.lives, 4);
  const old = run.word.id;
  run.fail('timeout');
  assert.equal(run.lives, 3);
  assert.equal(run.opened, 0);
  assert.deepEqual(run.missedIds, [old]);
  assert.equal(run.fail('timeout').ignored, true);
  assert.equal(run.lives, 3);
  run.next();
  assert.notEqual(run.word.id, old);
  run.markAssisted();
  run.markAssisted();
  run.fail('reveal');
  assert.equal(run.assisted, 1);
  assert.equal(run.lives, 2);
  run.next();
  run.fail('timeout');
  run.next();
  run.fail('timeout');
  assert.equal(run.status, 'lost');
  assert.equal(run.lives, 0);
  assert.equal(clear(run).ignored, true);
});

test('practice supports partial rehearsal, custom time, finite and endless drills', () => {
  const run = createRun(
    {
      ...defaultPractice('tide', cantonese),
      format: 'rehearsal',
      start: 97,
      target: 'stage',
      content: 'mixed',
      timer: 'custom',
      seconds: 12,
      lives: 'standard',
    },
    words,
    { profile: cantonese, random: random },
  );
  assert.equal(run.opened, 96);
  assert.equal(run.goal, 4);
  assert.equal(run.targets.length, 2);
  assert.equal(run.timeLimit(), 12000);
  for (let i = 0; i < 4; i++) {
    clear(run);
    if (i < 3) run.next();
  }
  assert.equal(run.status, 'complete');
  const drill = createRun(
    { ...defaultPractice('tide', cantonese), length: 10, content: 'single' },
    words,
    { profile: cantonese, random: random },
  );
  assert.equal(drill.lives, null);
  assert.equal(drill.timeLimit(), 0);
  drill.fail('reveal');
  drill.next();
  for (let i = 0; i < 9; i++) {
    clear(drill);
    if (i < 8) drill.next();
  }
  assert.equal(drill.status, 'complete');
  assert.equal(drill.attempts, 10);
  const endless = createRun(
    { ...defaultPractice('tide', cantonese), length: 'endless', focusIds: ['0', '1'] },
    words,
    { profile: cantonese, random: random },
  );
  for (let i = 0; i < 120; i++) {
    assert.ok(['0', '1'].includes(endless.word.id));
    clear(endless);
    endless.next();
  }
  assert.equal(endless.status, 'playing');
  assert.equal(endless.finish(), true);
  assert.equal(endless.status, 'complete');
});

test('replacement is unscored and recordings cycle only after eligible pool exhaustion', () => {
  const run = createRun(
    {
      ...defaultPractice('tide', cantonese),
      length: 'endless',
      content: 'single',
      focusIds: ['0', '1', '2'],
    },
    words,
    { profile: cantonese, random: random },
  );
  const first = run.word.id;
  run.replace();
  const second = run.word.id;
  run.replace();
  const third = run.word.id;
  assert.equal(new Set([first, second, third]).size, 3);
  run.replace();
  assert.notEqual(run.word.id, third);
  assert.equal(run.attempts, 0);
  assert.equal(run.cleared, 0);
});

test('official runs stop at exhausted recordings rather than reusing them', () => {
  const run = createRun({ challenge: 'tone' }, words.slice(0, 6), {
    profile: cantonese,
    random: random,
  });
  for (let i = 0; i < 6; i++) {
    clear(run);
    if (i < 5) run.next();
  }
  assert.throws(() => run.next(), /No unused recordings/);
  assert.equal(run.opened, 6);
  assert.equal(run.mistakes, 0);
});

test('word selection rotates vocabulary before alternate speakers while preserving recording IDs', () => {
  const recordings = [
    {
      id: 'a1',
      wordId: 'a',
      audio: 'a1.mp3',
      syllables: [{ text: '你', transcription: 'nei5', tone: 5 }],
    },
    {
      id: 'a2',
      wordId: 'a',
      audio: 'a2.mp3',
      syllables: [{ text: '你', transcription: 'nei5', tone: 5 }],
    },
    {
      id: 'a3',
      wordId: 'a',
      audio: 'a3.mp3',
      syllables: [{ text: '你', transcription: 'nei5', tone: 5 }],
    },
    {
      id: 'b1',
      wordId: 'b',
      audio: 'b1.mp3',
      syllables: [{ text: '我', transcription: 'ngo5', tone: 5 }],
    },
  ];
  for (const challenge of ['tone', 'tide']) {
    const config = {
      ...defaultPractice(challenge, cantonese),
      length: 'endless',
      tones: [5],
      choices: 2,
    };
    if (challenge === 'tone') config.tones = [2, 5];
    // A focused recording selection allows a distractor tone with no recording.
    config.focusIds = recordings.map((row) => row.id);
    const run = createRun(config, recordings, { profile: cantonese, random: () => 0 });
    const first = run.word;
    run.replace();
    assert.notEqual(run.word.wordId, first.wordId);
    const ids = new Set([first.id, run.word.id]);
    run.replace();
    ids.add(run.word.id);
    run.replace();
    ids.add(run.word.id);
    assert.equal(ids.size, 4);
    assert.equal(run.attempts, 0);
  }
});

test('practice validation rejects impossible content and inconsistent options', () => {
  assert.equal(
    validatePractice(
      { ...defaultPractice('tone', cantonese), tones: [1, 2], choices: 6 },
      words,
      cantonese,
    ).valid,
    false,
  );
  assert.equal(
    validatePractice(
      { ...defaultPractice('tide', cantonese), timer: 'custom', seconds: 0 },
      words,
      cantonese,
    ).valid,
    false,
  );
  assert.equal(
    validatePractice(
      { ...defaultPractice('tide', cantonese), focusIds: ['missing'] },
      words,
      cantonese,
    ).valid,
    false,
  );
  assert.equal(
    validatePractice({ ...defaultPractice('tone', cantonese), tones: [1, 1] }, words, cantonese)
      .valid,
    false,
  );
  assert.equal(
    validatePractice({ ...defaultPractice('tide', cantonese), start: 101 }, words, cantonese).valid,
    false,
  );
  assert.equal(validatePractice(defaultPractice('tide', cantonese), words, cantonese).valid, true);
  assert.throws(
    () =>
      createRun({ ...defaultPractice('tide', cantonese), focusIds: ['missing'] }, words, {
        profile: cantonese,
      }),
    /No recordings/,
  );
});

test('missed-word practice can use an unheard comparison tone as a distractor', () => {
  const config = {
    ...defaultPractice('tone', cantonese),
    tones: [3, 6],
    choices: 2,
    length: 10,
    focusIds: ['2'],
  };
  assert.equal(validatePractice(config, words, cantonese).valid, true);
  const run = createRun(config, words, { profile: cantonese, random: random });
  for (let i = 0; i < 10; i++) {
    assert.equal(run.word.id, '2');
    assert.deepEqual([...run.choices].sort(), [3, 6]);
    clear(run);
    if (i < 9) run.next();
  }
  assert.equal(run.status, 'complete');
});

test('language adapter accepts spaces and case while keeping exact full-tone spelling', () => {
  assert.equal(cantonese.evaluate(' BAAN6 FAAT3 ', ['baan6', 'faat3']), true);
  assert.equal(cantonese.evaluate('baanfaat', ['baan6', 'faat3']), true);
  assert.equal(cantonese.evaluate('baan6faat3', ['baan6', 'faat3'], true), true);
  assert.equal(cantonese.evaluate('baanfaat', ['baan6', 'faat3'], true), false);
  assert.equal(cantonese.evaluate('ban6faat3', ['baan6', 'faat3'], true), false);
});

test('Skyrail difficulty uses the same lives as Tower, independently of spelling variant', () => {
  for (const [difficulty, lives] of Object.entries({ easy: 5, normal: 4, hard: 3, extreme: 1 }))
    for (const variant of ['spelling', 'full']) {
      const run = createRun({ challenge: 'tide', difficulty, variant }, words, {
        profile: cantonese,
        random: random,
      });
      assert.equal(run.lives, lives);
      assert.equal(run.maxLives, lives);
      assert.equal(run.timeLimit(), 15000);
      run.fail('timeout');
      assert.equal(run.lives, lives - 1);
      assert.equal(run.status, lives === 1 ? 'lost' : 'playing');
    }
  const practice = createRun(
    { ...defaultPractice('tide', cantonese), lives: 'standard', difficulty: 'hard' },
    words,
    { profile: cantonese, random: random },
  );
  assert.equal(practice.lives, 3);
  assert.equal(
    validatePractice(
      { ...defaultPractice('tide', cantonese), difficulty: 'impossible' },
      words,
      cantonese,
    ).valid,
    false,
  );
});

test('beginner practice defaults to 20 answers and keeps the same level without checkpoints', () => {
  for (const challenge of ['tone', 'tide']) {
    const config = defaultPractice(challenge, cantonese);
    assert.equal(config.length, 20);
    const run = createRun(config, words, { profile: cantonese, random: random });
    for (let i = 0; i < 20; i++) {
      assert.equal(run.stage, 0);
      assert.equal(run.timeLimit(), 0);
      assert.equal(run.lives, null);
      assert.equal(run.word.syllables.length, 1);
      if (challenge === 'tone') assert.equal(run.choices.length, 2);
      const result = clear(run);
      assert.equal(result.landing, false);
      if (i < 19) run.next();
    }
    assert.equal(run.cleared, 20);
    assert.equal(run.status, 'complete');
  }
  const long = createRun({ ...defaultPractice('tide', cantonese), length: 50 }, words, {
    profile: cantonese,
    random: random,
  });
  for (let i = 0; i < 50; i++) {
    assert.equal(long.stage, 0);
    assert.equal(long.word.syllables.length, 1);
    assert.equal(clear(long).landing, false);
    if (i < 49) long.next();
  }
  assert.equal(long.status, 'complete');
});

test('whole-word practice evaluates initials, finals and full spelling with optional required tones', () => {
  const recordings = [
    {
      id: 'greeting',
      audio: 'greeting.mp3',
      gloss: 'hello',
      syllables: [
        { text: '你', transcription: 'nei5', tone: 5 },
        { text: '好', transcription: 'hou2', tone: 2 },
      ],
    },
  ];
  for (const [spellingFocus, plain, withTones] of [
    ['initials', 'n h', 'n5 h2'],
    ['finals', 'ei ou', 'ei5 ou2'],
    ['full', 'nei hou', 'nei5 hou2'],
  ])
    for (const variant of ['spelling', 'full']) {
      const run = createRun(
        {
          ...defaultPractice('tide', cantonese),
          content: 'multi',
          target: 'whole',
          spellingFocus,
          variant,
        },
        recordings,
        { profile: cantonese, random: random },
      );
      assert.equal(run.targets.length, 2);
      assert.equal(run.expected(), withTones);
      if (variant === 'full') {
        assert.equal(run.answer(plain).correct, false);
        run.next();
      }
      assert.equal(run.answer(variant === 'full' ? withTones : plain).correct, true);
    }
  assert.equal(practiceSpelling('gwong2', 'initials'), 'gw2');
  assert.equal(practiceSpelling('kwai4', 'finals'), 'ai4');
  assert.equal(practiceSpelling('ngaa4', 'initials'), 'ng4');
  assert.equal(practiceSpelling('oi3', 'initials'), '-3');
  assert.equal(practiceSpelling('m4', 'initials'), '-4');
  assert.equal(practiceSpelling('ng5', 'finals'), 'ng5');
  assert.equal(
    validatePractice(
      { ...defaultPractice('tide', cantonese), spellingFocus: 'unknown' },
      words,
      cantonese,
    ).valid,
    false,
  );
});

test('Skyrail word-target checkbox can limit focused spelling to one syllable', () => {
  const run = createRun(
    {
      ...defaultPractice('tide', cantonese),
      content: 'multi',
      target: 'highlighted',
      spellingFocus: 'initials',
      variant: 'full',
    },
    words,
    { profile: cantonese, random: random },
  );
  assert.equal(run.targets.length, 1);
  assert.equal(run.expectedParts().length, 1);
  assert.equal(run.answer(run.expected()).correct, true);
});

test('practice counts twenty questions including incorrect submissions and unlimited has no cap', () => {
  for (const challenge of ['tone', 'tide'])
    for (const length of [20, 'endless']) {
      const run = createRun({ ...defaultPractice(challenge, cantonese), length }, words, {
        profile: cantonese,
        random: random,
      });
      const total = length === 'endless' ? 60 : 20;
      for (let i = 0; i < total; i++) {
        const result =
          i % 3 === 0
            ? clear(run)
            : run.answer(
                challenge === 'tone' ? run.choices.find((t) => t !== run.word.tone) : 'incorrect',
              );
        assert.equal(result.landing, false);
        assert.equal(run.attempts, i + 1);
        if (i < total - 1) run.next();
      }
      assert.equal(run.status, length === 'endless' ? 'playing' : 'complete');
      assert.equal(run.cleared, Math.ceil(total / 3));
      if (length === 20) {
        assert.equal(run.next(), false);
        assert.equal(run.answer('incorrect').ignored, true);
      }
    }
});
