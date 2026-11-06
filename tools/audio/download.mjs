import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { audioPaths } from './paths.mjs';
import { withAudioLock } from './lock.mjs';

export async function runDownloader({
  root = fileURLToPath(new URL('../../', import.meta.url)),
  args = process.argv.slice(2),
} = {}) {
  return withAudioLock(async (owner) => {
    const paths = audioPaths(root);
    let child,
      stopping = false,
      wake;
    const stop = () => {
      stopping = true;
      if (child?.connected) child.send({ type: 'stop' });
      wake?.();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    const log = createWriteStream(paths.log, { flags: 'a' });
    const say = (message) => {
      const line = '[' + new Date().toLocaleString() + '] ' + message + '\n';
      process.stdout.write(line);
      log.write(line);
    };
    try {
      for (const executable of args.includes('--export-only') ? [] : ['ffmpeg', 'ffprobe']) {
        const result = spawnSync(executable, ['-version'], { stdio: 'ignore', windowsHide: true });
        if (result.error || result.status !== 0)
          throw Error(
            executable + ' is required on PATH. Install FFmpeg before running the downloader.',
          );
      }
      say('Downloading the selected queue. Ctrl+C stops safely; run this again to resume.');
      say('Keep the computer awake and this window open. No Codex session is needed.');
      let failures = 0;
      while (!stopping) {
        const code = await new Promise((resolve, reject) => {
          child = spawn(
            process.execPath,
            [
              fileURLToPath(new URL('./import-curated.mjs', import.meta.url)),
              '--all',
              '--batch',
              '100',
              ...args,
            ],
            {
              cwd: root,
              stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
              windowsHide: true,
              env: { ...process.env, TONE_TOWER_AUDIO_LOCK: owner.token },
            },
          );
          child.stdout.on('data', (data) => {
            process.stdout.write(data);
            log.write(data);
          });
          child.stderr.on('data', (data) => {
            process.stderr.write(data);
            log.write(data);
          });
          child.once('error', reject);
          child.once('close', resolve);
          if (stopping && child.connected) child.send({ type: 'stop' });
        });
        child = null;
        if (stopping) break;
        if (code === 0) {
          say(
            args.includes('--export-only')
              ? 'Download list exported.'
              : 'Queue finished. Run npm run audio:sync before playing or building.',
          );
          break;
        }
        if (code !== 75)
          throw Error(
            'Importer stopped with an error. Fix the reported problem, then rerun to resume.',
          );
        const delay = Math.min(600000, 60000 * 2 ** Math.min(failures++, 4));
        say(
          'Import interrupted. Retrying in ' +
            Math.round(delay / 60000) +
            ' minute(s). Saved Commons cooldowns are honored.',
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
      if (stopping)
        say('Stopped. Progress is saved. Run npm run audio:sync before playing or building.');
    } finally {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      await new Promise((resolve) => log.end(resolve));
    }
  }, root);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runDownloader();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
