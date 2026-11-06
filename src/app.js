import { practiceSetupMarkup } from './ui/practice-setup.js';
import { filterCredits, creditsPage } from './ui/credits.js';
import { catalogRows } from './content/catalog.js';
import { Player } from './audio/audio.js';
import { cantonese, challenges, defaultPractice, TONE_VARIANTS } from './game/game-core.js';
import {
  loadProgress,
  saveProgress,
  recordRun,
  resetProgress,
  challengeRecord,
  challengeRecords,
} from './persistence/progress.js';
import { createGameController } from './game/game-controller.js';
import { districts } from './world/worlds.js';
import { animateWorld } from './world/world-runtime.js';
import { destinations } from './world/pixel-world.js';
import { soundPageMarkup, aboutPageMarkup, compactGuideMarkup } from './ui/info-pages.js';
import { bindMapNavigation } from './ui/map-navigation.js';

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
const icon = (name) =>
  name === 'tone'
    ? '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 40V14h22v26M10 14h28L24 5ZM18 21h4v5h-4ZM27 21h4v5h-4ZM21 40v-9h6v9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 40h36" stroke="currentColor" stroke-width="1.6"/></svg>'
    : '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5C20 12 10 21 10 29a14 14 0 0 0 28 0C38 21 28 12 24 5Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 29c6-5 13 5 20 0M14 34c6-5 13 5 20 0" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

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
    eyebrow: 'Jyutping spelling',
    description: 'Listen, then type the sounds in Jyutping to build the next bridge. ',
    instruction: 'Listen, then type the Jyutping before the railcar reaches the gap.',
    end: 'Next stop: the horizon.',
  },
};
let progress = loadProgress(),
  data = [],
  words = [],
  anchors = [],
  controller = null,
  screen = 'home';
const persist = () => saveProgress(progress);
function sums(world, key) {
  return challengeRecords(progress, world).reduce((n, r) => n + (r[key] || 0), 0);
}
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
  document.title =
    {
      sounds: 'Jyutping guide · Tone Tower',
      about: 'About · Tone Tower',
      workshop: 'Practice Workshop · Tone Tower',
    }[view] || 'Tone Tower';
  setPageLocation(
    ['sounds', 'about', 'home'].includes(view) ? view : view === 'workshop' ? 'practice' : 'home',
    true,
  );
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

let selectedWorld = 'tone';
function home(world) {
  let practiceMode = false;
  const practiceConfigs = Object.fromEntries(
    ['tone', 'tide'].map((challenge) => {
      const saved = progress.settings.practice[challenge];
      return [
        challenge,
        {
          ...defaultPractice(challenge),
          ...saved,
          challenge,
          format: 'drill',
          start: 1,
          length: 20,
          spellingFocus: saved.spellingFocus || 'full',
          content: challenge === 'tide' ? 'mixed' : 'single',
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
  progress = loadProgress();
  app.innerHTML = /* HTML */ `<header class="home-intro">
      <div>
        <h1 tabindex="-1">Practise Jyutping.</h1>
        <p>
          Jyutping is a romanisation system for Cantonese. It writes pronunciation using Latin
          letters and tone numbers.
        </p>
      </div>
      <a class="intro-guide" href="#sounds" data-page="sounds"
        ><span>New to Jyutping?</span>A short introduction <span aria-hidden="true">→</span></a
      >
    </header>
    <div class="jyutping-intro" aria-label="Jyutping syllable example">
      <span class="intro-label"
        >A Jyutping syllable has an initial, a final and a tone number.</span
      >
      <div class="syllable-parts">
        <span><b>f</b><small>initial</small></span
        ><i aria-hidden="true">+</i><span><b>u</b><small>final</small></span
        ><i aria-hidden="true">+</i><span><b>2</b><small>tone</small></span
        ><i aria-hidden="true">=</i
        ><span class="syllable-result"
          ><b>fu2</b><small><span lang="zh-Hant">虎</span> · tiger</small></span
        >
      </div>
      <button type="button" class="hear-example" data-guide-tone="2" aria-label="Hear fu2">
        ▶ Hear fu2</button
      ><span id="guide-status" class="sr-only" role="status"></span>
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
          ><span id="rail-mode-description">Type the Jyutping you hear.</span>
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
          (variant === 'full' ? 'nei5 hou2' : 'nei hou') +
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
      variants.innerHTML = practiceSetupMarkup(config);
      variants.querySelectorAll('[data-practice-tone]').forEach(
        (button) =>
          (button.onclick = () => {
            const tone = Number(button.dataset.practiceTone);
            config.tones = config.tones.includes(tone)
              ? config.tones.filter((t) => t !== tone)
              : [...config.tones, tone].sort();
            if (config.choices > config.tones.length)
              config.choices = [2, 3, 4, 6].filter((n) => n <= config.tones.length).at(-1);
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
    ...defaultPractice(challenge),
    ...seed,
    challenge,
    variant: challenge === 'tone' ? 'normal' : variant,
    practice: true,
    format: 'drill',
    length: seed.length ?? 20,
    start: 1,
    content: seed.content ?? (challenge === 'tide' ? 'mixed' : 'single'),
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
  home();
  app.querySelector('#setup-practice')?.click();
  app.querySelector('#setup-practice')?.focus();
}

function begin(config) {
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
function seal(world, variant) {
  return /* HTML */ `<div class="summit-seal seal-${world}">
    <span class="seal-star" aria-hidden="true">✦</span>${icon(world)}<span
      >${world === 'tone' ? 'SUMMIT REACHED' : 'HIGHLINE COMPLETE'}</span
    ><strong>${variantName(world, variant)}</strong>
  </div>`;
}

function showResults(run) {
  resetView('results');
  app.dataset.world = run.world;
  const practice = run.config.practice,
    won = run.status === 'won',
    info = worldInfo[run.world],
    variant = run.config.variant;
  const record = challengeRecord(progress, run.world, variant, run.config.difficulty);
  const syllables = run.word?.syllables || [];
  app.innerHTML = /* HTML */ `<section class="results-view">
    <div class="eyebrow">
      ${practice ? 'Practice results' : won ? 'Adventure complete' : 'Run ended'}
    </div>
    <h1 tabindex="-1">
      ${practice ? 'Practice complete.' : won ? info.end : run.world === 'tone' ? 'Tower run ended.' : 'Skyrail run ended.'}
    </h1>
    <p class="lead">
      ${practice ? `${run.cleared} correct answer${run.cleared === 1 ? '' : 's'}. Review missed recordings or start another session.` : won ? `You ${info.verb} all 100 ${info.unit}. Your completion is saved in your records.` : `You ${info.verb} ${run.opened} ${info.unit}. Choose “Practise this” to work on the sounds you missed.`}
    </p>
    ${won && !practice ? seal(run.world, variant) : ''}
    <div class="result-metrics">
      <div>
        <strong>${run.cleared}</strong
        ><span>${practice ? 'Correct answers' : titleCase(info.unit) + ' cleared'}</span>
      </div>
      <div>
        <strong>${run.mistakes}</strong
        ><span>${run.world === 'tide' ? 'Missed answers' : 'Missed answers'}</span>
      </div>
      <div><strong>${run.assisted || 0}</strong><span>Assisted answers</span></div>
      ${!practice ? /* HTML */ `<div><strong>${record.best}</strong><span>Personal best · ${variantName(run.world, variant)}${run.world === 'tide' ? ' · ' + difficultyName(run.config.difficulty) : ''}</span></div>` : ''}
    </div>
    ${
      !won && run.lastFailure && syllables.length
        ? /* HTML */ `<div class="last-word feedback-card">
            <span class="eyebrow">One to listen to again</span>
            <div class="result-word">
              ${syllables.map((s) => /* HTML */ `<span>${escape(s.character)}<small>${escape(s.jyutping)}</small></span>`).join('')}
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
        ${practice ? 'Another practice' : won ? 'Go again' : 'Try again'}
        <span aria-hidden="true">→</span></button
      >${!won || practice ? '<button id="practise-result" class="secondary" type="button">Practise this</button>' : ''}<button
        id="result-home"
        class="text-button"
        type="button"
      >
        Back to the world map
      </button>
    </div>
    <button id="copy-summary" class="text-button" type="button">Copy session summary</button>
    <p id="copy-status" class="small" role="status"></p>
    <p class="result-footnote">
      ${practice ? 'Practice results stay separate from challenge records.' : ''}
    </p>
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
    const summary = `Tone Tower · ${info.title} · ${variantName(run.world, variant)}${run.world === 'tide' ? ' · ' + difficultyName(run.config.difficulty) : ''}${practice ? ' · Practice' : ''}\n${practice ? `${run.cleared} correct answers · ${run.config.format === 'rehearsal' ? `rehearsal from ${run.config.start}` : run.config.length === 'endless' ? 'open practice' : `${run.config.length}-question practice`}` : `${run.opened} ${info.unit}`} · ${run.mistakes} misses · ${run.assisted || 0} assisted${won ? ' · Adventure complete' : ''}`;
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
    ...defaultPractice(run.world),
    variant: run.config.variant,
    focusIds: [...new Set(run.missedIds || [])],
  };
  if (run.world === 'tone') {
    const pair = Object.entries(run.confusions || {})
      .sort((a, b) => b[1] - a[1])[0]?.[0]
      .split('-')
      .map(Number);
    if (pair?.length === 2) {
      config.tones = pair;
      config.choices = 2;
    }
  }
  if (run.world === 'tide' && config.focusIds.length) {
    const miss = words.find((w) => w.id === config.focusIds[0]);
    config.content = 'mixed';
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
          : anchors.find((word) => word.tone === Number(button.dataset.guideTone));
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
        if (status) status.textContent = 'Playing ' + anchor.jyutping + '…';
        try {
          await player.play(anchor.audio);
          if (current === request && status?.isConnected)
            status.textContent = button.dataset.guideWord
              ? anchor.jyutping + ' · ' + anchor.character
              : anchor.jyutping +
                ' · ' +
                cantonese.toneDefinitions.find((t) => t.value === anchor.tone).description;
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
  const hash = '#' + page;
  if (location.hash === hash) return;
  history[replace ? 'replaceState' : 'pushState'](
    null,
    '',
    location.pathname + location.search + hash,
  );
}
function bindInfoActions(container) {
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
      ? soundPageMarkup(anchors, cantonese.toneDefinitions, data)
      : aboutPageMarkup({ recordingCount: data.length });
  bindInfoActions(app);
  if (page === 'sounds') bindToneAudio(app);
}
function showAboutInGame() {
  const markup = aboutPageMarkup({ recordingCount: data.length })
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
  openDialog(compactGuideMarkup(anchors, cantonese.toneDefinitions));
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
          <a href="https://github.com/amadeusine/cc-canto-data" target="_blank" rel="noopener"
            >CC-Canto</a
          >, © 2015–2016 Pleco Software Incorporated, under
          <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>, and
          <a href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict">CC-CEDICT</a> under
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Individual
          manifest entries identify dictionary sources.
        </p>
        <p>
          Fraunces and DM Sans: <a href="assets/fonts/Fraunces-LICENSE.txt">Fraunces licence</a> ·
          <a href="assets/fonts/DMSans-LICENSE.txt">DM Sans licence</a>. Application code:
          <a href="LICENSE">MIT</a>. <a href="THIRD_PARTY_NOTICES.md">Third-party notices</a>. No
          accounts or analytics.
        </p>
      </details>
      <label class="credits-search"
        >Find a recording<input
          id="credit-search"
          type="search"
          placeholder="Character, Jyutping, creator…"
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
                    <td>${escape(w.character)}<small>${escape(w.jyutping)}</small></td>
                    <td>${escape(w.author || 'See original')}</td>
                    <td>
                      <a href="${safeHref(w.source)}" target="_blank" rel="noopener">Original ↗</a>
                      ·
                      <a href="${safeHref(w.licenseUrl)}" target="_blank" rel="noopener"
                        >${escape(w.license)}</a
                      >${w.conversion ? /* HTML */ `<small>${escape(w.conversion)}</small>` : ''}
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
      ' correct practice answers.</p><div class="reset-area"><button id="request-reset" class="text-button" type="button">Reset saved progress…</button><div id="reset-confirmation" hidden><p>This clears records and preferences in this browser.</p><button id="confirm-reset" class="danger-button" type="button">Reset everything</button><button id="cancel-reset" class="text-button" type="button">Keep my records</button></div></div>',
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
    progress = resetProgress();
    workshop = null;
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
window.addEventListener('hashchange', () => {
  if (controller) navigate(location.hash.slice(1), { replace: true });
});

try {
  const response = await fetch(new URL('../catalog.json', import.meta.url));
  if (!response.ok) throw Error('The recording library could not load.');
  data = catalogRows(await response.json());
  words = data.filter((w) => !w.anchor);
  anchors = data.filter((w) => w.anchor);
  if (anchors.length !== cantonese.tones.length) throw Error('The tone references are incomplete.');
  controller = createGameController({
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
  navigate(
    ['home', 'sounds', 'about', 'practice'].includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : 'home',
    { replace: true, focus: false },
  );
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
  const typing = screen === 'game' && input?.id === 'jyutping-answer';
  document.body.classList.toggle(
    'keyboard-open',
    Boolean(typing && viewport && window.innerHeight - viewport.height > 110),
  );
  if (viewport)
    document.documentElement.style.setProperty('--visual-height', viewport.height + 'px');
}
window.visualViewport?.addEventListener('resize', updateKeyboardViewport);
document.addEventListener('focusin', updateKeyboardViewport);
document.addEventListener('focusout', () => setTimeout(updateKeyboardViewport, 0));
