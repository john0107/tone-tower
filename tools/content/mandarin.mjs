import {
  displayMandarinGloss,
  estimateMandarinTones,
  uniqueReading,
  chooseBetaReferences,
} from './mandarin-beta.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { atomicJSON } from '../lib/json.mjs';
import { parsePinyin } from '../../src/languages/pinyin.js';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const directory = (root) => path.join(root, 'data/content/cmn');
const json = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
};
export const emptyMandarin = () => ({
  version: 2,
  language: 'cmn',
  transcriptionSystem: 'pinyin',
  entries: [],
  pronunciations: [],
  recordings: [],
  references: [],
});
export async function archive(root) {
  const inventory = await json(path.join(root, 'data/audio/collections/cmn/recordings.json'), {
    recordings: [],
  });
  if (!Array.isArray(inventory.recordings)) throw Error('Invalid Mandarin recording archive.');
  return inventory.recordings;
}

export function parseCedict(text, edition = 'v1') {
  if (!['v1', 'v2', 'mixed'].includes(edition))
    throw Error('Choose a CC-CEDICT edition: v1, v2, or mixed.');
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(\S+) (\S+) (\[\[?)(.+?)(\]\]?) \/(.+)\/$/);
    if (!match) throw Error('Malformed CC-CEDICT entry: ' + line.slice(0, 80));
    const [, traditional, simplified, open, reading, close, definitions] = match;
    const v2 = open === '[[';
    if (open.length !== close.length || (edition !== 'mixed' && v2 !== (edition === 'v2')))
      throw Error('CC-CEDICT syntax differs from the selected edition.');
    // Non-Han forms and rhotic suffixes remain dictionary evidence but are not v1 exercises.
    if (!/^[\p{Script=Han}]+$/u.test(traditional + simplified) || /r5(?:\s|$)/.test(reading))
      continue;
    const parts = parsePinyin(reading);
    if (
      !parts ||
      [...traditional].length !== parts.length ||
      [...simplified].length !== parts.length
    )
      continue;
    rows.push({
      id: 'cedict-' + sha256(JSON.stringify([traditional, simplified, reading])).slice(0, 24),
      traditional,
      simplified,
      reading,
      syllables: parts.map((s) => ({ transcription: s.base + s.tone, tone: s.tone })),
      gloss: definitions.split('/').filter(Boolean).join('; '),
      raw: line,
    });
  }
  return rows;
}

export async function importDictionary(root, file, edition = 'v1') {
  const bytes = await readFile(file);
  const raw = file.endsWith('.gz') ? gunzipSync(bytes) : bytes;
  const text = raw.toString('utf8');
  const recordings = await archive(root);
  const texts = new Set(recordings.map((r) => r.sourceText));
  const previous = await json(path.join(directory(root), 'dictionary.json'), null);
  // Keep prior matches when an archive is temporarily smaller; never touch review decisions.
  for (const row of previous?.entries ?? []) {
    texts.add(row.simplified);
    texts.add(row.traditional);
  }
  const entries = parseCedict(text, edition).filter(
    (row) => texts.has(row.simplified) || texts.has(row.traditional),
  );
  const result = {
    version: 1,
    source: {
      name: 'CC-CEDICT',
      url: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict',
      edition,
      sha256: sha256(raw),
      date: text.match(/^#! date=(.+)$/m)?.[1]?.trim() ?? null,
      license: 'CC-BY-SA-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
    entries,
  };
  await mkdir(directory(root), { recursive: true });
  await atomicJSON(path.join(directory(root), 'dictionary.json'), result);
  return {
    matchedDictionaryEntries: entries.length,
    recordings: recordings.length,
    snapshot: result.source,
  };
}

export async function prepareMandarin(root) {
  const dictionary = await json(path.join(directory(root), 'dictionary.json'), null);
  if (!dictionary) throw Error('Import a pinned dictionary first with mandarin:dictionary.');
  const entries = dictionary.entries.map((row) => ({
    id: row.id,
    forms: { default: row.simplified, simplified: row.simplified, traditional: row.traditional },
    gloss: row.gloss,
    dictionarySource: { ...dictionary.source, entryId: row.id, raw: row.raw },
  }));
  const pronunciations = dictionary.entries.map((row) => ({
    id: row.id,
    entryId: row.id,
    kind: row.syllables.length === 1 ? 'syllable' : 'word',
    syllables: row.syllables.map((s, i) => ({
      ...s,
      forms: {
        default: [...row.simplified][i],
        simplified: [...row.simplified][i],
        traditional: [...row.traditional][i],
      },
    })),
  }));
  await atomicJSON(path.join(directory(root), 'entries.json'), { version: 1, entries });
  await atomicJSON(path.join(directory(root), 'pronunciations.json'), {
    version: 1,
    pronunciations,
  });
  return { entries: entries.length, pronunciations: pronunciations.length };
}

export async function reviewQueue(root) {
  const recordings = await archive(root);
  const entries = (await json(path.join(directory(root), 'entries.json'), { entries: [] })).entries;
  const pronunciations = (
    await json(path.join(directory(root), 'pronunciations.json'), { pronunciations: [] })
  ).pronunciations;
  const saved = await json(path.join(directory(root), 'annotations.json'), {
    version: 1,
    annotations: {},
  });
  return recordings.map((recording) => ({
    recordingId: recording.id,
    text: recording.sourceText,
    audio: recording.audio.file,
    speaker: recording.speaker?.name ?? 'Unidentified speaker',
    source: recording.source.pageUrl,
    recordingSha256: recording.audio.sha256,
    candidates: entries
      .filter((e) => Object.values(e.forms).includes(recording.sourceText))
      .map((entry) => ({
        pronunciationId: entry.id,
        forms: entry.forms,
        gloss: entry.gloss,
        dictionarySha256: entry.dictionarySource.sha256,
        syllables: pronunciations.find((p) => p.id === entry.id)?.syllables ?? [],
      })),
    annotation: saved.annotations[recording.id] ?? null,
  }));
}

function validateAnnotation(annotation, item) {
  if (
    !['approved', 'rejected'].includes(annotation.status) ||
    !annotation.reviewer?.trim() ||
    !annotation.reason?.trim() ||
    !Number.isFinite(Date.parse(annotation.reviewedAt))
  )
    throw Error('Review needs a status, reviewer, date, and reason: ' + item.recordingId);
  if (annotation.recordingSha256 !== item.recordingSha256)
    throw Error('Review refers to different audio bytes: ' + item.recordingId);
  if (annotation.status === 'rejected') return;
  const candidate = item.candidates.find((c) => c.pronunciationId === annotation.pronunciationId);
  if (!candidate || candidate.dictionarySha256 !== annotation.dictionarySha256)
    throw Error('Review refers to a missing or changed dictionary candidate: ' + item.recordingId);
  if (
    !Array.isArray(annotation.realizedTones) ||
    annotation.realizedTones.length !== candidate.syllables.length ||
    !annotation.realizedTones.every((t) => [1, 2, 3, 4, 5].includes(t))
  )
    throw Error('Review must annotate every spoken syllable: ' + item.recordingId);
  for (const reference of annotation.references ?? []) {
    if (
      !Number.isInteger(reference.targetIndex) ||
      reference.targetIndex < 0 ||
      annotation.realizedTones[reference.targetIndex] !== reference.tone
    )
      throw Error('Reference must identify a reviewed spoken target: ' + item.recordingId);
    if (reference.tone !== 5 && candidate.syllables.length !== 1)
      throw Error('Tones 1–4 require isolated reference recordings.');
    if (reference.tone === 5 && candidate.syllables.length < 2)
      throw Error('Neutral-tone reference needs word context.');
  }
}

export async function importReviews(root, file) {
  const decisions = await json(file, null);
  if (decisions?.version !== 1 || !decisions.annotations || Array.isArray(decisions.annotations))
    throw Error('Expected a version 1 annotations object.');
  const queue = new Map((await reviewQueue(root)).map((item) => [item.recordingId, item]));
  const previous = await json(path.join(directory(root), 'annotations.json'), {
    version: 1,
    annotations: {},
  });
  for (const [id, annotation] of Object.entries(decisions.annotations)) {
    const item = queue.get(id);
    if (!item) throw Error('Unknown recording in review: ' + id);
    validateAnnotation(annotation, item);
  }
  const result = { version: 1, annotations: { ...previous.annotations, ...decisions.annotations } };
  await atomicJSON(path.join(directory(root), 'annotations.json'), result);
  return { imported: Object.keys(decisions.annotations).length };
}

function validateCorrection(patch, item) {
  if (
    !patch ||
    typeof patch !== 'object' ||
    Array.isArray(patch) ||
    Object.keys(patch).some(
      (key) => !['reason', 'excluded', 'pronunciationId', 'realizedTones'].includes(key),
    ) ||
    typeof patch.reason !== 'string' ||
    !patch.reason.trim()
  )
    throw Error('A correction needs supported fields and a reason: ' + item.recordingId);
  if (patch.excluded !== undefined && typeof patch.excluded !== 'boolean')
    throw Error('Exclusion must be true or false.');
  const candidate = patch.pronunciationId
    ? item.candidates.find((c) => c.pronunciationId === patch.pronunciationId)
    : uniqueReading(item.candidates);
  if (patch.pronunciationId && !candidate)
    throw Error('Unknown corrected pronunciation: ' + item.recordingId);
  if (
    patch.realizedTones !== undefined &&
    (!candidate ||
      !Array.isArray(patch.realizedTones) ||
      patch.realizedTones.length !== candidate.syllables.length ||
      !patch.realizedTones.every((t) => [1, 2, 3, 4, 5].includes(t)))
  )
    throw Error('Corrected tones must match an unambiguous pronunciation: ' + item.recordingId);
}

export async function correctMandarin(root, { recordingId, ...patch }) {
  if (typeof patch.reason !== 'string' || !patch.reason.trim())
    throw Error('A correction needs a reason.');
  const item = (await reviewQueue(root)).find((item) => item.recordingId === recordingId);
  if (!item) throw Error('Unknown recording: ' + recordingId);
  const previous = await json(path.join(directory(root), 'corrections.json'), {
    version: 1,
    recordings: {},
  });
  const correction = {
    ...previous.recordings[recordingId],
    ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
  };
  validateCorrection(correction, item);
  const result = { version: 1, recordings: { ...previous.recordings, [recordingId]: correction } };
  await mkdir(directory(root), { recursive: true });
  await atomicJSON(path.join(directory(root), 'corrections.json'), result);
  return { recordingId, correction };
}

export function coverage(catalog) {
  const playable = catalog.recordings.filter((r) => !r.referenceOnly);
  const byId = new Map(catalog.pronunciations.map((p) => [p.id, p]));
  const singles = playable.filter((r) => byId.get(r.pronunciationId).syllables.length === 1).length;
  const multi = playable.length - singles;
  const hasTone = (r, tone) =>
    r.realizedTones.some((t, i) => t === tone && (r.toneTargets?.includes(i) ?? true));
  const tones = Object.fromEntries(
    [1, 2, 3, 4, 5].map((t) => [t, playable.filter((r) => hasTone(r, t)).length]),
  );
  const referenceTones = new Set(catalog.references.map((r) => r.tone));
  const missing = [];
  if ([1, 2, 3, 4, 5].some((t) => !referenceTones.has(t))) missing.push('tone references');
  if (singles < 20 || multi < 80)
    missing.push('20 single-syllable and 80 multi-syllable recordings');
  if (
    [1, 2, 3, 4].some(
      (t) =>
        !playable.some((r) => byId.get(r.pronunciationId).syllables.length === 1 && hasTone(r, t)),
    )
  )
    missing.push('single-syllable coverage of tones 1–4');
  if (Object.values(tones).some((n) => n === 0)) missing.push('coverage of all spoken tones');
  return { ready: !missing.length, singles, multi, tones, missing };
}

export async function buildMandarinCatalog(root, { reviewedOnly = false } = {}) {
  const result = emptyMandarin();
  const entries = (await json(path.join(directory(root), 'entries.json'), { entries: [] })).entries;
  const pronunciations = (
    await json(path.join(directory(root), 'pronunciations.json'), { pronunciations: [] })
  ).pronunciations;
  const recordings = new Map((await archive(root)).map((r) => [r.id, r]));
  const queue = new Map((await reviewQueue(root)).map((item) => [item.recordingId, item]));
  const decisions = await json(path.join(directory(root), 'annotations.json'), {
    version: 1,
    annotations: {},
  });
  const corrections = await json(path.join(directory(root), 'corrections.json'), {
    version: 1,
    recordings: {},
  });
  if (corrections.version !== 1 || !corrections.recordings || Array.isArray(corrections.recordings))
    throw Error('Invalid Mandarin corrections.');
  const byPronunciation = new Map(pronunciations.map((p) => [p.id, p]));
  const byEntry = new Map(entries.map((e) => [e.id, e]));
  const stats = {
    assumed: 0,
    reviewed: 0,
    ambiguous: 0,
    unmatched: 0,
    excluded: 0,
    unavailable: 0,
  };
  for (const id of Object.keys(decisions.annotations))
    if (!recordings.has(id)) throw Error('Reviewed recording missing from archive: ' + id);
  for (const id of Object.keys(corrections.recordings))
    if (!recordings.has(id)) throw Error('Unknown corrected recording: ' + id);
  for (const [id, row] of recordings) {
    const item = queue.get(id),
      annotation = decisions.annotations[id],
      patch = corrections.recordings[id];
    if (!item) continue;
    if (annotation) validateAnnotation(annotation, item);
    if (patch) validateCorrection(patch, item);
    if (patch?.excluded || annotation?.status === 'rejected') {
      stats.excluded++;
      continue;
    }
    const reviewed = annotation?.status === 'approved';
    if (reviewedOnly && !reviewed) continue;
    let candidate = item.candidates.find(
      (c) => c.pronunciationId === (patch?.pronunciationId ?? annotation?.pronunciationId),
    );
    if (!candidate) candidate = uniqueReading(item.candidates);
    if (!candidate) {
      stats[item.candidates.length ? 'ambiguous' : 'unmatched']++;
      continue;
    }
    const pronunciation = byPronunciation.get(candidate.pronunciationId),
      entry = byEntry.get(pronunciation?.entryId);
    if (!entry || !pronunciation) throw Error('Missing curated reading: ' + id);
    let bytes;
    try {
      bytes = await readFile(path.join(root, row.audio.file));
    } catch (error) {
      if (error.code !== 'ENOENT' || reviewed) throw error;
      stats.unavailable++;
      continue;
    }
    if (bytes.length !== row.audio.bytes || sha256(bytes) !== row.audio.sha256) {
      if (reviewed) throw Error('Reviewed audio failed integrity validation: ' + id);
      stats.unavailable++;
      continue;
    }
    const estimate = estimateMandarinTones(pronunciation, entry);
    const realizedTones =
      patch?.realizedTones ?? (reviewed ? annotation.realizedTones : estimate.realizedTones);
    if (!result.entries.some((e) => e.id === entry.id))
      result.entries.push({
        ...entry,
        fullGloss: entry.gloss,
        gloss: displayMandarinGloss(entry.gloss),
      });
    if (!result.pronunciations.some((p) => p.id === pronunciation.id))
      result.pronunciations.push(pronunciation);
    result.recordings.push({
      id,
      pronunciationId: pronunciation.id,
      audio: row.audio.file,
      realizedTones,
      toneTargets:
        patch?.realizedTones || reviewed ? realizedTones.map((_, i) => i) : estimate.toneTargets,
      toneEvidence: {
        status: patch?.realizedTones ? 'corrected' : reviewed ? 'reviewed' : 'assumed',
        basis:
          patch?.reason ??
          (reviewed
            ? annotation.reason
            : 'Source label, dictionary reading, and common tone sandhi'),
      },
      speakerId: row.speaker?.id,
      author: row.attribution.author,
      source: row.source.pageUrl,
      license: row.attribution.license,
      licenseUrl: row.attribution.licenseUrl,
      conversion: row.audio.processing,
    });
    stats[reviewed ? 'reviewed' : 'assumed']++;
    if (
      reviewed &&
      (!patch?.pronunciationId || patch.pronunciationId === annotation.pronunciationId)
    )
      result.references.push(
        ...(annotation.references ?? [])
          .filter((reference) => realizedTones[reference.targetIndex] === reference.tone)
          .map((reference) => ({ ...reference, recordingId: id })),
      );
  }
  if (!reviewedOnly) chooseBetaReferences(result);
  if (new Set(result.references.map((r) => r.tone)).size !== result.references.length)
    throw Error('Choose one reference per Mandarin tone.');
  result.availability = { ...coverage(result), mode: reviewedOnly ? 'reviewed' : 'beta', ...stats };
  return result;
}

export async function exportReview(root, destination) {
  const queue = await reviewQueue(root);
  const data = JSON.stringify(queue).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mandarin listening review</title>
<style>body{font:16px system-ui;max-width:950px;margin:2em auto;padding:1em;background:#f6f5f0;color:#19293d}article{background:white;padding:1em;margin:1em 0;border:1px solid #bbb}input,select,button{font:inherit;padding:.4em;max-width:100%}label{display:block;margin:.6em 0}audio{width:100%}.note{color:#555}</style>
<h1>Mandarin listening review</h1><p>Listen to each recording. Confirm the dictionary reading and annotate the tones actually heard. Dictionary matching and successful download do not establish pronunciation accuracy. Use 5 for neutral tone. Do not approve uncertain readings.</p>
<label>Reviewer <input id="reviewer" autocomplete="name"></label><label>Find text or speaker <input id="search"></label><button id="previous">Previous</button> <span id="count"></span> <button id="next">Next</button> <button id="save">Export edited reviews</button><p role="status" id="status"></p><main id="items"></main>
<script>const queue=${data};const edits={};let page=0;const q=s=>document.querySelector(s);const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function draw(){const needle=q('#search').value.trim();const rows=queue.filter(r=>!needle||r.text.includes(needle)||r.speaker.includes(needle));page=Math.max(0,Math.min(page,Math.ceil(rows.length/20)-1));q('#count').textContent=(page+1)+' / '+Math.max(1,Math.ceil(rows.length/20))+' · '+rows.length+' recordings';q('#items').innerHTML=rows.slice(page*20,page*20+20).map(r=>{const a=edits[r.recordingId]||r.annotation||{};return '<article data-id="'+r.recordingId+'"><h2>'+escape(r.text)+' · '+escape(r.speaker)+'</h2><a target="_blank" rel="noopener" href="'+escape(r.source)+'">Original source</a><audio controls preload="none" src="../../'+escape(r.audio)+'"></audio><label>Decision <select data-field="status"><option value="">Unreviewed</option><option '+(a.status==='approved'?'selected':'')+' value="approved">Approve</option><option '+(a.status==='rejected'?'selected':'')+' value="rejected">Reject</option></select></label><label>Dictionary reading <select data-field="pronunciationId"><option value="">Choose a reading</option>'+r.candidates.map(c=>'<option value="'+c.pronunciationId+'" '+(a.pronunciationId===c.pronunciationId?'selected':'')+'>'+escape(c.syllables.map(s=>s.transcription).join(' ')+' · '+c.gloss)+'</option>').join('')+'</select></label><label>Spoken tones, in order <input data-field="tones" placeholder="2 3" value="'+escape((a.realizedTones||[]).join(' '))+'"></label><label>Reference target indices (zero based), only for reference-quality clips <input data-field="references" placeholder="e.g. 0" value="'+escape((a.references||[]).map(r=>r.targetIndex).join(' '))+'"></label><label>Review reason <input data-field="reason" value="'+escape(a.reason||'')+'"></label>'+(r.candidates.length?'':'<p class="note">No aligned dictionary candidate. Leave unreviewed or reject.</p>')+'</article>'}).join('');}
q('#items').addEventListener('change',e=>{const card=e.target.closest('article');if(!card)return;const r=queue.find(r=>r.recordingId===card.dataset.id);const value=f=>card.querySelector('[data-field="'+f+'"]').value;const c=r.candidates.find(c=>c.pronunciationId===value('pronunciationId'));const tones=value('tones').trim().split(/\\s+/).filter(Boolean).map(Number);edits[r.recordingId]={status:value('status'),pronunciationId:c?.pronunciationId,dictionarySha256:c?.dictionarySha256,recordingSha256:r.recordingSha256,realizedTones:tones,references:value('references').trim().split(/\\s+/).filter(Boolean).map(Number).map(i=>({targetIndex:i,tone:tones[i]})),reason:value('reason')};});
q('#previous').onclick=()=>{page--;draw()};q('#next').onclick=()=>{page++;draw()};q('#search').oninput=()=>{page=0;draw()};q('#save').onclick=()=>{if(!q('#reviewer').value.trim()){q('#status').textContent='Enter a reviewer name.';return}const annotations=Object.fromEntries(Object.entries(edits).filter(([id,a])=>a.status).map(([id,a])=>[id,{...a,reviewer:q('#reviewer').value.trim(),reviewedAt:new Date().toISOString()}]));const blob=new Blob([JSON.stringify({version:1,annotations},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mandarin-reviews.json';a.click();URL.revokeObjectURL(url);q('#status').textContent='Exported '+Object.keys(annotations).length+' decisions. Import the file with mandarin:import-review.'};draw();</script></html>`;
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, html);
  return { file: destination, recordings: queue.length };
}
