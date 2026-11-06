import { spawn, spawnSync } from 'node:child_process';
import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
await mkdir('.audio-import-cache', { recursive: true });
const lockPath = '.audio-import-cache/downloader.lock';
try {
  const owner = Number(await readFile(lockPath, 'utf8'));
  if (owner > 0) {
    try {
      process.kill(owner, 0);
      throw Error('Another downloader is already running. Close it first.');
    } catch (e) {
      if (e.code !== 'ESRCH') throw e;
    }
  }
  await unlink(lockPath);
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const lock = await open(lockPath, 'wx');
await lock.writeFile(String(process.pid));
await lock.close();
let child,
  stopping = false,
  wake;
const stop = () => {
  stopping = true;
  child?.kill('SIGINT');
  wake?.();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const log = createWriteStream('.audio-import-cache/downloader.log', { flags: 'a' });
const say = (message) => {
  const line = '[' + new Date().toLocaleString() + '] ' + message + '\n';
  process.stdout.write(line);
  log.write(line);
};
try {
  for (const executable of ['ffmpeg', 'ffprobe']) {
    const result = spawnSync(executable, ['-version'], { stdio: 'ignore' });
    if (result.error || result.status !== 0)
      throw Error(
        executable + ' is required on PATH. Install FFmpeg before running this downloader.',
      );
  }
  say('Downloading the reviewed queue. Ctrl+C stops safely; run this again to resume.');
  say('Keep the computer awake and this window open. No Codex session is needed.');
  let failures = 0;
  while (!stopping) {
    const code = await new Promise((resolve) => {
      child = spawn(
        process.execPath,
        ['tools/audio/import-curated.mjs', '--all', '--batch', '100', ...process.argv.slice(2)],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      child.stdout.on('data', (data) => {
        process.stdout.write(data);
        log.write(data);
      });
      child.stderr.on('data', (data) => {
        process.stderr.write(data);
        log.write(data);
      });
      child.once('error', (error) => {
        say(error.message);
        resolve(1);
      });
      child.once('close', resolve);
    });
    child = null;
    if (stopping) break;
    if (code === 0) {
      say('Queue finished. Completed recordings and credits are saved in content.json.');
      break;
    }
    const delay = Math.min(600000, 60000 * 2 ** Math.min(failures++, 4));
    say(
      'Import interrupted. Retrying in ' +
        Math.round(delay / 60000) +
        ' minute(s). Saved Commons cooldowns will also be honored.',
    );
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, delay);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    wake = null;
  }
  if (stopping) say('Stopped. Progress is saved. Run this same command to resume.');
} catch (e) {
  say(e.message);
  process.exitCode = 1;
} finally {
  log.end();
  await unlink(lockPath).catch(() => {});
}
