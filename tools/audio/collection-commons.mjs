import { createHash } from 'node:crypto';

export class RecordingReview extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const review = (code, message) => {
  throw new RecordingReview(code, message);
};

export function plainText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => {
      if (entity.startsWith('#')) {
        const code =
          entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
      }
      return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[entity.toLowerCase()];
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// Filename labels are discovery evidence, never authoritative speaker identities.
export function candidateFromTitle(item, config) {
  if (!Number.isSafeInteger(item.pageid) || item.pageid < 1) return null;
  let match = /^File:LL-Q\d+ \(([a-z-]+)\)-(.+)-([^\-]+)\.(wav|ogg|oga|flac|mp3|opus)$/iu.exec(
    item.title,
  );
  if (!match) {
    const legacy = /^File:LL-Q9192—([^—]+)—(.+)\.(wav|ogg|oga|flac|mp3|opus)$/u.exec(item.title);
    if (legacy) match = [legacy[0], 'cmn', legacy[1], legacy[2], legacy[3]];
  }
  if (!match || match[1] !== config.language) return null;
  const text = match[3].normalize('NFC');
  if (!/^\p{Script=Han}+$/u.test(text) || [...text].length > config.selection.maxWrittenCharacters)
    return null;
  return { pageid: item.pageid, title: item.title, text, speakerLabel: match[2] };
}

export function balancedCandidates(items, config) {
  const groups = new Map();
  for (const item of items) {
    const candidate = candidateFromTitle(item, config);
    if (!candidate) continue;
    if (!groups.has(candidate.speakerLabel)) groups.set(candidate.speakerLabel, []);
    groups.get(candidate.speakerLabel).push(candidate);
  }
  const queues = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, rows]) => rows.sort((a, b) => a.pageid - b.pageid));
  const result = [];
  for (let offset = 0; queues.some((rows) => offset < rows.length); offset++)
    for (const rows of queues) if (rows[offset]) result.push(rows[offset]);
  return result;
}

function creditedPerson(html, role, pageUrl) {
  const part = new RegExp('<li[^>]*>\\s*' + role + ':\\s*([\\s\\S]*?)</li>', 'i').exec(html)?.[1];
  if (!part) return undefined;
  const name = plainText(part);
  if (!name) return undefined;
  const href = /<a\b[^>]*\bhref=["']([^"']+)["']/i.exec(part)?.[1];
  const person = { name, evidence: pageUrl };
  if (href) {
    let url;
    try {
      url = new URL(href.replaceAll('&amp;', '&'), pageUrl);
    } catch {
      return person;
    }
    const id = /^\/wiki\/(Q\d+)$/.exec(url.pathname)?.[1];
    if (url.hostname === 'lingualibre.org' && id) {
      person.id = 'lingualibre-' + id;
      person.identityUrl = 'https://lingualibre.org/wiki/' + id;
    }
  }
  return person;
}

export function selectedLicense(meta, allowed) {
  const name = plainText(meta.LicenseShortName?.value);
  let url;
  try {
    url = new URL(meta.LicenseUrl?.value);
  } catch {
    review('license', 'Missing or invalid recording licence URL');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.hostname !== 'creativecommons.org' ||
    url.username ||
    url.password
  )
    review('license', 'Unrecognized recording licence URL');
  const choices = [
    [
      'CC0',
      'CC0-1.0',
      /^\/publicdomain\/zero\/1\.0(?:\/|$)/,
      'https://creativecommons.org/publicdomain/zero/1.0/',
    ],
    [
      'CC BY 4.0',
      'CC-BY-4.0',
      /^\/licenses\/by\/4\.0(?:\/|$)/,
      'https://creativecommons.org/licenses/by/4.0/',
    ],
    [
      'CC BY-SA 4.0',
      'CC-BY-SA-4.0',
      /^\/licenses\/by-sa\/4\.0(?:\/|$)/,
      'https://creativecommons.org/licenses/by-sa/4.0/',
    ],
  ];
  const choice = choices.find(
    ([label, id, pattern]) => name === label && allowed.includes(id) && pattern.test(url.pathname),
  );
  if (!choice) review('license', 'Recording licence needs review: ' + name);
  return { id: choice[1], url: choice[3] };
}

export function inspectRecording(page, candidate, config) {
  const info = page?.imageinfo?.[0];
  if (!info || page.missing !== undefined) review('missing-source', 'Commons source is missing');
  const warnings = (page.templates || [])
    .map((row) => row.title)
    .filter((title) =>
      /^Template:(?:Delete|Speedydelete|Copyvio|No permission since|No license since|No source since|Disputed)(?:$|[ /])/i.test(
        title,
      ),
    );
  if (warnings.length) review('source-warning', 'Commons source warning: ' + warnings.join(', '));
  if (
    !/^audio\//.test(info.mime || '') ||
    !['AUDIO', 'UNKNOWN'].includes(info.mediatype || 'AUDIO')
  )
    review('media', 'Source is not an audio file');
  if (
    !Number.isSafeInteger(info.size) ||
    info.size < 1 ||
    info.size > config.selection.maxOriginalBytes
  )
    review('size', 'Original file size is outside the collection limit');
  if (!/^[a-f0-9]{40}$/.test(info.sha1 || '') || !info.timestamp)
    review('source-version', 'Missing source checksum or timestamp');
  const media = new URL(info.url);
  const pageUrl = new URL(info.descriptionurl);
  if (
    media.protocol !== 'https:' ||
    media.hostname !== 'upload.wikimedia.org' ||
    pageUrl.protocol !== 'https:' ||
    pageUrl.hostname !== 'commons.wikimedia.org'
  )
    review('source-url', 'Unexpected Commons source URL');
  const meta = info.extmetadata || {};
  const license = selectedLicense(meta, config.selection.licenses);
  const authorHtml = meta.Artist?.value || '';
  const author = plainText(authorHtml);
  if (!author) review('attribution', 'Missing recording creator credit');
  return {
    id: 'commons-' + candidate.pageid,
    language: config.language,
    sourceText: candidate.text,
    speaker: creditedPerson(authorHtml, 'Speaker', pageUrl.href),
    recorder: creditedPerson(authorHtml, 'Recorder', pageUrl.href),
    attribution: { author, license: license.id, licenseUrl: license.url },
    source: {
      provider: 'commons',
      pageid: candidate.pageid,
      title: page.title,
      pageUrl: pageUrl.href,
      fileUrl: media.href,
      fileTimestamp: info.timestamp,
      uploader: info.user || undefined,
      licenseEvidence: {
        shortName: meta.LicenseShortName?.value,
        url: meta.LicenseUrl?.value,
        template: meta.License?.value,
        usageTerms: meta.UsageTerms?.value,
        attribution: meta.Attribution?.value,
        authorHtml,
      },
    },
    original: { sha1: info.sha1, bytes: info.size, mime: info.mime },
    reviewStatus: 'unreviewed',
  };
}

export const configHash = (config) =>
  createHash('sha256').update(JSON.stringify(config)).digest('hex');
export function commonsQuery(parameters) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', format: 'json', ...parameters });
  return url;
}
