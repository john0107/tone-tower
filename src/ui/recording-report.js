import { site } from '../site.js';

export function recordingIssueUrl(recording, profile) {
  const transcription =
    recording.transcription ?? recording.syllables?.map((s) => s.transcription).join(' ') ?? '';
  const url = new URL(site.repository + '/issues/new');
  url.searchParams.set('template', 'bug-report.yml');
  url.searchParams.set(
    'title',
    `[Recording] ${profile.label}: ${recording.text ?? ''} (${recording.id})`,
  );
  url.searchParams.set('area', 'Recording or answer');
  url.searchParams.set(
    'problem',
    [
      `Language: ${profile.label}`,
      `Recording ID: ${recording.id}`,
      `Written form: ${recording.text ?? ''}`,
      `Dictionary spelling: ${transcription}`,
      `Tone answers: ${recording.realizedTones?.join(' ') ?? recording.syllables?.map((s) => s.tone).join(' ') ?? ''}`,
      recording.source ? `Source: ${recording.source}` : '',
      '',
      'What sounds wrong, and what should it be?',
      '',
    ]
      .filter((line) => line !== undefined)
      .join('\n'),
  );
  return url.href;
}
