import { recordingIssueUrl } from './ui/recording-report.js';
import { languages, requireProfile, decodeTonePair } from './languages/profiles.js';
import { site, languagePages, pageFromLocation } from './site.js';
import { practiceSetupMarkup } from './ui/practice-setup.js';
import { filterCredits, creditsPage } from './ui/credits.js';
import { catalogRows, referenceRows } from './content/catalog.js';
import { Player } from './audio/audio.js';
import { challenges, defaultPractice, TONE_VARIANTS } from './game/game-core.js';
import {
  loadProgress,
  saveProgress,
  recordRun,
  resetProgress,
  challengeRecords,
} from './persistence/progress.js';
import { createGameController } from './game/game-controller.js';
import { districts } from './world/worlds.js';
import { animateWorld } from './world/world-runtime.js';
import { destinations } from './world/pixel-world.js';
import { soundPageMarkup, aboutPageMarkup, compactGuideMarkup } from './ui/info-pages.js';
import { bindMapNavigation } from './ui/map-navigation.js';

const profile = requireProfile(languages[document.documentElement.dataset.language]);
const pages = languagePages(profile);
const appBase = new URL('../', import.meta.url);
// Freeze the base before pushState so assets and links stay project-relative.
document.querySelector('base').href = appBase.href;

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const dialogBody = document.querySelector('#dialog-body');
const player = new Player();
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const titleCase = (value) => value[0].toUpperCase() + value.slice(1);
const variantName = (world, variant) =>
  world === 'tone' ? titleCase(variant) : variant === 'full' ? 'With tones' : 'Without tones';
const difficultyName = (d) => titleCase(d || 'normal');
const heartPreview = (count) =>
  '<span class="difficulty-hearts" role="img" aria-label="' +
  count +
  ' ' +
  (count === 1 ? 'life' : 'lives') +
  '">' +
  Array.from(
    { length: count },
    () =>
      '<svg viewBox="0 0 20 22" aria-hidden="true"><path d="M1 5L5 1h4l1 3 1-3h4l4 4v7L10 21 1 12Z"/></svg>',
  ).join('') +
  '</span>';

let worldAnimation = null,
  mapNavigationCleanup = null,
  mapDestination = 'tone',
  mapActor = { ...destinations.tone };
const worldInfo = {
  tone: {
    title: 'Tone Tower',
    action: 'Begin the climb',
    unit: 'floors',
    verb: 'climbed',
    eyebrow: 'Tone recognition',
    description:
      'Listen to the highlighted syllable and choose its tone number. Replay as often as you like.',
    instruction: 'Listen to the highlighted syllable. Choose the tone you hear.',
    end: 'The summit is yours.',
  },
  tide: {
    title: 'Skyrail',
    action: 'Board Skyrail',
    unit: 'spans',
    verb: 'built',
    eyebrow: profile.romanization + ' spelling',
    description:
      'Listen, then type the sounds in ' + profile.romanization + ' to build the next bridge. ',
    instruction:
      'Listen, then type the ' + profile.romanization + ' before the railcar reaches the gap.',
    end: 'Next stop: the horizon.',
  },
};
let progress = loadProgress(profile),
  catalog = null,
  data = [],
  words = [],
  anchors = [],
  controller = null,
  screen = 'home';
const persist = () => saveProgress(profile, progress);
function best(world) {
  return Math.max(0, ...challengeRecords(progress, world).map((r) => r.best || 0));
}
function resetView(view) {
  mapNavigationCleanup?.();
  mapNavigationCleanup = null;
  worldAnimation?.dispose();
  worldAnimation = null;
  controller?.dispose();
  player.stop();
  screen = view;
  app.dataset.view = view;
  delete app.dataset.stage;
  delete app.dataset.world;
  delete app.dataset.practice;
  delete app.dataset.outcome;
  document.body.classList.remove('keyboard-open');
  document.body.dataset.screen = view;
  document.querySelector('#pause-game').hidden = true;
  document.querySelectorAll('[data-nav-page]').forEach((link) => {
    if (link.dataset.navPage === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  setPageLocation(['sounds', 'about', 'home'].includes(view) ? view : 'home', true);
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function focusTitle() {
  app.querySelector('h1')?.focus({ preventScroll: true });
}
function screenError(message) {
  const box = app.querySelector('#setup-error');
  if (box) {
    box.textContent = message;
    box.focus();
  } else {
    openDialog(
      '<h2 id="dialog-title">Couldn’t start this session</h2><p>' + escape(message) + '</p>',
    );
  }
}

let selectedWorld = profile.challenges[0];
function home(world, initialPractice = false) {
  let practiceMode = initialPractice;
  const practiceConfigs = Object.fromEntries(
    ['tone', 'tide'].map((challenge) => {
      const saved = progress.settings.practice[challenge];
      return [
        challenge,
        {
          ...defaultPractice(challenge, profile),
          ...saved,
          challenge,
          format: 'drill',
          start: 1,
          length: 20,
          spellingFocus: saved.spellingFocus || 'full',
          content: challenge === 'tide' ? 'mixed' : profile.practiceToneContent,
          target:
            challenge === 'tide'
              ? saved.singleSyllableOnly === true
                ? 'highlighted'
                : 'whole'
              : 'highlighted',
          lives: 'unlimited',
          timer: 'off',
          focusIds: [],
        },
      ];
    }),
  );
  if (world === 'tone' || world === 'tide') {
    selectedWorld = world;
    mapDestination = world === 'tide' ? 'rail' : 'tone';
  } else world = selectedWorld;
  resetView('home');
  if (initialPractice) setPageLocation('practice', true);
  progress = loadProgress(profile);
  const exampleText = profile.example.forms?.[progress.settings.script] ?? profile.example.written;
  const exampleRecording = data.find(
    (row) =>
      row.transcription === profile.example.transcription &&
      Object.values(row.forms ?? {}).includes(exampleText),
  );
  app.innerHTML = /* HTML */ `<header class="home-intro">
      <div>
        <h1 tabindex="-1">Practise ${profile.romanization}.</h1>
        <p>
          ${profile.romanization} writes ${profile.label} pronunciation using Latin letters and
          ${profile.usesToneMarks ? 'tone marks' : 'tone numbers'}.
        </p>
      </div>
      <a class="intro-guide" href="${pages.sounds.path}" data-page="sounds"
        ><span>New to ${profile.romanization}?</span>A short introduction →</a
      >
    </header>
    ${catalog?.availability?.ready === false ? '<aside class="content-preview" role="status"><strong>Mandarin is taking shape.</strong><p>We’re gathering enough recordings to open the games. Explore the Pinyin guide while the collection grows.</p></aside>' : catalog?.availability?.mode === 'beta' ? '<aside class="content-preview beta-notice"><strong>Mandarin beta</strong><p>Found a recording problem? Report it from the answer feedback or Voices &amp; credits.</p></aside>' : ''}
    <div class="transcription-intro" aria-label="${profile.romanization} syllable example">
      <span class="intro-label">A syllable combines an initial, a final, and a tone.</span>
      <div class="syllable-parts">
        <span><b>${profile.example.initial}</b><small>initial</small></span
        ><i aria-hidden="true">+</i> <span><b>${profile.example.final}</b><small>final</small></span
        ><i aria-hidden="true">+</i> <span><b>${profile.example.tone}</b><small>tone</small></span
        ><i aria-hidden="true">=</i>
        <span class="syllable-result"
          ><b>${profile.format(profile.example.transcription)}</b
          ><small>${exampleText} · ${profile.example.gloss}</small></span
        >
      </div>
      <button
        type="button"
        class="hear-example"
        data-guide-word="${exampleRecording?.id ?? ''}"
        ${exampleRecording ? '' : 'disabled'}
        aria-label="Hear example"
      >
        ▶ Hear example
      </button>
      <span id="guide-status" class="sr-only" role="status"></span>
    </div>
    <section class="mode-picker" aria-labelledby="mode-heading">
      <div class="mode-picker-heading">
        <h2 id="mode-heading">Choose a game</h2>
        <p><kbd>←</kbd> <kbd>→</kbd> choose · <kbd>Enter</kbd> start</p>
      </div>
      <div class="mode-cards">
        <button
          type="button"
          class="mode-card"
          data-mode-card
          data-destination="tone"
          aria-describedby="tone-mode-description"
        >
          <strong>Tone Tower</strong
          ><span id="tone-mode-description">Choose the tone number you hear.</span>
        </button>
        <button
          type="button"
          class="mode-card"
          data-mode-card
          data-destination="rail"
          aria-describedby="rail-mode-description"
        >
          <strong>Skyrail</strong
          ><span id="rail-mode-description">Type the ${profile.romanization} you hear.</span>
        </button>
      </div>
    </section>
    <section class="play-frame home-world" aria-label="Choose an adventure">
      <div class="home-map-layout">
        <div class="stage">
          <canvas
            class="map-canvas"
            width="480"
            height="400"
            aria-label="Tone Tower and Skyrail above the clouds"
          ></canvas>
          <div class="targets">
            <button type="button" data-destination="tone" class="place tower-place">
              TONE TOWER<small>Practice tones</small></button
            ><button type="button" data-destination="rail" class="place rail-place">
              SKYRAIL<small>Practice spelling</small>
            </button>
          </div>
        </div>
        <div class="dock">
          <div>
            <h2 id="destination-title"></h2>
            <div class="setup-tabs" role="group" aria-label="Game or practice">
              <button type="button" id="setup-game" aria-pressed="true">Play game</button
              ><button type="button" id="setup-practice" aria-pressed="false">
                Practice tones
              </button>
            </div>
            <div id="map-variants" class="title-variants"></div>
          </div>
          <div class="map-entry">
            <button id="start-adventure" class="primary" type="button">Enter tower →</button>
            <div id="setup-error" class="error" role="alert" tabindex="-1"></div>
          </div>
        </div>
      </div>
    </section>`;
  app.querySelectorAll('[data-destination]').forEach((button) => {
    button.hidden = !profile.challenges.includes(
      button.dataset.destination === 'rail' ? 'tide' : 'tone',
    );
  });
  if (!profile.challenges.includes(mapDestination === 'rail' ? 'tide' : 'tone'))
    mapDestination = profile.challenges[0] === 'tide' ? 'rail' : 'tone';
  bindInfoActions(app);
  bindToneAudio(app);
  const canvas = app.querySelector('.map-canvas');
  worldAnimation = animateWorld(canvas, {
    scene: 'hub',
    height: 400,
    progress: best('tone'),
    count: 2,
    actor: mapActor,
  });
  function select(value) {
    mapDestination = value;
    const rail = value === 'rail',
      challenge = rail ? 'tide' : 'tone',
      info = worldInfo[challenge],
      key = rail ? 'tideVariant' : 'toneVariant',
      variant = progress.settings[key];
    app
      .querySelectorAll('[data-destination]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.destination === value)));
    app.querySelector('#destination-title').textContent = info.title;
    const variants = app.querySelector('#map-variants');
    variants.innerHTML =
      (rail
        ? '<div class="rail-difficulty-options" role="group" aria-label="Skyrail difficulty">' +
          Object.entries({ easy: 5, normal: 4, hard: 3, extreme: 1 })
            .map(
              ([d, l]) =>
                '<button type="button" data-difficulty="' +
                d +
                '" aria-pressed="' +
                (d === progress.settings.tideDifficulty) +
                '">' +
                difficultyName(d) +
                heartPreview(l) +
                '</button>',
            )
            .join('') +
          '</div>'
        : '') +
      '<div class="answer-variants" role="group" aria-label="' +
      (rail ? 'Answer style' : 'Tower difficulty') +
      '">' +
      challenges[challenge].variants
        .map(
          (v) =>
            '<button type="button" data-variant="' +
            v +
            '" aria-pressed="' +
            (v === variant) +
            '">' +
            variantName(challenge, v) +
            (rail ? '' : heartPreview(TONE_VARIANTS[v])) +
            '</button>',
        )
        .join('') +
      '</div>' +
      (rail
        ? '<div class="skyrail-example"><span lang="zh-Hant">你好</span><span> → ' +
          (variant === 'full'
            ? profile.format(profile.example.parts.join(' '))
            : profile.example.parts.map((part) => profile.withoutTones(part)).join(' ')) +
          '</span></div>'
        : '');
    variants.querySelectorAll('[data-variant]').forEach(
      (b) =>
        (b.onclick = () => {
          progress.settings[key] = b.dataset.variant;
          persist();
          select(value);
          app
            .querySelector('[data-variant="' + b.dataset.variant + '"]')
            .focus({ preventScroll: true });
        }),
    );
    variants.querySelectorAll('[data-difficulty]').forEach(
      (b) =>
        (b.onclick = () => {
          progress.settings.tideDifficulty = b.dataset.difficulty;
          persist();
          select(value);
          app
            .querySelector('[data-difficulty="' + b.dataset.difficulty + '"]')
            .focus({ preventScroll: true });
        }),
    );
    const config = practiceConfigs[challenge];
    setPageLocation(practiceMode ? 'practice' : 'home');
    app.querySelector('#setup-game').setAttribute('aria-pressed', String(!practiceMode));
    const practiceTab = app.querySelector('#setup-practice');
    practiceTab.textContent = rail ? 'Practice spelling' : 'Practice tones';
    practiceTab.setAttribute('aria-pressed', String(practiceMode));
    app.querySelector('#setup-game').onclick = () => {
      practiceMode = false;
      select(value);
    };
    practiceTab.onclick = () => {
      practiceMode = true;
      select(value);
    };
    if (practiceMode) {
      variants.innerHTML = practiceSetupMarkup(config, profile);
      variants.querySelectorAll('[data-practice-tone]').forEach(
        (button) =>
          (button.onclick = () => {
            const tone = profile.tones.find((t) => String(t) === button.dataset.practiceTone);
            config.tones = config.tones.includes(tone)
              ? config.tones.filter((t) => t !== tone)
              : [...config.tones, tone].sort(
                  (a, b) => profile.tones.indexOf(a) - profile.tones.indexOf(b),
                );
            if (config.choices > config.tones.length)
              config.choices = profile.choiceCounts.filter((n) => n <= config.tones.length).at(-1);
            progress.settings.practice[challenge] = { ...config };
            persist();
            select(value);
            app.querySelector('[data-practice-tone="' + tone + '"]').focus({ preventScroll: true });
          }),
      );
      variants.querySelectorAll('[data-practice-setting]').forEach(
        (input) =>
          (input.onchange = () => {
            const key = input.dataset.practiceSetting;
            config[key] =
              key === 'variant'
                ? input.checked
                  ? 'full'
                  : 'spelling'
                : key === 'target'
                  ? input.checked
                    ? 'highlighted'
                    : 'whole'
                  : ['length', 'choices'].includes(key) && input.value !== 'endless'
                    ? Number(input.value)
                    : input.value;
            if (key === 'target') config.singleSyllableOnly = input.checked;
            progress.settings.practice[challenge] = { ...config };
            persist();
            select(value);
            app
              .querySelector('[data-practice-setting="' + key + '"]')
              .focus({ preventScroll: true });
          }),
      );
    }
    const enter = app.querySelector('#start-adventure');
    enter.textContent = practiceMode
      ? rail
        ? 'Start spelling practice →'
        : 'Start tone practice →'
      : rail
        ? 'Board Skyrail →'
        : 'Enter tower →';
    enter.disabled = catalog?.availability?.ready === false;
    enter.onclick = () =>
      practiceMode
        ? startPractice(challenge, config.variant, config)
        : begin({
            challenge,
            variant: progress.settings[key],
            difficulty: progress.settings.tideDifficulty,
            practice: false,
          });
    selectedWorld = challenge;
    // Walking is decorative: settings and Start are ready as soon as a mode is selected.
    worldAnimation.update({
      destination: value,
      onTravel: (moving) => {
        if (!moving) mapActor = { ...destinations[value] };
      },
    });
  }
  app.querySelectorAll('[data-destination]').forEach(
    (b) =>
      (b.onclick = () => {
        practiceMode = false;
        select(b.dataset.destination);
      }),
  );
  select(mapDestination);
  mapNavigationCleanup = bindMapNavigation({
    document,
    container: app,
    getDestination: () => mapDestination,
    onSelect: select,
    onStart: () => app.querySelector('#start-adventure')?.click(),
    isBlocked: () => dialog.open,
  });
}
function prepare(world) {
  home(world);
  focusTitle();
}

function startPractice(challenge = 'tone', variant = 'spelling', seed = {}) {
  const config = {
    ...defaultPractice(challenge, profile),
    ...seed,
    challenge,
    variant: challenge === 'tone' ? 'normal' : variant,
    practice: true,
    format: 'drill',
    length: seed.length ?? 20,
    start: 1,
    content: seed.content ?? (challenge === 'tide' ? 'mixed' : profile.practiceToneContent),
    target: challenge === 'tide' ? (seed.target ?? 'whole') : 'highlighted',
    choices: seed.choices ?? 2,
    lives: 'unlimited',
    timer: 'off',
  };
  begin(config);
}
function showWorkshop(seed) {
  if (seed) {
    startPractice(seed.challenge, seed.variant, seed);
    return;
  }
  home(undefined, true);
  app.querySelector('#setup-practice')?.focus();
}

function begin(config) {
  if (catalog?.availability?.ready === false) {
    screenError(
      'There are not enough recordings for this collection yet. Please explore the guide for now.',
    );
    return;
  }
  resetView('game');
  document.querySelector('#pause-game').hidden = false;
  try {
    controller.start(config);
  } catch (error) {
    prepare(config.challenge);
    screenError(error.message);
  }
}
function finish(run) {
  recordRun(progress, run);
  persist();
  if (run.config.practice) {
    controller.dispose();
    showResults(run);
  }
}
function showResults(run) {
  resetView('results');
  app.dataset.world = run.world;
  const info = worldInfo[run.world],
    variant = run.config.variant;
  const syllables = run.word?.syllables || [];
  app.innerHTML = /* HTML */ `<section class="results-view">
    <div class="eyebrow">Practice results</div>
    <h1 tabindex="-1">Practice complete.</h1>
    <p class="lead">
      ${run.cleared} correct answer${run.cleared === 1 ? '' : 's'}. Review missed recordings or
      start another session.
    </p>
    <div class="result-metrics">
      <div><strong>${run.cleared}</strong><span>Correct answers</span></div>
      <div><strong>${run.mistakes}</strong><span>Missed answers</span></div>
      <div><strong>${run.assisted || 0}</strong><span>Assisted answers</span></div>
    </div>
    ${
      run.lastFailure && syllables.length
        ? /* HTML */ `<div class="last-word feedback-card">
            <span class="eyebrow">One to listen to again</span>
            <div class="result-word">
              ${syllables.map((s) => /* HTML */ `<span>${escape(s.text)}<small>${escape(profile.format(s.transcription))}</small></span>`).join('')}
            </div>
            <p>${escape(run.word.gloss)}</p>
            ${run.lastAnswer ? /* HTML */ `<p class="small">${run.world === 'tone' ? 'You chose' : 'You typed'}: ${escape(run.lastAnswer)}</p>` : ''}<button
              id="last-word-audio"
              class="text-button"
              type="button"
            >
              ▶ Hear it again
            </button>
            <p id="result-audio-status" class="small" role="status"></p>
          </div>`
        : ''
    }
    <div class="results-actions">
      <button id="retry" class="primary" type="button">
        Another practice
        <span aria-hidden="true">→</span></button
      ><button id="practise-result" class="secondary" type="button">Practise this</button
      ><button id="result-home" class="text-button" type="button">Back to the world map</button>
    </div>
    <button id="copy-summary" class="text-button" type="button">Copy session summary</button>
    <p id="copy-status" class="small" role="status"></p>
    <p class="result-footnote">Practice results stay separate from challenge records.</p>
  </section>`;
  app.querySelector('#retry').onclick = () => begin({ ...run.config });
  app.querySelector('#result-home').onclick = home;
  app.querySelector('#practise-result')?.addEventListener('click', () => practiceFromRun(run));
  app.querySelector('#last-word-audio')?.addEventListener('click', async () => {
    try {
      await player.play(run.word.audio);
    } catch {
      app.querySelector('#result-audio-status').textContent =
        'Recording unavailable. Please try again.';
    }
  });
  app.querySelector('#copy-summary').onclick = async () => {
    const summary = `Tone Tower · ${info.title} · ${variantName(run.world, variant)}${run.world === 'tide' ? ' · ' + difficultyName(run.config.difficulty) : ''} · Practice\n${run.cleared} correct answers · ${run.config.format === 'rehearsal' ? `rehearsal from ${run.config.start}` : run.config.length === 'endless' ? 'open practice' : `${run.config.length}-question practice`} · ${run.mistakes} misses · ${run.assisted || 0} assisted`;
    try {
      await navigator.clipboard.writeText(summary);
      app.querySelector('#copy-status').textContent = 'Summary copied.';
    } catch {
      app.querySelector('#copy-status').textContent = summary;
    }
  };
  focusTitle();
}
function practiceFromRun(run) {
  const config = {
    ...defaultPractice(run.world, profile),
    variant: run.config.variant,
    focusIds: [...new Set(run.missedIds || [])],
  };
  // Missed recordings may contain whole words even when practice defaults to single syllables.
  if (config.focusIds.length) config.content = 'mixed';
  if (run.world === 'tone') {
    const key = Object.entries(run.confusions || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
    const pair = key ? decodeTonePair(key) : null;
    if (pair?.length === 2) {
      config.tones = pair;
      config.choices = 2;
    }
  }
  if (run.world === 'tide' && config.focusIds.length) {
    config.target = run.opened >= 40 ? 'whole' : 'highlighted';
  }
  showWorkshop(config);
}

function openDialog(html) {
  controller?.pause();
  player.stop();
  dialogBody.innerHTML = html;
  if (!dialog.open) dialog.showModal();
  dialogBody.querySelector('h2')?.setAttribute('tabindex', '-1');
  dialogBody.querySelector('h2')?.focus();
}
function bindToneAudio(container) {
  let request = 0;
  container.querySelectorAll('[data-guide-tone],[data-guide-word]').forEach(
    (button) =>
      (button.onclick = async () => {
        const current = ++request;
        const anchor = button.dataset.guideWord
          ? data.find((word) => word.id === button.dataset.guideWord)
          : anchors.find((word) => String(word.tone) === button.dataset.guideTone);
        const status =
          button.closest('.guide-example-block')?.querySelector('[role="status"]') ||
          container.querySelector('#guide-status');
        if (!anchor) {
          if (status) status.textContent = 'This recording is unavailable.';
          return;
        }
        container
          .querySelectorAll('[data-guide-tone],[data-guide-word]')
          .forEach((other) => other.removeAttribute('data-playing'));
        container.querySelectorAll('.guide-example-status').forEach((other) => {
          other.textContent = '';
        });
        const toneStatus = container.querySelector('#guide-status');
        if (toneStatus && toneStatus !== status)
          toneStatus.textContent =
            'Choose a tone to listen. Replay and compare as often as you like.';
        button.dataset.playing = 'true';
        if (status) status.textContent = 'Playing ' + profile.format(anchor.transcription) + '…';
        try {
          await player.play(anchor.audio);
          if (current === request && status?.isConnected)
            status.textContent = button.dataset.guideWord
              ? profile.format(anchor.transcription) + ' · ' + anchor.text
              : profile.format(anchor.transcription) +
                ' · ' +
                profile.toneDefinitions.find((t) => t.value === anchor.tone).description;
        } catch {
          if (current === request && status?.isConnected)
            status.textContent = 'The recording could not play. Select it to try again.';
        } finally {
          if (current === request) button.removeAttribute('data-playing');
        }
      }),
  );
}
function setPageLocation(page, replace = false) {
  const destination = new URL(pages[page].path, appBase);
  destination.search = location.search;
  if (location.href !== destination.href)
    history[replace ? 'replaceState' : 'pushState'](null, '', destination.href);
  document.querySelector('.skip-link').href = new URL(pages[page].path + '#app', appBase).href;
  document.querySelectorAll('[data-nav-page]').forEach((link) => {
    if (link.dataset.navPage === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const metadata = pages[page];
  document.title = metadata.title;
  for (const selector of [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ])
    document.querySelector(selector).content = metadata.description;
  for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]'])
    document.querySelector(selector).content = metadata.title;
  const canonical = new URL(metadata.path, site.siteUrl);
  document.querySelector('link[rel="canonical"]').href = canonical.href;
  document.querySelector('meta[property="og:url"]').content = canonical.href;
}
function bindInfoActions(container) {
  for (const link of container.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    const key = { './': 'home', 'guide/': 'sounds', 'practice/': 'practice', 'about/': 'about' }[
      href
    ];
    if (key) link.setAttribute('href', pages[key].path);
  }
  container.querySelectorAll('[data-page]').forEach(
    (link) =>
      (link.onclick = (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(link.dataset.page);
      }),
  );
  container.querySelectorAll('[data-start-world]').forEach(
    (button) =>
      (button.onclick = () => {
        setPageLocation('home');
        prepare(button.dataset.startWorld);
      }),
  );
  container.querySelectorAll('[data-info-action]').forEach(
    (button) =>
      (button.onclick = () => {
        ({
          credits: showCredits,
          records: showProgress,
          practice: () => {
            setPageLocation('practice');
            showWorkshop();
            focusTitle();
          },
        })[button.dataset.infoAction]?.();
      }),
  );
}
function showInfo(page) {
  resetView(page);
  app.innerHTML =
    page === 'sounds'
      ? soundPageMarkup(anchors, profile.toneDefinitions, data, profile)
      : aboutPageMarkup({
          recordingCount: data.length,
          profile,
          availability: catalog?.availability,
        });
  bindInfoActions(app);
  if (page === 'sounds') bindToneAudio(app);
}
function showAboutInGame() {
  const markup = aboutPageMarkup({
    recordingCount: data.length,
    profile,
    availability: catalog?.availability,
  })
    .replace('<h1 tabindex="-1">', '<h2 id="dialog-title">')
    .replace('</h1>', '</h2>');
  openDialog(markup);
  dialogBody
    .querySelectorAll('.back-link,.info-actions,[data-start-world]')
    .forEach((el) => el.remove());
  dialogBody
    .querySelectorAll('[data-info-action="practice"]')
    .forEach((el) => el.replaceWith(document.createTextNode(el.textContent)));
  bindInfoActions(dialogBody);
}
function navigate(page, { replace = false, focus = true } = {}) {
  if (!['home', 'sounds', 'about', 'practice'].includes(page)) return;
  if (screen === 'game' && controller?.active && controller.state?.status === 'playing') {
    setPageLocation('home', true);
    if (page === 'sounds') showLearn();
    else if (page === 'about') showAboutInGame();
    else controller.pause();
    return;
  }
  setPageLocation(page, replace);
  if (page === 'sounds' || page === 'about') showInfo(page);
  else if (page === 'practice') showWorkshop();
  else home();
  if (focus) focusTitle();
}
function showLearn() {
  controller?.state?.markAssisted?.();
  openDialog(compactGuideMarkup(anchors, profile.toneDefinitions, profile));
  bindToneAudio(dialogBody);
}
const safeHref = (value) => {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) ? escape(u.href) : '#';
  } catch {
    return '#';
  }
};
function showCredits() {
  openDialog(
    /* HTML */ `<div class="eyebrow">Sources & licences</div>
      <h2 id="dialog-title">Voices & credits</h2>
      <p>Human recordings from Wikimedia Commons. Each recording keeps its source licence.</p>
      <details>
        <summary>Dictionary, typography & application credits</summary>
        <p>
          Readings and glosses include adaptations from
          ${profile.dictionarySources.map((source) => '<a href="' + safeHref(source.url) + '" target="_blank" rel="noopener">' + escape(source.name) + '</a>' + (source.attribution ? ' · ' + escape(source.attribution) : '') + ' under <a href="' + safeHref(source.licenseUrl) + '">' + escape(source.license) + '</a>').join('; ')}.
          Individual entries identify their dictionary sources.
        </p>
        <p>
          DM Sans: <a href="assets/fonts/DMSans-LICENSE.txt">Font licence</a>. Application code:
          <a href="LICENSE">MIT</a>. <a href="THIRD_PARTY_NOTICES.md">Third-party notices</a>. No
          accounts or analytics.
        </p>
      </details>
      <label class="credits-search"
        >Find a recording<input
          id="credit-search"
          type="search"
          placeholder="Written form, ${profile.romanization}, creator…"
          autocomplete="off"
      /></label>
      <div id="credit-results"></div>`,
  );
  const results = dialogBody.querySelector('#credit-results'),
    search = dialogBody.querySelector('#credit-search');
  let page = 0,
    query = '',
    debounce;
  function draw() {
    if (!results.isConnected) return;
    const matches = filterCredits(data, query),
      view = creditsPage(matches, page);
    page = view.page;
    results.innerHTML = /* HTML */ `<div class="credits-pagination">
        <span role="status"
          >${matches.length ? `${page * 20 + 1}–${Math.min(matches.length, (page + 1) * 20)} of ${matches.length} recordings` : 'No matching recordings'}</span
        >
        <div>
          <button class="secondary" id="credits-prev" type="button" ${page === 0 ? 'disabled' : ''}>
            ←</button
          ><button
            class="secondary"
            id="credits-next"
            type="button"
            ${page >= view.pages - 1 ? 'disabled' : ''}
          >
            →
          </button>
        </div>
      </div>
      <div class="credits-table">
        <table>
          <caption class="sr-only">
            Recording sources and licences
          </caption>
          <thead>
            <tr>
              <th>Recording</th>
              <th>Creator</th>
              <th>Source / licence</th>
            </tr>
          </thead>
          <tbody>
            ${view.rows
              .map(
                (w) =>
                  /* HTML */ `<tr>
                    <td>
                      ${escape(w.text)}<small>${escape(profile.format(w.transcription))}</small>
                    </td>
                    <td>${escape(w.author || 'See original')}</td>
                    <td>
                      <a href="${safeHref(w.source)}" target="_blank" rel="noopener">Original ↗</a>
                      ·
                      <a href="${safeHref(w.licenseUrl)}" target="_blank" rel="noopener"
                        >${escape(w.license)}</a
                      >${w.conversion ? /* HTML */ `<small>${escape(w.conversion)}</small>` : ''}<small
                        ><a
                          href="${escape(recordingIssueUrl(w, profile))}"
                          target="_blank"
                          rel="noopener"
                          >Report this recording ↗</a
                        ></small
                      >
                    </td>
                  </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
    results.querySelector('#credits-prev').onclick = () => {
      page--;
      draw();
      results.querySelector('#credits-prev').focus({ preventScroll: true });
    };
    results.querySelector('#credits-next').onclick = () => {
      page++;
      draw();
      results.querySelector('#credits-next').focus({ preventScroll: true });
    };
  }
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      query = search.value;
      page = 0;
      draw();
    }, 120);
  });
  draw();
}
function showProgress() {
  openDialog(
    '<h2 id="dialog-title">Your records</h2><p class="small">Saved in this browser. Closing or reloading ends the current run.</p>' +
      ['tone', 'tide']
        .map(
          (world) =>
            '<h3>' +
            worldInfo[world].title +
            '</h3><div class="travel-records">' +
            (world === 'tide'
              ? Object.entries(progress.records.tide).flatMap(([variant, records]) =>
                  Object.entries(records).map(([difficulty, r]) => [variant, r, difficulty]),
                )
              : Object.entries(progress.records.tone)
            )
              .map(
                ([variant, r, difficulty]) =>
                  '<div><strong>' +
                  (r.wins ? '✦ ' : '') +
                  variantName(world, variant) +
                  (difficulty ? ' · ' + difficultyName(difficulty) : '') +
                  '</strong><span>Best: ' +
                  r.best +
                  ' ' +
                  worldInfo[world].unit +
                  ' · ' +
                  r.runs +
                  ' attempt' +
                  (r.runs === 1 ? '' : 's') +
                  (r.wins ? ' · ' + r.wins + ' journeys completed' : '') +
                  '</span></div>',
              )
              .join('') +
            '</div>',
        )
        .join('') +
      '<p>' +
      progress.practice.runs +
      ' practice sessions · ' +
      progress.practice.cleared +
      ' correct practice answers.</p><div class="reset-area"><button id="request-reset" class="text-button" type="button">Reset saved progress…</button><div id="reset-confirmation" hidden><p>This clears records and preferences for this language in this browser.</p><button id="confirm-reset" class="danger-button" type="button">Reset everything</button><button id="cancel-reset" class="text-button" type="button">Keep my records</button></div></div>',
  );
  dialogBody.querySelector('#request-reset').onclick = () => {
    dialogBody.querySelector('#reset-confirmation').hidden = false;
    dialogBody.querySelector('#confirm-reset').focus();
  };
  dialogBody.querySelector('#cancel-reset').onclick = () => {
    dialogBody.querySelector('#reset-confirmation').hidden = true;
    dialogBody.querySelector('#request-reset').focus();
  };
  dialogBody.querySelector('#confirm-reset').onclick = () => {
    progress = resetProgress(profile);
    if (scriptDisplay) scriptDisplay.value = progress.settings.script;
    data = catalogRows(catalog, profile, progress.settings.script);
    words = data.filter((w) => !w.anchor);
    anchors = referenceRows(catalog, data);
    controller?.setScript(progress.settings.script);
    dialog.close();
    home();
  };
}

document.querySelectorAll('[data-nav-page]').forEach(
  (link) =>
    (link.onclick = (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(link.dataset.navPage);
    }),
);
document.querySelector('.brand').onclick = (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate('home');
};
document.querySelector('#pause-game').onclick = () => controller?.pause();
const scriptDisplay = document.querySelector('#script-display');
if (scriptDisplay) {
  scriptDisplay.value = progress.settings.script;
  scriptDisplay.onchange = () => {
    progress.settings.script = scriptDisplay.value;
    persist();
    if (!catalog) return;
    data = catalogRows(catalog, profile, scriptDisplay.value);
    words = data.filter((w) => !w.anchor);
    anchors = referenceRows(catalog, data);
    controller?.setScript(scriptDisplay.value);
    if (screen !== 'game')
      navigate(pageFromLocation(new URL(location.href), appBase, profile), {
        replace: true,
        focus: false,
      });
  };
}
document.querySelector('#credits').onclick = showCredits;
document.querySelector('#progress').onclick = showProgress;
document.querySelector('#close-dialog').onclick = () => dialog.close();
dialog.addEventListener('close', () => {
  player.stop();
  if (controller?.active) controller.resume();
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  }
});
window.addEventListener('popstate', () => {
  if (controller)
    navigate(pageFromLocation(new URL(location.href), appBase, profile), { replace: true });
});

try {
  const response = await fetch(new URL('../catalogs/' + profile.id + '.json', import.meta.url));
  if (!response.ok) throw Error('The recording library could not load.');
  catalog = await response.json();
  data = catalogRows(catalog, profile, progress.settings.script);
  words = data.filter((w) => !w.anchor);
  anchors = referenceRows(catalog, data);
  if (catalog.availability?.ready !== false && anchors.length !== profile.tones.length)
    throw Error('The tone references are incomplete.');
  controller = createGameController({
    profile,
    app,
    player,
    dialog,
    words,
    anchors,
    onFinish: finish,
    onRetry: begin,
    onHome: home,
    onPractice: (run) => practiceFromRun(run),
    onLearn: showLearn,
  });
  navigate(pageFromLocation(new URL(location.href), appBase, profile), {
    replace: true,
    focus: false,
  });
} catch (error) {
  app.innerHTML = /* HTML */ `<div class="loading-state">
    <h1>Couldn’t load Tone Tower.</h1>
    <p>${escape(error.message)}</p>
    <p>Check your connection, then try again.</p>
    <button class="primary" id="reload" type="button">Try again</button>
  </div>`;
  app.querySelector('#reload').onclick = () => location.reload();
}

function updateKeyboardViewport() {
  const viewport = window.visualViewport;
  const input = document.activeElement;
  const typing = screen === 'game' && input?.id === 'transcription-answer';
  document.body.classList.toggle(
    'keyboard-open',
    Boolean(
      typing &&
      viewport &&
      viewport.width <= 700 &&
      (Math.max(window.innerHeight, document.documentElement.clientHeight) - viewport.height >
        110 ||
        viewport.height < 540),
    ),
  );
  if (viewport)
    document.documentElement.style.setProperty('--visual-height', viewport.height + 'px');
}
window.visualViewport?.addEventListener('resize', updateKeyboardViewport);
document.addEventListener('focusin', updateKeyboardViewport);
document.addEventListener('focusout', () => setTimeout(updateKeyboardViewport, 0));
