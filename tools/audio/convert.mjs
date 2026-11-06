import { execFileSync } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

export function convertToMP3(bytes) {
  const mp3 = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', 'pipe:0', '-f', 'mp3', '-codec:a', 'libmp3lame', '-q:a', '4', 'pipe:1'],
    { input: bytes, maxBuffer: 20 * 1024 * 1024, windowsHide: true },
  );
  if (mp3.length < 1000) throw Error('Audio too short');
  return mp3;
}

export async function validateMP3(file) {
  const { stdout } = await run(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      file,
    ],
    { encoding: 'utf8', timeout: 30000, windowsHide: true },
  );
  const duration = Number(stdout);
  if (!(duration > 0.1 && duration < 10)) throw Error('Unexpected duration: ' + file);
  await run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], {
    timeout: 30000,
    windowsHide: true,
  });
  return duration;
}
