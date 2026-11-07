import {
  defaultPractice,
  validatePractice,
  TONE_VARIANTS,
  TIDE_VARIANTS,
  RAIL_DIFFICULTIES,
} from '../game/game-core.js';

export const PROGRESS_KEY = 'soundbound-cantonese-v1';
const PROGRESS_VERSION = 3;
const record = () => ({ runs: 0, wins: 0, best: 0, fewest: null });
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);
const uniqueIds = (values) =>
  Array.isArray(values) ? [...new Set(values.filter((id) => typeof id === 'string'))] : [];
function storageOrNull(storage) {
  try {
    return storage ?? globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
function read(storage, key) {
  try {
    const value = JSON.parse(storage?.getItem(key) ?? 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
function cleanRecord(value) {
  const result = record();
  if (!value || typeof value !== 'object') return result;
  result.runs = count(value.runs);
  result.wins = Math.min(result.runs, count(value.wins));
  result.best = Math.min(100, count(value.best));
  result.fewest = Number.isSafeInteger(value.fewest) && value.fewest >= 0 ? value.fewest : null;
  return result;
}
function cleanConfusions(value) {
  return value && typeof value === 'object'
    ? Object.fromEntries(
        Object.entries(value).filter(
          ([key, n]) => /^[1-6]-[1-6]$/.test(key) && key[0] !== key[2] && count(n) > 0,
        ),
      )
    : {};
}
export function emptyProgress() {
  return {
    version: PROGRESS_VERSION,
    settings: {
      toneVariant: 'normal',
      tideVariant: 'spelling',
      tideDifficulty: 'normal',
      practice: { tone: defaultPractice('tone'), tide: defaultPractice('tide') },
    },
    records: {
      tone: Object.fromEntries(Object.keys(TONE_VARIANTS).map((key) => [key, record()])),
      tide: Object.fromEntries(
        TIDE_VARIANTS.map((key) => [
          key,
          Object.fromEntries(Object.keys(RAIL_DIFFICULTIES).map((d) => [d, record()])),
        ]),
      ),
    },
    practice: { runs: 0, completed: 0, cleared: 0 },
    missedIds: [],
    confusions: {},
  };
}
function sanitize(value) {
  const progress = emptyProgress();
  if (Object.hasOwn(TONE_VARIANTS, value.settings?.toneVariant))
    progress.settings.toneVariant = value.settings.toneVariant;
  if (TIDE_VARIANTS.includes(value.settings?.tideVariant))
    progress.settings.tideVariant = value.settings.tideVariant;
  if (Object.hasOwn(RAIL_DIFFICULTIES, value.settings?.tideDifficulty))
    progress.settings.tideDifficulty = value.settings.tideDifficulty;
  for (const challenge of ['tone', 'tide']) {
    const setting = value.settings?.practice?.[challenge];
    if (setting) {
      const checked = validatePractice({ ...setting, challenge });
      if (checked.valid) progress.settings.practice[challenge] = checked.config;
    }
    for (const variant of Object.keys(progress.records[challenge])) {
      if (challenge === 'tone')
        progress.records.tone[variant] = cleanRecord(value.records?.tone?.[variant]);
      else
        for (const difficulty of Object.keys(RAIL_DIFFICULTIES))
          progress.records.tide[variant][difficulty] = cleanRecord(
            value.records?.tide?.[variant]?.[difficulty],
          );
    }
  }
  for (const key of ['runs', 'completed', 'cleared'])
    progress.practice[key] = count(value.practice?.[key]);
  progress.missedIds = uniqueIds(value.missedIds);
  progress.confusions = cleanConfusions(value.confusions);
  return progress;
}

export function loadProgress(storage) {
  const target = storageOrNull(storage),
    value = read(target, PROGRESS_KEY);
  return value?.version === PROGRESS_VERSION ? sanitize(value) : emptyProgress();
}
export function saveProgress(progress, storage) {
  try {
    const target = storageOrNull(storage);
    if (!target) return false;
    target.setItem(PROGRESS_KEY, JSON.stringify(sanitize(progress)));
    return true;
  } catch {
    return false;
  }
}
export function recordRun(progress, run) {
  if (!run || run.recorded || !['won', 'lost', 'complete'].includes(run.status)) return progress;
  run.recorded = true;
  progress.missedIds = uniqueIds([...(progress.missedIds ?? []), ...run.missedIds]);
  for (const [pair, n] of Object.entries(run.confusions))
    progress.confusions[pair] = (progress.confusions[pair] || 0) + n;
  if (run.config.practice) {
    progress.practice.runs++;
    if (run.status === 'complete') progress.practice.completed++;
    progress.practice.cleared += run.cleared;
    return progress;
  }
  const result = challengeRecord(
    progress,
    run.config.challenge,
    run.config.variant,
    run.config.difficulty,
  );
  if (!result) return progress;
  result.runs++;
  result.best = Math.max(result.best, run.opened);
  if (run.status === 'won') {
    result.wins++;
    result.fewest = result.fewest === null ? run.mistakes : Math.min(result.fewest, run.mistakes);
  }
  return progress;
}
export function resetProgress(storage) {
  const progress = emptyProgress();
  saveProgress(progress, storage);
  return progress;
}

export function challengeRecord(progress, world, variant, difficulty = 'normal') {
  return world === 'tide'
    ? progress.records.tide[variant]?.[difficulty]
    : progress.records.tone[variant];
}
export function challengeRecords(progress, world) {
  return world === 'tide'
    ? Object.values(progress.records.tide).flatMap((v) => Object.values(v))
    : Object.values(progress.records.tone);
}
