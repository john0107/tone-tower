// Stable entry point for the Windows launcher and existing download instructions.
import { runDownloader } from './tools/audio/download.mjs';
try {
  await runDownloader();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
