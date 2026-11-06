import path from 'node:path';

export function audioPaths(root = process.cwd()) {
  const data = path.join(root, 'data', 'audio');
  const cache = path.join(root, '.audio-import-cache');
  return {
    root,
    data,
    cache,
    content: path.join(data, 'content.json'),
    words: path.join(data, 'words.json'),
    corrections: path.join(data, 'corrections.json'),
    queue: path.join(data, 'review-queue.json'),
    review: path.join(data, 'import-review.json'),
    state: path.join(cache, 'state.json'),
    candidates: path.join(cache, 'candidates.json'),
    csv: path.join(cache, 'download-list.csv'),
    log: path.join(cache, 'downloader.log'),
    lock: path.join(cache, 'pipeline.lock'),
  };
}
