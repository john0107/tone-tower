import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDictionary, wordnetReadings, selectExpansion } from '../../tools/audio/selection.mjs';

const source = (id, speaker, word) => ({
  pageid: id,
  title: `File:LL-Q9186 (yue)-${speaker}-${word}.wav`,
});
const xml = (words) =>
  '<LexicalResource>' +
  words
    .map(
      ([character, reading], i) =>
        `<LexicalEntry id="${i}"><Lemma writtenForm="${character}"/><Form writtenForm="${reading}"/></LexicalEntry>`,
    )
    .join('') +
  '</LexicalResource>';

test('dictionary parsing retains commented alternative readings and intact part-of-speech glosses', () => {
  const parsed = parseDictionary(
    [
      '# source header',
      '聽日 听日 [ting1 ri4] {ting1 jat6} /(noun / adverb) tomorrow/',
      '你 你 [ni3] {nei5} /you/ # adapted from cc-cedict',
      '你 你 [ni3] {lei5} /you/ # adapted from cc-cedict',
      '有 有 broken entry',
    ].join('\n'),
  );
  assert.equal(parsed.entries.length, 3);
  assert.deepEqual(parsed.entries[0].glosses, ['(noun / adverb) tomorrow']);
  assert.equal(parsed.entries[0].line, 2);
  assert.deepEqual(
    parsed.entries.slice(1).map((row) => row.jyutping),
    ['nei5', 'lei5'],
  );
  assert.ok(parsed.invalidForms.has('有'));
});

test('expansion preserves review decisions, resolves documented gloss parsing and limits speaker duplicates', () => {
  const input = {
    candidates: [
      source(1, 'A', '多谢'),
      source(2, 'B', '多謝'),
      source(3, 'C', '多謝'),
      source(4, 'A', '多謝'),
      source(5, 'A', '聽日'),
      source(6, 'A', '你'),
      source(7, 'A', '冇'),
      source(8, 'A', '學校'),
      source(9, 'A', '未知'),
      source(10, 'A', '三個字'),
      source(12, 'Old', '水'),
      source(13, 'New', '水'),
      source(14, 'A', '唔好'),
      source(15, 'A', '你哋'),
    ],
    previous: {
      candidates: [],
      excluded: [
        {
          title: source(5, 'A', '聽日').title,
          reason: 'Incomplete dictionary gloss requires manual review',
        },
        { title: source(7, 'A', '冇').title, reason: 'Existing recording has a different reading' },
      ],
    },
    content: [
      {
        id: 'commons-11',
        ...source(11, 'Old', '水'),
        character: '水',
        jyutping: 'seoi2',
        author: 'Old',
      },
    ],
    registry: { words: [{ character: '水', jyutping: 'seoi2' }] },
    review: {
      excluded: [{ title: source(8, 'A', '學校').title, reason: 'Confirmed wrong audio' }],
    },
    cantoText: [
      '多謝 多谢 [duo1 xie4] {do1 ze6} /many thanks/',
      '聽日 听日 [ting1 ri4] {ting1 jat6} /(noun / adverb) tomorrow/',
      '你 你 [ni3] {nei5} /you/',
      '你 你 [ni3] {lei5} /you/ # adapted',
      '冇 冇 [mao3] {mou5} /not have/',
      '學校 学校 [xue2 xiao4] {hok6 haau6} /school/',
      '水 水 [shui3] {seoi2} /water/',
      '唔好 唔好 [wu2 hao3] {m4 hou2} /do not/',
      '你哋 你哋 [ni3 men5] {nei5 dei6} /you plural/',
    ].join('\n'),
    readingsText: '',
    cedictText: '',
    wordnetXML: xml([
      ['多謝', 'do1 ze6'],
      ['聽日', 'ting1 jat6'],
      ['你', 'nei5'],
      ['水', 'seoi2'],
      ['唔好', 'm4 hou3'],
    ]),
    frequency: { 多謝: 100, 聽日: 10, 你哋: 5, 唔好: 1000 },
  };
  const result = selectExpansion(input);
  assert.deepEqual(
    result.additions.map((row) => row.pageid),
    [1, 5, 15, 2, 13],
  );
  assert.equal(result.newWords, 3);
  assert.equal(result.additions[0].character, '多謝');
  assert.equal(result.additions[0].sourceWrittenForm, '多谢');
  assert.equal(result.additions[1].gloss, '(noun / adverb) tomorrow');
  assert.equal(result.recovered.length, 1);
  assert.match(
    result.deferred.find((row) => row.title === source(6, 'A', '你').title).reason,
    /Multiple/,
  );
  assert.match(
    result.deferred.find((row) => row.title === source(8, 'A', '學校').title).reason,
    /Permanent/,
  );
  assert.match(
    result.deferred.find((row) => row.title === source(14, 'A', '唔好').title).reason,
    /Insufficient/,
  );
  assert.equal(result.additions[2].wordnetSource, undefined);
  assert.ok(
    result.additions.every(
      (row) => !row.metadata && /not independently auditioned/.test(row.reviewStatus),
    ),
  );
  const again = selectExpansion({
    ...input,
    previous: { ...input.previous, candidates: result.additions },
  });
  assert.equal(again.additions.length, 0);
});

test('modern English meanings are joined by the exact dictionary entry; ambiguous traditional forms stay out', () => {
  const result = selectExpansion({
    candidates: [source(1, 'A', '茶'), source(2, 'A', '发')],
    previous: { candidates: [], excluded: [] },
    content: [],
    registry: { words: [] },
    review: { excluded: [] },
    cantoText: '',
    readingsText: '茶 茶 [cha2] {caa4}\n發 发 [fa1] {faat3}\n髮 发 [fa4] {faat3}',
    cedictText: '茶 茶 [cha2] /tea/CL:杯[bei1]/\n發 发 [fa1] /to send/\n髮 发 [fa4] /hair/',
    wordnetXML: xml([
      ['茶', 'caa4'],
      ['發', 'faat3'],
      ['髮', 'faat3'],
    ]),
    frequency: {},
  });
  assert.equal(result.additions.length, 1);
  assert.equal(result.additions[0].gloss, 'tea');
  assert.match(result.additions[0].glossSource, /mdbg/);
  assert.match(result.deferred[0].reason, /traditional/);
  assert.throws(() => wordnetReadings('<invalid/>'), /No Cantonese Wordnet/);
});
