import { mkdir, writeFile, readFile } from 'node:fs/promises';
await mkdir('audio', { recursive: true });
// Use only dictionary-attested readings below; never infer a word from a generated tone series.
const entries = [
  ['si1', '詩', 'poem'],
  ['wai1', '威', 'prestige'],
  ['ji1', '衣', 'clothes'],
  ['man1', '蚊', 'mosquito'],
  ['jam1', '音', 'sound'],
  ['maa1', '媽', 'mother'],
  ['hou2', '好', 'good'],
  ['wai2', '毀', 'destroy'],
  ['ji2', '椅', 'chair'],
  ['man2', '吻', 'kiss'],
  ['jam2', '飲', 'drink'],
  ['co2', '楚', 'clear'],
  ['co3', '錯', 'wrong'],
  ['wai3', '餵', 'feed'],
  ['ji3', '意', 'idea'],
  ['man3', '抆', 'wipe'],
  ['jam3', '蔭', 'shade'],
  ['se3', '卸', 'unload'],
  ['maa4', '麻', 'hemp'],
  ['wai4', '圍', 'surround'],
  ['ji4', '兒', 'child'],
  ['man4', '文', 'writing'],
  ['jam4', '吟', 'recite'],
  ['se4', '蛇', 'snake'],
  ['maa5', '馬', 'horse'],
  ['wai5', '偉', 'great'],
  ['ji5', '耳', 'ear'],
  ['man5', '敏', 'agile'],
  ['se5', '社', 'society'],
  ['co5', '坐', 'sit'],
  ['maa6', '罵', 'scold'],
  ['wai6', '為', 'for'],
  ['ji6', '二', 'two'],
  ['man6', '問', 'ask'],
  ['jam6', '任', 'appoint'],
  ['se6', '射', 'shoot'],
];
const anchors = Array.from('夫虎副扶婦父', (character, i) => ({
  jyutping: 'fu' + (i + 1),
  character,
  gloss: ['husband', 'tiger', 'deputy', 'support', 'woman', 'father'][i],
}));
let manifest = [];
try {
  manifest = JSON.parse(await readFile('content.json', 'utf8'));
} catch {}
for (const item of [
  ...entries.map(([jyutping, character, gloss]) => ({ jyutping, character, gloss })),
  ...anchors,
]) {
  const jp = item.jyutping;
  if (manifest.some((w) => w.id === jp)) {
    console.log('CACHED', jp);
    continue;
  }
  await new Promise((r) => setTimeout(r, 6000));
  const legacy = jp
    .replace(/^z/, 'j')
    .replace(/^c/, 'ch')
    .replace(/^j(?!i|a|e|o|u)/, 'y')
    .replace(/eoi/, 'eui')
    .replace(/eo/, 'eu');
  const names = [
    jp,
    legacy,
    jp.replace(/^j/, 'y'),
    jp.replace(/^c/, 'ch'),
    jp.replace(/^j/, 'y').replace(/^maa/, 'ma'),
  ];
  let info;
  for (const name of [...new Set(names)]) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      titles: 'File:Yue-' + name + '.ogg',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
    });
    const r = await fetch(url, {
      headers: { 'User-Agent': 'TwoDoors/1.0 educational local prototype' },
    });
    if (!r.ok) throw Error('API ' + r.status);
    const j = await r.json();
    info = Object.values(j.query.pages)[0]?.imageinfo?.[0];
    if (info) break;
  }
  if (!info) {
    console.log('MISSING', jp);
    continue;
  }
  const meta = info.extmetadata;
  const license = meta.LicenseShortName?.value;
  if (!license?.startsWith('CC BY') && !license?.includes('Public domain'))
    throw Error('Review licence ' + jp + ' ' + license);
  const clean = new URL(info.url);
  clean.search = '';
  const mp3url =
    clean.href.replace('/commons/', '/commons/transcoded/') +
    '/' +
    clean.pathname.split('/').at(-1) +
    '.mp3';
  let response;
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(mp3url);
    if (response.status !== 429) break;
    console.log('COOLDOWN', jp, response.headers.get('retry-after'));
    await new Promise((r) =>
      setTimeout(r, Math.max(60000, Number(response.headers.get('retry-after') || 0) * 1000)),
    );
  }
  const bytes = await response.arrayBuffer();
  if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
    console.log('FAILED', jp, response.status);
    continue;
  }
  await writeFile('audio/' + jp + '.mp3', Buffer.from(bytes));
  manifest.push({
    ...item,
    id: jp,
    tone: Number(jp.at(-1)),
    audio: 'audio/' + jp + '.mp3',
    anchor: jp.startsWith('fu'),
    source: info.descriptionurl,
    author: meta.Artist?.value.replace(/<[^>]*>/g, ''),
    license,
    licenseUrl: meta.LicenseUrl?.value,
    conversion: 'Wikimedia MP3 derivative; pronunciation unchanged.',
  });
  console.log('OK', jp);
  await writeFile('content.json', JSON.stringify(manifest, null, 2));
}
