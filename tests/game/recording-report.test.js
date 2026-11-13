import test from 'node:test';
import assert from 'node:assert/strict';
import { recordingIssueUrl } from '../../src/ui/recording-report.js';
import { mandarin } from '../../src/languages/profiles.js';

test('recording reports prefill the exact language, recording, reading and source', () => {
  const url = new URL(
    recordingIssueUrl(
      {
        id: 'commons-123',
        text: '你好',
        transcription: 'ni3 hao3',
        realizedTones: [2, 3],
        source: 'https://commons.wikimedia.org/?curid=123',
      },
      mandarin,
    ),
  );
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.searchParams.get('template'), 'bug-report.yml');
  assert.equal(url.searchParams.get('area'), 'Recording or answer');
  assert.match(url.searchParams.get('problem'), /Language: Mandarin/);
  assert.match(url.searchParams.get('problem'), /Recording ID: commons-123/);
  assert.match(url.searchParams.get('problem'), /Dictionary spelling: ni3 hao3/);
  assert.match(url.searchParams.get('problem'), /Tone answers: 2 3/);
  assert.match(url.searchParams.get('problem'), /curid=123/);
});
