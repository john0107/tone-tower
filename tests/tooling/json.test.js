import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { atomicJSON, readJSON } from '../../tools/lib/json.mjs';

test('atomic JSON replacement retries temporary locks while preserving the previous file', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'tone-tower-json-'));
  const file = path.join(dir, 'content.json');
  const rename = fs.rename;
  try {
    await atomicJSON(file, { saved: 1 });
    let attempts = 0;
    fs.rename = async (from, to) => {
      assert.deepEqual(await readJSON(file), { saved: 1 });
      const code = ['EPERM', 'EACCES', 'EBUSY'][attempts++];
      if (code) throw Object.assign(Error('Temporary file lock'), { code });
      return rename(from, to);
    };
    syncBuiltinESMExports();
    await atomicJSON(file, { saved: 2 });
    assert.equal(attempts, 4);
    assert.deepEqual(await readJSON(file), { saved: 2 });
    assert.deepEqual(await fs.readdir(dir), ['content.json']);
  } finally {
    fs.rename = rename;
    syncBuiltinESMExports();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('atomic JSON replacement fails immediately on unrelated errors without changing the previous file', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'tone-tower-json-'));
  const file = path.join(dir, 'content.json');
  const rename = fs.rename;
  try {
    await atomicJSON(file, { saved: 1 });
    let attempts = 0;
    fs.rename = async () => {
      attempts++;
      throw Object.assign(Error('Disk error'), { code: 'EIO' });
    };
    syncBuiltinESMExports();
    await assert.rejects(atomicJSON(file, { saved: 2 }), { code: 'EIO' });
    assert.equal(attempts, 1);
    assert.deepEqual(await readJSON(file), { saved: 1 });
    assert.deepEqual(await fs.readdir(dir), ['content.json']);
  } finally {
    fs.rename = rename;
    syncBuiltinESMExports();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
