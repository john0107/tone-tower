import {readFile, writeFile, rename, stat} from 'node:fs/promises';
import path from 'node:path';

const WORD_FIELDS = ['character','jyutping','gloss','syllables','dictionarySource','glossSource','metadata'];
const RECORDING_FIELDS = ['audio','anchor','source','author','license','licenseUrl','conversion','originalSha1','title'];
const pick = (value, fields) => Object.fromEntries(fields.filter(key => value[key] !== undefined).map(key => [key,value[key]]));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
export const signature = word => JSON.stringify([word.character.normalize('NFC'),word.jyutping.trim().toLowerCase().replace(/\s+/g,' ')]);
const normalizedWord = row => ({...pick(row, WORD_FIELDS), syllables:row.syllables || [{character:row.character,jyutping:row.jyutping,tone:row.tone}]});
export const emptyRegistry = () => ({version:1,words:[],recordingWords:{}});
export const emptyCorrections = () => ({version:1,words:{},recordings:{}});

export function validateWord(word) {
  if (!nonempty(word.id) || !nonempty(word.character) || !nonempty(word.gloss) || !nonempty(word.jyutping)) throw Error('Incomplete word ' + word.id);
  if (!Array.isArray(word.syllables) || !word.syllables.length || word.syllables.some(s => !nonempty(s.character) || !/^[a-z]+[1-6]$/.test(s.jyutping) || s.tone !== Number(s.jyutping.at(-1)))) throw Error('Invalid syllables for ' + word.id);
  if (word.syllables.map(s => s.character).join('') !== word.character || word.syllables.map(s => s.jyutping).join(' ') !== word.jyutping) throw Error('Syllable alignment differs for ' + word.id);
  if (word.metadata !== undefined && !object(word.metadata)) throw Error('Invalid metadata for ' + word.id);
}

function validateRegistry(registry) {
  if (registry?.version !== 1 || !Array.isArray(registry.words) || !object(registry.recordingWords)) throw Error('Unsupported words.json schema.');
  const ids = new Set();
  for (const word of registry.words) {
    validateWord(word);
    if (ids.has(word.id)) throw Error('Duplicate word ID ' + word.id);
    ids.add(word.id);
  }
  for (const [recordingId,wordId] of Object.entries(registry.recordingWords)) {
    if (!nonempty(recordingId) || !ids.has(wordId)) throw Error('Unknown word reference for ' + recordingId);
  }
}

// Existing associations are authoritative. New imports with matching characters
// and readings join the existing word; otherwise the first recording seeds an ID.
// IDs are persisted, never recomputed when a label or pronunciation is corrected.
export function syncRegistry(imported, previous=emptyRegistry()) {
  validateRegistry(previous);
  const registry = structuredClone(previous);
  const bySignature = new Map(registry.words.map(word => [signature(word),word.id]));
  const ids = new Set(registry.words.map(word => word.id));
  const recordings = new Set();
  for (const row of imported) {
    if (!nonempty(row.id) || recordings.has(row.id)) throw Error('Missing or duplicate recording ID ' + row.id);
    recordings.add(row.id);
    if (registry.recordingWords[row.id]) continue;
    const word = normalizedWord(row);
    validateWord({...word,id:row.id});
    const key = signature(word);
    let wordId = bySignature.get(key);
    if (!wordId) {
      const base = 'word-' + row.id;
      wordId = base;
      for (let suffix=2; ids.has(wordId); suffix++) wordId = base + '-' + suffix;
      registry.words.push({id:wordId,...word});
      ids.add(wordId); bySignature.set(key,wordId);
    }
    registry.recordingWords[row.id] = wordId;
  }
  return registry;
}

function checkPatch(patch, allowed, id) {
  if (!object(patch) || Object.keys(patch).some(key => !allowed.includes(key))) throw Error('Unknown correction field for ' + id);
  if (!nonempty(patch.reason)) throw Error('Correction needs a reason for ' + id);
}

function validateRecording(recording) {
  if (!/^audio\/[A-Za-z0-9._-]+\.mp3$/.test(recording.audio)) throw Error('Invalid audio path for ' + recording.id);
  for (const field of ['source','author','license','licenseUrl','conversion']) if (!nonempty(recording[field])) throw Error('Missing ' + field + ' for ' + recording.id);
  for (const field of ['source','licenseUrl']) {
    let url; try {url = new URL(recording[field]);} catch {throw Error('Invalid ' + field + ' for ' + recording.id);}
    if (!['http:','https:'].includes(url.protocol)) throw Error('Invalid ' + field + ' for ' + recording.id);
  }
  if (recording.anchor !== undefined && typeof recording.anchor !== 'boolean') throw Error('Invalid anchor for ' + recording.id);
}

export function assembleCatalog(imported, registry, corrections=emptyCorrections()) {
  validateRegistry(registry);
  if (corrections?.version !== 1 || !object(corrections.words) || !object(corrections.recordings)) throw Error('Unsupported audio-corrections.json schema.');
  const words = new Map(registry.words.map(word => [word.id,structuredClone(word)]));
  const recordingIds = new Set(imported.map(row => row.id));
  if (recordingIds.size !== imported.length) throw Error('Duplicate recording IDs.');
  for (const [id,patch] of Object.entries(corrections.words)) {
    if (!words.has(id)) throw Error('Unknown word correction ' + id);
    checkPatch(patch,[...WORD_FIELDS,'reason'],id);
    const word = {...words.get(id),...pick(patch,WORD_FIELDS)};
    validateWord(word); words.set(id,word);
  }
  for (const [id,patch] of Object.entries(corrections.recordings)) {
    // Registry retains IDs of retired recordings, allowing later re-downloads.
    if (!recordingIds.has(id) && !registry.recordingWords[id]) throw Error('Unknown recording correction ' + id);
    checkPatch(patch,['wordId','excluded','reason',...RECORDING_FIELDS],id);
    if (patch.excluded !== undefined && typeof patch.excluded !== 'boolean') throw Error('Invalid exclusion for ' + id);
    if (patch.wordId !== undefined && !words.has(patch.wordId)) throw Error('Unknown corrected word for ' + id);
  }
  const recordings = [];
  for (const row of imported) {
    const patch = corrections.recordings[row.id] || {};
    if (patch.excluded) continue;
    const wordId = patch.wordId || registry.recordingWords[row.id];
    if (!words.has(wordId)) throw Error('Unknown word for ' + row.id);
    const recording = {id:row.id,wordId,...pick(row,RECORDING_FIELDS),...pick(patch,RECORDING_FIELDS)};
    validateRecording(recording); recordings.push(recording);
  }
  const usedWords = new Set(recordings.map(row => row.wordId));
  return {version:1,words:[...words.values()].filter(word => usedWords.has(word.id)),recordings};
}

export async function atomicJSON(file, value) {
  const text = JSON.stringify(value,null,2) + '\n';
  if (await readFile(file,'utf8').catch(error => {if (error.code !== 'ENOENT') throw error; return null;}) === text) return;
  const temporary = file + '.tmp-' + process.pid;
  await writeFile(temporary,text); await rename(temporary,file);
}

async function optionalJSON(file, fallback) {
  try {return JSON.parse(await readFile(file,'utf8'));}
  catch (error) {if (error.code === 'ENOENT') return fallback(); throw error;}
}

export async function buildCatalog(root=process.cwd()) {
  const imported = JSON.parse(await readFile(path.join(root,'content.json'),'utf8'));
  if (!Array.isArray(imported)) throw Error('Expected an imported recording array.');
  const previous = await optionalJSON(path.join(root,'words.json'),emptyRegistry);
  const corrections = JSON.parse(await readFile(path.join(root,'audio-corrections.json'),'utf8'));
  const registry = syncRegistry(imported,previous);
  const catalog = assembleCatalog(imported,registry,corrections);
  await Promise.all(catalog.recordings.map(async row => {
    const info = await stat(path.join(root,row.audio)).catch(error => {throw Error('Missing audio for ' + row.id + ': ' + error.message);});
    if (!info.isFile() || info.size < 1000) throw Error('Empty or invalid audio for ' + row.id);
  }));
  const anchors = catalog.recordings.filter(row => row.anchor);
  const wordMap = new Map(catalog.words.map(word => [word.id,word]));
  const anchorTones = anchors.map(row => wordMap.get(row.wordId).syllables[0].tone);
  if (anchors.length !== 6 || new Set(anchorTones).size !== 6) throw Error('Expected six distinct tone reference recordings.');
  await atomicJSON(path.join(root,'words.json'),registry);
  // Compact generated output; full source records and corrections remain readable.
  const destination = path.join(root,'catalog.json');
  const temporary = destination + '.tmp-' + process.pid;
  await writeFile(temporary,JSON.stringify(catalog)+'\n'); await rename(temporary,destination);
  return catalog;
}
