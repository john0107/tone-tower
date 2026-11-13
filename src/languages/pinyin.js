// Orthographic Pinyin syllables. Parsing never removes the umlaut with tone marks.
const syllables = new Set(
  `a ai an ang ao e ei en eng er o ou
ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu
pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu
ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu
fa fan fang fei fen feng fo fou fu
da dai dan dang dao de dei den deng di dia dian diao die ding diu dong dou du duan dui dun duo
ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo
na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nuo nü nüe
la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu long lou lu luan lun luo lü lüe
ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo
ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo
ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo
ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun
qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun
xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun
zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo
cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo
sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo
ran rang rao re ren reng ri rong rou ru ruan rui run ruo
za zai zan zang zao ze zei zen zeng zi zong zou zu zuan zui zun zuo
ca cai can cang cao ce cen ceng ci cong cou cu cuan cui cun cuo
sa sai san sang sao se sen seng si song sou su suan sui sun suo
ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun
wa wai wan wang wei wen weng wo wu m n ng hm hng ê`.split(/\s+/),
);
const marks = { '\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4 };
const accents = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };

function units(value) {
  const result = [];
  for (const ch of String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/u:/g, 'ü')
    .replace(/v/g, 'ü')
    .normalize('NFD')) {
    if (ch === '\u0308') {
      if (result.at(-1)?.letter !== 'u') return null;
      result.at(-1).letter = 'ü';
    } else if (marks[ch]) {
      if (!result.length || result.at(-1).tone) return null;
      result.at(-1).tone = marks[ch];
    } else if (ch === '\u0302' && result.at(-1)?.letter === 'e') {
      result.at(-1).letter = 'ê';
    } else if (/[a-züê0-5\s'’\-]/u.test(ch)) result.push({ letter: ch });
    else return null;
  }
  return result;
}

export function parsePinyin(value, { fragments = false } = {}) {
  const input = units(value);
  if (!input?.length) return null;
  const output = [];
  let part = [];
  function flush(digit) {
    if (!part.length) return false;
    let offset = 0;
    while (offset < part.length) {
      let end = part.length;
      if (!fragments) {
        while (
          end > offset &&
          !syllables.has(
            part
              .slice(offset, end)
              .map((u) => u.letter)
              .join(''),
          )
        )
          end--;
        if (end === offset) return false;
      }
      const segment = part.slice(offset, end);
      const tones = segment.filter((u) => u.tone).map((u) => u.tone);
      if (
        tones.length > 1 ||
        (digit !== undefined && end === part.length && tones.length && tones[0] !== digit)
      )
        return false;
      output.push({
        base: segment.map((u) => u.letter).join(''),
        tone: tones[0] ?? (end === part.length ? digit : undefined) ?? 5,
      });
      offset = end;
    }
    part = [];
    return true;
  }
  for (const unit of input) {
    if (/^[0-5]$/.test(unit.letter)) {
      if (!flush(Number(unit.letter) || 5)) return null;
    } else if (/^[\s'’]$/.test(unit.letter) || (unit.letter === '-' && !fragments)) {
      if (part.length && !flush()) return null;
    } else part.push(unit);
  }
  if (part.length && !flush()) return null;
  return output.length ? output : null;
}

export function formatPinyin(value) {
  const parsed = parsePinyin(value);
  if (!parsed) return String(value ?? '');
  return parsed
    .map(({ base, tone }) => {
      if (tone === 5) return base;
      let index = base.indexOf('a');
      if (index < 0) index = base.indexOf('e');
      if (index < 0 && base.includes('ou')) index = base.indexOf('o');
      if (index < 0)
        for (let i = base.length - 1; i >= 0; i--)
          if (accents[base[i]]) {
            index = i;
            break;
          }
      return index < 0
        ? base + tone
        : base.slice(0, index) + accents[base[index]][tone - 1] + base.slice(index + 1);
    })
    .join(' ');
}

export function pinyinSpelling(value, focus = 'full') {
  const parsed = parsePinyin(value);
  if (parsed?.length !== 1) throw Error('Expected one Pinyin syllable.');
  const { base, tone } = parsed[0];
  // y/w are orthographic onsets here; the guide explains their spelling role.
  const initial = base.match(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])/)?.[0] || '';
  return (
    (focus === 'initials'
      ? initial || '-'
      : focus === 'finals'
        ? base.slice(initial.length)
        : base) + tone
  );
}

export const pinyin = {
  parse: parsePinyin,
  format: formatPinyin,
  withoutTones: (value) =>
    parsePinyin(value)
      ?.map((s) => s.base)
      .join(' ') ?? '',
  practiceSpelling: pinyinSpelling,
  normalizeAnswer(value, full = false) {
    const parsed = parsePinyin(value);
    return parsed?.map((s) => s.base + (full ? s.tone : '')).join(' ') ?? null;
  },
  evaluate(value, expected, full = false, focus = 'full') {
    const actual = Array.isArray(value) ? value.join(' ') : String(value ?? '');
    if (!actual.trim()) return null;
    const options = { fragments: focus !== 'full' };
    const a = parsePinyin(actual, options),
      b = parsePinyin(expected.join(' '), options);
    return Boolean(
      a &&
      b &&
      a.length === b.length &&
      a.every((s, i) => s.base === b[i].base && (!full || s.tone === b[i].tone)),
    );
  },
};
