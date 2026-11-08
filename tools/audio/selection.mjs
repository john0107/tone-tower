const CANTO_SOURCE = 'https://github.com/amadeusine/cc-canto-data';
const GLOSS_SOURCE = 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict';
const WN_SOURCE = 'https://github.com/lmorgadodacosta/CantoneseWN';
const normalizeReading = (value) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const signature = (word) => word.character + '|' + word.jyutping;
const shortHan = (value) => /^[\p{Script=Han}]{1,2}$/u.test(value);
const validReading = (reading, character) =>
  reading?.split(' ').length === [...character].length &&
  reading.split(' ').every((syllable) => /^[a-z]+[1-6]$/.test(syllable));
const fileParts = (title) => /^File:LL-Q9186 \(yue\)-(.+?)-(.+)\.(?:wav|ogg|flac)$/i.exec(title);
const usableGloss = (value) =>
  /[a-zA-Z]{2}/.test(value) &&
  !/^(?:see\b|variant of\b|old variant of\b|same as\b|also written\b|CL:|surname\b|a surname\b|used in\b|also pr\.|Mandarin equivalent:)/i.test(
    value,
  );

// CC-Canto contains slashes inside parts of speech, e.g. '(noun / adverb)'.
// Those are not definition boundaries. Inline '# adapted...' comments also carry
// real alternative readings and must never be dropped from ambiguity checks.
function splitGlosses(text) {
  const parts = [];
  let depth = 0,
    current = '';
  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === '/' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += char;
  }
  parts.push(current.trim());
  return parts.filter(Boolean);
}

export function parseDictionary(text) {
  const entries = [],
    invalidForms = new Set();
  for (const [index, original] of text.split(/\r?\n/).entries()) {
    const line = original.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(\S+) (\S+) \[([^\]]+)\](?: \{([^}]+)\})?(?: \/(.*)\/)?(?:\s+#.*)?$/.exec(line);
    if (!match) {
      for (const form of line.split(/\s+/).slice(0, 2)) invalidForms.add(form);
      continue;
    }
    entries.push({
      traditional: match[1],
      simplified: match[2],
      pinyin: match[3].toLowerCase().replace(/\s/g, ''),
      jyutping: match[4] ? normalizeReading(match[4]) : undefined,
      glosses: splitGlosses(match[5] || ''),
      line: index + 1,
    });
  }
  return { entries, invalidForms };
}

function decodeXML(value) {
  return value
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, n) =>
      String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function wordnetReadings(xml) {
  const forms = new Set(),
    readings = new Set();
  for (const entry of xml.matchAll(/<LexicalEntry\b[^>]*>([\s\S]*?)<\/LexicalEntry>/g)) {
    const lemma = /<Lemma\b[^>]*\bwrittenForm="([^"]+)"/.exec(entry[1]);
    if (!lemma) continue;
    const character = decodeXML(lemma[1]);
    forms.add(character);
    for (const form of entry[1].matchAll(/<Form\b[^>]*\bwrittenForm="([^"]+)"/g))
      readings.add(character + '|' + normalizeReading(decodeXML(form[1])));
  }
  if (!forms.size) throw Error('No Cantonese Wordnet entries found.');
  return { forms, readings };
}

export const PRIORITY_FORMS = [
  '你好',
  '多謝',
  '學校',
  '聽日',
  '尋日',
  '早晨',
  '再見',
  '咖啡',
  '手機',
  '巴士',
  '的士',
  '醫生',
  '醫院',
  '廁所',
  '香港',
  '中文',
  '英文',
  '粵語',
  '六',
  '茶',
];

export function selectExpansion({
  candidates,
  previous,
  content,
  registry,
  review,
  cantoText,
  readingsText,
  cedictText,
  wordnetXML,
  frequency,
  maxRecordingsPerWord = 2,
}) {
  if (!Number.isInteger(maxRecordingsPerWord) || maxRecordingsPerWord < 1)
    throw Error('Invalid recording limit.');
  const canto = parseDictionary(cantoText),
    readings = parseDictionary(readingsText);
  const cedict = parseDictionary(cedictText),
    wn = wordnetReadings(wordnetXML);
  const dictionaryKey = (row) => [row.traditional, row.simplified, row.pinyin].join('|');
  const meanings = new Map();
  for (const row of cedict.entries) {
    const key = dictionaryKey(row),
      values = meanings.get(key) || [];
    values.push(...row.glosses);
    meanings.set(key, values);
  }
  const rows = [
    ...canto.entries.map((row) => ({ ...row, kind: 'canto' })),
    ...readings.entries.map((row) => ({
      ...row,
      kind: 'readings',
      glosses: meanings.get(dictionaryKey(row)) || [],
    })),
  ];
  const byForm = new Map();
  for (const row of rows) {
    for (const form of new Set([row.traditional, row.simplified])) {
      const values = byForm.get(form) || [];
      values.push(row);
      byForm.set(form, values);
    }
  }
  const existingWords = new Set(registry.words.map(signature));
  const savedIds = new Set(content.map((row) => row.id));
  const savedTitles = new Set(content.map((row) => row.title).filter(Boolean));
  const pending = previous.candidates.filter(
    (row) => !savedIds.has('commons-' + row.pageid) && !savedTitles.has(row.title),
  );
  const existing = new Map();
  for (const row of [...content, ...pending]) {
    const key = signature(row),
      speakers = existing.get(key) || new Set();
    speakers.add(
      (fileParts(row.title || '')?.[1] || row.author || 'commons-' + row.pageid).toLowerCase(),
    );
    existing.set(key, speakers);
  }
  const blocked = new Set(review.excluded.map((row) => row.title));
  const priorExcluded = new Map((previous.excluded || []).map((row) => [row.title, row.reason]));
  const priorIds = new Set(previous.candidates.map((row) => row.pageid));
  const consideredIds = new Set();
  const deferred = [],
    eligible = [];
  for (const item of candidates) {
    const parts = fileParts(item.title);
    if (
      !parts ||
      !shortHan(parts[2]) ||
      priorIds.has(item.pageid) ||
      savedIds.has('commons-' + item.pageid) ||
      savedTitles.has(item.title) ||
      consideredIds.has(item.pageid)
    )
      continue;
    consideredIds.add(item.pageid);
    const sourceForm = parts[2];
    let reason;
    if (blocked.has(item.title)) reason = 'Permanent import review decision retained';
    else if (
      priorExcluded.has(item.title) &&
      !/Incomplete dictionary gloss/.test(priorExcluded.get(item.title))
    )
      reason = 'Previous selection review decision retained';
    const matches = byForm.get(sourceForm) || [];
    const valid = matches.filter(
      (row) =>
        validReading(row.jyutping, sourceForm) &&
        shortHan(row.traditional) &&
        validReading(row.jyutping, row.traditional),
    );
    const variants = new Set(valid.map((row) => row.jyutping));
    if (
      canto.invalidForms.has(sourceForm) ||
      readings.invalidForms.has(sourceForm) ||
      matches.some((row) => row.jyutping && !validReading(row.jyutping, sourceForm))
    )
      reason ||= 'Malformed dictionary reading requires review';
    if (!valid.length) reason ||= 'No aligned dictionary reading';
    else if (variants.size !== 1)
      reason ||= 'Multiple dictionary readings require listening review';
    const usable = valid.filter((row) => row.glosses.some(usableGloss));
    const traditional = new Set(usable.map((row) => row.traditional));
    if (!usable.length) reason ||= 'No standalone sourced English meaning';
    else if (traditional.size !== 1) reason ||= 'Ambiguous traditional spelling requires review';
    if (reason) {
      deferred.push({ title: item.title, reason });
      continue;
    }
    const row = usable.find((row) => row.kind === 'canto') || usable[0];
    const character = row.traditional,
      jyutping = row.jyutping;
    const key = character + '|' + jyutping;
    const wordnetMatch = wn.readings.has(key);
    const count = frequency[character] || 0;
    const cantoMatch = usable.some((row) => row.kind === 'canto');
    if (
      !wordnetMatch &&
      !(cantoMatch && [...character].length === 2 && count >= 5 && !wn.forms.has(character))
    ) {
      deferred.push({ title: item.title, reason: 'Insufficient independent vocabulary evidence' });
      continue;
    }
    const glyphs = [...character],
      syllables = jyutping
        .split(' ')
        .map((jp, i) => ({ character: glyphs[i], jyutping: jp, tone: Number(jp.at(-1)) }));
    eligible.push({
      item,
      key,
      character,
      jyutping,
      syllables,
      count,
      speaker: parts[1].toLowerCase(),
      row,
      sourceForm,
      wordnetMatch,
      isNewWord: !existingWords.has(key),
    });
  }
  const groups = new Map();
  for (const candidate of eligible) {
    const values = groups.get(candidate.key) || [];
    values.push(candidate);
    groups.set(candidate.key, values);
  }
  const priority = new Map(PRIORITY_FORMS.map((form, index) => [form, index]));
  const ordered = [...groups.values()].sort(
    (a, b) =>
      Number(b[0].isNewWord) - Number(a[0].isNewWord) ||
      (priority.get(a[0].character) ?? 999) - (priority.get(b[0].character) ?? 999) ||
      b[0].count - a[0].count ||
      a[0].item.pageid - b[0].item.pageid,
  );
  const rounds = [[], []],
    additions = [],
    recovered = [];
  for (const values of ordered) {
    const speakers = new Set(existing.get(values[0].key) || []);
    let round = 0;
    for (const candidate of values.sort((a, b) => a.item.pageid - b.item.pageid)) {
      if (speakers.size >= maxRecordingsPerWord) break;
      if (speakers.has(candidate.speaker)) continue;
      speakers.add(candidate.speaker);
      rounds[Math.min(round++, 1)].push(candidate);
    }
  }
  // Give missing words their first voice before spending downloads on second voices.
  for (const candidate of rounds.flat().sort((a, b) => Number(b.isNewWord) - Number(a.isNewWord))) {
    const { item, character, jyutping, syllables, row, sourceForm, wordnetMatch } = candidate;
    additions.push({
      pageid: item.pageid,
      title: item.title,
      character,
      jyutping,
      gloss: [...new Set(row.glosses.filter(usableGloss))].slice(0, 3).join('; '),
      syllables,
      dictionarySource: CANTO_SOURCE,
      ...(row.kind === 'readings' ? { glossSource: GLOSS_SOURCE } : {}),
      ...(sourceForm !== character ? { sourceWrittenForm: sourceForm } : {}),
      dictionaryEntry: {
        file: row.kind === 'canto' ? 'cccanto-webdist.txt' : 'cccedict-canto-readings.txt',
        line: row.line,
        traditional: row.traditional,
        simplified: row.simplified,
        pinyin: row.pinyin,
      },
      ...(wordnetMatch ? { wordnetSource: WN_SOURCE } : {}),
      reviewStatus: wordnetMatch
        ? 'dictionary and Wordnet reading matched; recording not independently auditioned'
        : 'CC-Canto matched with corpus attestation; recording not independently auditioned',
    });
    if (priorExcluded.has(item.title))
      recovered.push({
        title: item.title,
        previousReason: priorExcluded.get(item.title),
        reason: 'Complete dictionary gloss parsed and reading cross-checked',
      });
  }
  return {
    additions,
    deferred,
    recovered,
    newWords: new Set(additions.filter((row) => !existingWords.has(signature(row))).map(signature))
      .size,
  };
}
