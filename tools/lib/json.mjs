import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

async function replaceFile(temporary, file) {
  // Windows readers (including scanners and editors) can briefly prevent a
  // replacement. Keep the old file intact while retrying the atomic rename.
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temporary, file);
      return;
    } catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 8) throw error;
      await setTimeout(Math.min(50 * 2 ** attempt, 1000));
    }
  }
}

export async function readJSON(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined)
      return typeof fallback === 'function' ? fallback() : structuredClone(fallback);
    throw error;
  }
}

export async function atomicJSON(file, value) {
  const text = JSON.stringify(value, null, 2) + '\n';
  await atomicText(file, text);
}

export async function atomicText(file, text) {
  if (
    (await readFile(file, 'utf8').catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    })) === text
  )
    return;
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp-' + process.pid;
  try {
    await writeFile(temporary, text);
    await replaceFile(temporary, file);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
