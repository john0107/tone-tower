import {
  soundPageMarkup as cantoneseGuide,
  compactGuideMarkup as cantoneseCompact,
} from '../languages/cantonese-guide.js';
import { mandarinGuide } from '../languages/mandarin-guide.js';
import { site } from '../site.js';
const guides = {
  yue: { full: cantoneseGuide, compact: cantoneseCompact },
  cmn: { full: (a, d) => mandarinGuide(a, d), compact: (a, d) => mandarinGuide(a, d, true) },
};
export function soundPageMarkup(anchors, definitions, rows, profile) {
  return guides[profile.id].full(anchors, definitions, rows);
}
export function compactGuideMarkup(anchors, definitions, profile) {
  return guides[profile.id].compact(anchors, definitions);
}
export function aboutPageMarkup({ recordingCount, profile, availability } = {}) {
  const learningResources = (profile.learningResources ?? [])
    .map(([url, label]) => '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>')
    .join(' or ');
  const toneDescription = profile.toneSummary ?? profile.tones.length + ' tones';
  const count =
    Number.isSafeInteger(recordingCount) && recordingCount > 0
      ? recordingCount.toLocaleString('en') + ' '
      : '';
  return /* HTML */ `<article class="info-page about-page">
    <header class="page-heading">
      <button class="text-button back-link" data-page="home" type="button">← World map</button>
      <h1 tabindex="-1">About Tone Tower</h1>
      <p class="lead">Tone Tower is a browser game for practising ${profile.romanization}.</p>
    </header>
    <section class="info-section" aria-labelledby="purpose-heading">
      <h2 id="purpose-heading">What you can practise</h2>
      <p>
        The exercises connect ${profile.label} pronunciation with its written representation in
        ${profile.romanization}. You listen to a recording, then identify a tone or type the sounds
        you hear. Answers advance you through a tower or a railway, depending on the game.
      </p>
      <p>
        The games are suitable for learners of ${profile.label} and for ${profile.label} speakers
        learning ${profile.romanization}. You can play using the pronunciation spelling before you
        can read the written words. The
        <button class="text-button inline-link" data-page="sounds" type="button">
          ${profile.romanization} guide
        </button>
        explains the notation and includes examples of the ${toneDescription}.
      </p>
      <p>
        The exercises supplement pronunciation study. If you are learning the sounds for the first
        time, start with ${learningResources}.
      </p>
    </section>
    <section class="info-section" aria-labelledby="games-heading">
      <h2 id="games-heading">Games and practice</h2>
      <div class="info-grid">
        <div class="info-card">
          <h3>Tone Tower</h3>
          <p>
            Identify the highlighted syllable’s tone and choose the corresponding door. The number
            of answer choices increases as you progress. There is no time limit.
          </p>
          <button class="text-button" data-start-world="tone" type="button">
            Choose Tower difficulty →
          </button>
        </div>
        <div class="info-card">
          <h3>Skyrail</h3>
          <p>
            Type the recording’s ${profile.romanization} within the time limit to build the track.
            Spelling practises initials and finals; With tones also requires
            ${profile.usesToneMarks ? 'tone marks or tone numbers' : 'tone numbers'}.
          </p>
          <button class="text-button" data-start-world="tide" type="button">
            Choose Skyrail settings →
          </button>
        </div>
      </div>
      <p>
        For focused exercises without a timer or lives, use
        <button class="text-button inline-link" data-info-action="practice" type="button">
          Practice</button
        >. Choose a tone pair or work on initials, finals and spelling. Practice results stay
        separate from adventure records.
      </p>
      <p class="small">
        Tone Tower trains listening recognition and ${profile.romanization} spelling. It does not
        assess your spoken pronunciation. Use it alongside conversation, vocabulary and a fuller
        ${profile.label} course.
      </p>
    </section>
    <section class="info-section" aria-labelledby="recordings-heading">
      ${availability?.mode === 'beta' ? '<p class="beta-source-note">Mandarin is in beta. Source labels and dictionary readings provide the starting content; reported problems can be corrected without replacing the original recordings.</p>' : ''}
      <h2 id="recordings-heading">Recordings and sources</h2>
      <p>
        The ${count}recordings are human speech from Wikimedia Commons, each with its own source,
        creator and licence. Readings and English meanings include credited dictionary sources such
        as ${profile.dictionarySources.map((source) => source.name).join(' and ')}.
      </p>
      <p>
        Pronunciation can vary between speakers and regions. Dictionary readings and the included
        recordings should be understood in that context.
      </p>
      <button class="text-button section-link" data-info-action="credits" type="button">
        Browse voices &amp; credits →
      </button>
    </section>
    <section class="info-section" aria-labelledby="progress-heading">
      <h2 id="progress-heading">Progress and privacy</h2>
      <p>
        Tone Tower does not require an account and has no analytics. Records and preferences are
        saved separately for each language in this browser and do not sync between devices. Clearing
        browser storage removes them; closing or reloading the page ends the current run.
      </p>
      <button class="text-button section-link" data-info-action="records" type="button">
        View your records →
      </button>
    </section>
    <section class="info-section" aria-labelledby="project-heading">
      <h2 id="project-heading">An open-source side project</h2>
      <p>
        Tone Tower is made and maintained by
        <a href="${site.maintainerUrl}" target="_blank" rel="noopener">${site.maintainer}</a>. The
        code is <a href="LICENSE">MIT licensed</a>, and you can
        <a href="${site.repository}" target="_blank" rel="noopener">explore it on GitHub ↗</a>,
        suggest improvements, or contribute a fix. Recordings and fonts keep their own licences.
      </p>
    </section>
    <section class="info-section" aria-labelledby="feedback-heading">
      <h2 id="feedback-heading">Help make it better</h2>
      <p>
        Found a bug, heard a recording that seems wrong, or have an idea? Share it on GitHub. For a
        recording issue, include the written word and ${profile.romanization} so it is easy to find.
      </p>
      <div class="feedback-links">
        <a
          class="secondary"
          href="${site.repository}/issues/new?template=bug-report.yml"
          target="_blank"
          rel="noopener"
          >Report a problem ↗</a
        >
        <a
          class="secondary"
          href="${site.repository}/issues/new?template=idea.yml"
          target="_blank"
          rel="noopener"
          >Suggest an idea ↗</a
        >
        <a href="${site.repository}/issues" target="_blank" rel="noopener">Browse feedback ↗</a>
      </div>
      <p class="small">
        A GitHub account is needed to post. Reports and replies are public; please leave out
        personal information. Feedback is welcome, though responses may take a little time.
      </p>
    </section>
    <div class="info-actions">
      <button class="primary" data-page="home" type="button">Go to the games →</button
      ><button class="text-button" data-page="sounds" type="button">
        ${profile.romanization} guide
      </button>
    </div>
  </article>`;
}
