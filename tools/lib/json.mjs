import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

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
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
