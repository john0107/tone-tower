import { open, readFile, mkdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { audioPaths } from './paths.mjs';

const readOwner = async (file) => JSON.parse(await readFile(file, 'utf8'));
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) throw Error('Invalid audio lock owner.');
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

export async function withAudioLock(task, root = process.cwd()) {
  const paths = audioPaths(root);
  await mkdir(paths.cache, { recursive: true });
  const inherited = process.env.TONE_TOWER_AUDIO_LOCK;
  if (inherited) {
    const owner = await readOwner(paths.lock);
    if (owner.token !== inherited || !alive(owner.pid))
      throw Error('Invalid inherited audio lock.');
    return task(owner);
  }
  const owner = { pid: process.pid, token: randomUUID() };
  let lock;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      lock = await open(paths.lock, 'wx');
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const previous = await readOwner(paths.lock);
      if (alive(previous.pid))
        throw Error(
          'Another audio operation is running (PID ' + previous.pid + '). Stop it first.',
        );
      // Serialize stale-lock recovery so concurrent starters cannot delete a new owner's lock.
      const recoveryPath = paths.lock + '.recovery';
      const recovery = await open(recoveryPath, 'wx');
      try {
        const current = await readOwner(paths.lock).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
          return null;
        });
        if (current && current.token === previous.token && !alive(current.pid))
          await unlink(paths.lock);
      } finally {
        await recovery.close();
        await unlink(recoveryPath);
      }
    }
  }
  if (!lock) throw Error('Could not acquire the audio operation lock. Try again.');
  try {
    await lock.writeFile(JSON.stringify(owner));
    await lock.close();
    return await task(owner);
  } finally {
    await lock.close().catch(() => {});
    const current = await readOwner(paths.lock);
    if (current.token === owner.token) await unlink(paths.lock);
  }
}
