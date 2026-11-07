import { shuffle, buildChoices } from './logic.js';
import { chooseWordRecording, wordIdentity } from '../content/catalog.js';

const TONES = [1, 2, 3, 4, 5, 6];
export const TONE_VARIANTS = Object.freeze({ easy: 5, normal: 4, hard: 3, extreme: 1 });
export const TIDE_VARIANTS = Object.freeze(['spelling', 'full']);
export const RAIL_DIFFICULTIES = TONE_VARIANTS;
export const RAIL_DEADLINES = Object.freeze([15, 13, 11, 9, 7]);
const descriptions = [
  'High and level',
  'Rises high',
  'Middle and level',
  'Low and falling',
  'Rises from low',
  'Low and level',
];
const paths = [
  'M5 5 L95 5',
  'M5 27 L95 5',
  'M5 16 L95 16',
  'M5 21 L95 30',
  'M5 30 Q60 30 95 17',
  'M5 26 L95 26',
];
const normalizeAnswer = (value, full = false) =>
  String(value ?? '')
    .replace(/[–—]/g, '-')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(full ? /$^/g : /[1-6]/g, '');
export const cantonese = Object.freeze({
  id: 'cantonese',
  label: 'Cantonese',
  romanization: 'Jyutping',
  tones: TONES,
  toneDefinitions: TONES.map((value, i) =>
    Object.freeze({ value, label: `Tone ${value}`, description: descriptions[i], path: paths[i] }),
  ),
  normalizeAnswer,
  evaluate(value, expected, full = false) {
    const actual = Array.isArray(value) ? value.join(' ') : String(value ?? '');
    if (!actual.trim()) return null;
    return normalizeAnswer(actual, full) === normalizeAnswer(expected.join(' '), full);
  },
});
export const languages = Object.freeze({ cantonese });
export const challenges = Object.freeze({
  tone: Object.freeze({
    id: 'tone',
    title: 'Tone Tower',
    world: 'tone',
    length: 100,
    variants: Object.keys(TONE_VARIANTS),
    stages: [2, 3, 4, 6, 6].map((choices, i) => ({
      start: i * 20 + 1,
      end: (i + 1) * 20,
      choices,
    })),
  }),
  tide: Object.freeze({
    id: 'tide',
    title: 'Skyrail',
    world: 'tide',
    length: 100,
    variants: TIDE_VARIANTS,
    stages: RAIL_DEADLINES.map((seconds, i) => ({
      start: i * 20 + 1,
      end: (i + 1) * 20,
      seconds,
      target: i < 2 ? 'highlighted' : 'whole',
    })),
  }),
});

// Longest initials first; syllabic m/ng are finals with no initial.
export function practiceSpelling(jyutping, focus = 'full') {
  const tone = jyutping.match(/[1-6]$/)?.[0] || '',
    letters = jyutping.replace(/[1-6]$/, '');
  const initial = /^(?:m|ng)$/.test(letters)
    ? ''
    : letters.match(/^(gw|kw|ng|[bpmfdtnlgkhwzcsj])/)?.[0] || '';
  return (
    (focus === 'initials'
      ? initial || '-'
      : focus === 'finals'
        ? letters.slice(initial.length)
        : letters) + tone
  );
}

export function defaultPractice(challenge = 'tone') {
  return {
    challenge: challenge === 'tide' ? 'tide' : 'tone',
    variant: challenge === 'tide' ? 'spelling' : 'normal',
    difficulty: 'normal',
    practice: true,
    format: 'drill',
    length: 20,
    start: 1,
    content: 'single',
    spellingFocus: 'full',
    singleSyllableOnly: false,
    target: challenge === 'tide' ? 'whole' : 'highlighted',
    tones: [...TONES],
    choices: 2,
    lives: 'unlimited',
    timer: 'off',
    seconds: 15,
    focusIds: [],
  };
}

function normalizeConfig(input = {}) {
  const challenge = input.challenge ?? 'tone';
  return {
    ...defaultPractice(challenge),
    ...input,
    challenge,
    variant: input.variant ?? (challenge === 'tide' ? 'spelling' : 'normal'),
    practice: input.practice === true,
    tones: [...(input.tones ?? TONES)],
    focusIds: [...(input.focusIds ?? [])],
  };
}

function compatibleWords(config, words) {
  return words
    .filter((w) => !w.anchor)
    .filter(
      (w) =>
        w.id &&
        w.syllables?.length &&
        w.syllables.every((s) => typeof s.jyutping === 'string' && TONES.includes(s.tone)),
    )
    .filter(
      (w) =>
        config.content === 'mixed' ||
        (config.content === 'single' ? w.syllables.length === 1 : w.syllables.length > 1),
    )
    .filter((w) => !config.focusIds.length || config.focusIds.includes(w.id))
    .filter(
      (w) => config.challenge !== 'tone' || w.syllables.some((s) => config.tones.includes(s.tone)),
    );
}

export function validatePractice(input = {}, words) {
  let config;
  const errors = [];
  try {
    config = normalizeConfig({ ...input, practice: true });
  } catch {
    return {
      valid: false,
      errors: ['Practice settings are invalid.'],
      config: defaultPractice(input.challenge),
    };
  }
  if (!['tone', 'tide'].includes(config.challenge)) errors.push('Choose a challenge.');
  if (
    config.challenge === 'tone'
      ? !Object.hasOwn(TONE_VARIANTS, config.variant)
      : !TIDE_VARIANTS.includes(config.variant)
  )
    errors.push('Choose a valid challenge variant.');
  if (config.challenge === 'tide' && !Object.hasOwn(RAIL_DIFFICULTIES, config.difficulty))
    errors.push('Choose a valid Skyrail difficulty.');
  if (!['drill', 'rehearsal'].includes(config.format)) errors.push('Choose a practice format.');
  if (![10, 20, 50, 'endless'].includes(config.length))
    errors.push('Choose 10, 20, 50, or endless practice.');
  if (!Number.isInteger(config.start) || config.start < 1 || config.start > 100)
    errors.push('Start must be between 1 and 100.');
  if (!['mixed', 'single', 'multi'].includes(config.content))
    errors.push('Choose a recording length.');
  if (!['initials', 'finals', 'full'].includes(config.spellingFocus))
    errors.push('Choose initials, finals or full spelling.');
  if (!['stage', 'highlighted', 'whole'].includes(config.target))
    errors.push('Choose a typing target.');
  if (
    (input.tones !== undefined && !Array.isArray(input.tones)) ||
    !config.tones.length ||
    new Set(config.tones).size !== config.tones.length ||
    !config.tones.every((t) => TONES.includes(t))
  )
    errors.push('Choose different valid tones.');
  if (
    config.challenge === 'tone' &&
    (![2, 3, 4, 6].includes(config.choices) || config.choices > config.tones.length)
  )
    errors.push('Choose enough tones for the number of doors.');
  if (!['standard', 'unlimited'].includes(config.lives))
    errors.push('Choose standard or unlimited lives.');
  if (!['off', 'stage', 'custom'].includes(config.timer)) errors.push('Choose a timer setting.');
  if (
    config.timer === 'custom' &&
    (!Number.isInteger(config.seconds) || config.seconds < 1 || config.seconds > 120)
  )
    errors.push('Custom time must be between 1 and 120 seconds.');
  if (
    (input.focusIds !== undefined && !Array.isArray(input.focusIds)) ||
    !config.focusIds.every((id) => typeof id === 'string')
  )
    errors.push('Missed recording selection is invalid.');
  if (!errors.length && words) {
    const pool = compatibleWords(config, words);
    if (!pool.length)
      errors.push(
        'No recordings match these settings. Try another recording length or clear the missed-word filter.',
      );
    if (
      config.challenge === 'tone' &&
      !config.focusIds.length &&
      config.tones.some((t) => !pool.some((w) => w.syllables.some((s) => s.tone === t)))
    )
      errors.push('The selected recordings do not cover every chosen tone.');
    if (
      config.challenge === 'tide' &&
      config.target === 'stage' &&
      config.content === 'mixed' &&
      pool.length
    ) {
      const start = config.format === 'rehearsal' ? config.start - 1 : 0;
      const end =
        config.format === 'rehearsal'
          ? 99
          : config.length === 'endless'
            ? 99
            : start + config.length - 1;
      if (start < 20 && !pool.some((w) => w.syllables.length === 1))
        errors.push('This stage needs single-syllable recordings.');
      if (end >= 20 && !pool.some((w) => w.syllables.length > 1))
        errors.push('Later stages need multi-syllable recordings.');
    }
  }
  return { valid: !errors.length, errors, config };
}

export function createRun(input = {}, words = [], random = Math.random) {
  let config = normalizeConfig(input);
  if (config.practice) {
    const checked = validatePractice(config, words);
    if (!checked.valid) throw Error(checked.errors.join(' '));
    config = checked.config;
  } else {
    if (!Object.hasOwn(challenges, config.challenge)) throw Error('Choose a challenge.');
    if (
      config.challenge === 'tone'
        ? !Object.hasOwn(TONE_VARIANTS, config.variant)
        : !TIDE_VARIANTS.includes(config.variant)
    )
      throw Error('Choose a valid challenge variant.');
    if (config.challenge === 'tide' && !Object.hasOwn(RAIL_DIFFICULTIES, config.difficulty))
      throw Error('Choose a valid Skyrail difficulty.');
    config = {
      ...config,
      start: 1,
      format: 'rehearsal',
      length: 100,
      content: 'mixed',
      target: 'stage',
      tones: [...TONES],
      lives: 'standard',
      timer: config.challenge === 'tone' ? 'off' : 'stage',
      focusIds: [],
    };
  }
  const pool = compatibleWords(config, words);
  if (!pool.length) throw Error('No recordings match this challenge.');
  if (
    config.challenge === 'tide' &&
    config.target === 'stage' &&
    config.content === 'mixed' &&
    (!pool.some((w) => w.syllables.length === 1) || !pool.some((w) => w.syllables.length > 1))
  )
    throw Error('This climb needs single- and multi-syllable recordings.');
  let used = new Set(),
    usedWords = new Set(),
    toneBag = [];
  const start = config.practice && config.format === 'rehearsal' ? config.start - 1 : 0;
  const maxLives =
    config.practice && config.lives === 'unlimited'
      ? null
      : config.challenge === 'tone'
        ? TONE_VARIANTS[config.variant]
        : RAIL_DIFFICULTIES[config.difficulty];
  const run = {
    config,
    world: config.challenge,
    opened: start,
    cleared: 0,
    attempts: 0,
    mistakes: 0,
    guesses: 0,
    lives: maxLives,
    maxLives,
    status: 'playing',
    word: null,
    targets: [],
    choices: [],
    missedIds: [],
    confusions: {},
    assisted: 0,
    promptState: 'ready',
    lastAnswer: null,
    lastFailure: null,
    lastResult: null,
    stages: Array.from({ length: 5 }, () => ({ attempts: 0, correct: 0, mistakes: 0 })),
    get goal() {
      return !config.practice || config.format === 'rehearsal' ? 100 - start : config.length;
    },
    get stage() {
      return config.practice && config.format === 'drill'
        ? 0
        : Math.min(4, Math.floor(this.opened / 20));
    },
    expectedParts() {
      return this.targets.map((i) =>
        config.practice && config.challenge === 'tide'
          ? practiceSpelling(this.word.syllables[i].jyutping, config.spellingFocus)
          : this.word.syllables[i].jyutping,
      );
    },
    expected() {
      return this.expectedParts().join(' ');
    },
    timeLimit() {
      if (
        (config.practice && config.timer === 'off') ||
        (config.challenge === 'tone' && !config.practice)
      )
        return 0;
      if (config.practice && config.timer === 'custom') return config.seconds * 1000;
      if (config.challenge === 'tone') return 0;
      return RAIL_DEADLINES[this.stage] * 1000;
    },
    markAssisted() {
      if (this.status !== 'playing' || this.promptState !== 'ready' || this.word.assisted) return;
      this.word.assisted = true;
      this.assisted++;
    },
    next() {
      if (this.status !== 'playing') return false;
      let eligible = pool;
      if (config.challenge === 'tide' && config.target === 'stage' && config.content === 'mixed')
        eligible = eligible.filter((w) =>
          this.opened < 20 ? w.syllables.length === 1 : w.syllables.length > 1,
        );
      if (!eligible.length) throw Error('No recordings match the next stage.');
      let fresh = eligible.filter((w) => !used.has(w.id));
      if (!fresh.length) {
        if (!config.practice)
          throw Error(
            'No unused recordings remain for this stage. Try practice with this recording set.',
          );
        used = new Set();
        usedWords = new Set();
        fresh = eligible.filter((w) => eligible.length === 1 || w.id !== this.word?.id);
      }
      let selected, targetIndex;
      if (config.challenge === 'tone') {
        const available = config.tones.filter((t) =>
          fresh.some((w) => w.syllables.some((s) => s.tone === t)),
        );
        if (!toneBag.some((t) => available.includes(t))) toneBag = shuffle(config.tones, random);
        const index = toneBag.findIndex((t) => available.includes(t));
        const tone = toneBag.splice(index, 1)[0];
        const options = fresh.filter((w) => w.syllables.some((s) => s.tone === tone));
        const unheard = options.filter((w) => !usedWords.has(wordIdentity(w)));
        selected = chooseWordRecording(unheard.length ? unheard : options, random);
        const indices = selected.syllables.flatMap((s, i) => (s.tone === tone ? [i] : []));
        targetIndex = indices[Math.floor(random() * indices.length)];
        this.word = {
          ...selected,
          syllables: selected.syllables.map((s) => ({ ...s })),
          tone,
          targetIndex,
        };
        this.targets = [targetIndex];
        const count =
          config.practice && config.format === 'drill'
            ? config.choices
            : Math.min(config.tones.length, [2, 3, 4, 6, 6][this.stage]);
        const supported = [2, 3, 4, 6].filter((n) => n <= count).at(-1);
        this.choices = buildChoices(tone, supported, config.tones, random);
      } else {
        const unheard = fresh.filter((w) => !usedWords.has(wordIdentity(w)));
        selected = chooseWordRecording(unheard.length ? unheard : fresh, random);
        const whole = config.target === 'whole' || (config.target === 'stage' && this.opened >= 40);
        this.targets = whole
          ? selected.syllables.map((_, i) => i)
          : [Math.floor(random() * selected.syllables.length)];
        this.word = {
          ...selected,
          syllables: selected.syllables.map((s) => ({ ...s })),
          targetIndex: this.targets[0],
        };
        this.choices = [];
      }
      used.add(this.word.id);
      usedWords.add(wordIdentity(this.word));
      this.promptState = 'ready';
      this.lastAnswer = null;
      this.lastFailure = null;
      this.lastResult = null;
      return this.word;
    },
    replace() {
      return this.next();
    },
    answer(value) {
      if (this.status !== 'playing' || this.promptState !== 'ready')
        return {
          kind: 'empty',
          correct: false,
          terminal: this.status !== 'playing',
          ignored: true,
        };
      this.lastAnswer = value;
      if (config.challenge === 'tone') {
        const tone = Number(value);
        if (!this.choices.includes(tone)) return { kind: 'empty', correct: false, terminal: false };
        if (tone !== this.word.tone) {
          const key = [tone, this.word.tone].sort((a, b) => a - b).join('-');
          this.confusions[key] = (this.confusions[key] || 0) + 1;
          return this.fail('tone');
        }
      } else {
        const correct = cantonese.evaluate(value, this.expectedParts(), config.variant === 'full');
        if (correct === null) return { kind: 'empty', correct: false, terminal: false };
        if (!correct) {
          this.guesses++;
          if (config.practice && config.format === 'drill') return this.fail('spelling');
          return (this.lastResult = {
            kind: 'wrong',
            correct: false,
            landing: false,
            recovered: 0,
            terminal: false,
            expected: this.expected(),
          });
        }
      }
      const stage = this.stages[this.stage];
      stage.attempts++;
      stage.correct++;
      this.attempts++;
      this.opened++;
      this.cleared++;
      this.promptState = 'answered';
      const complete =
        this.goal !== 'endless' &&
        (config.practice && config.format === 'drill' ? this.attempts : this.cleared) >= this.goal;
      if (complete) this.status = config.practice ? 'complete' : 'won';
      let recovered = 0;
      const landing =
        !(config.practice && config.format === 'drill') && !complete && this.opened % 20 === 0;
      if (this.lives !== null && !complete) {
        if (landing) recovered = this.maxLives - this.lives;
        else if (this.opened % 10 === 0) recovered = Math.min(1, this.maxLives - this.lives);
        this.lives += recovered;
      }
      return (this.lastResult = {
        kind: 'correct',
        correct: true,
        landing,
        recovered,
        terminal: complete,
        expected: this.expected(),
      });
    },
    fail(reason = 'timeout') {
      if (this.status !== 'playing' || this.promptState !== 'ready')
        return {
          kind: 'empty',
          correct: false,
          terminal: this.status !== 'playing',
          ignored: true,
        };
      if (!['tone', 'spelling', 'timeout', 'reveal'].includes(reason))
        throw Error('Unknown failure reason.');
      this.lastFailure = reason;
      this.promptState = 'failed';
      this.attempts++;
      this.mistakes++;
      const stage = this.stages[this.stage];
      stage.attempts++;
      stage.mistakes++;
      if (!this.missedIds.includes(this.word.id)) this.missedIds.push(this.word.id);
      if (reason === 'reveal' && !this.word.assisted) {
        this.word.assisted = true;
        this.assisted++;
      }
      if (this.lives !== null && --this.lives <= 0) {
        this.lives = 0;
        this.status = 'lost';
      }
      if (
        config.practice &&
        config.format === 'drill' &&
        this.goal !== 'endless' &&
        this.attempts >= this.goal
      )
        this.status = 'complete';
      return (this.lastResult = {
        kind: 'wrong',
        correct: false,
        reason,
        landing: false,
        recovered: 0,
        terminal: this.status !== 'playing',
        expected: this.expected(),
      });
    },
    finish() {
      if (!config.practice || this.status !== 'playing') return false;
      this.status = 'complete';
      return true;
    },
  };
  run.next();
  return run;
}
