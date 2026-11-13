import { recordingIssueUrl } from '../ui/recording-report.js';
import { requireProfile } from '../languages/profiles.js';
import { createRun, challenges } from './game-core.js';
import { worldScene, districts, doorSlots } from '../world/worlds.js';
import { animateWorld } from '../world/world-runtime.js';
import { RAIL_CARS } from '../world/skyrail-world.js';

const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

// One authoritative clock drives both the deadline and the approaching rail gap.
// Playback and rendering never create a second, competing deadline.
export function createCountdown({
  now = () => Date.now(),
  setTimeout: later = globalThis.setTimeout,
  clearTimeout: cancel = globalThis.clearTimeout,
  onTick = () => {},
  onExpire = () => {},
} = {}) {
  let left = 0,
    total = 0,
    deadline = 0,
    handle = null,
    running = false,
    expired = false;
  const remaining = () => (running ? Math.max(0, deadline - now()) : left);
  function clearHandle() {
    if (handle !== null) cancel(handle);
    handle = null;
  }
  function tick() {
    handle = null;
    if (!running) return;
    left = remaining();
    onTick(left, total);
    if (left <= 0) {
      running = false;
      if (!expired) {
        expired = true;
        onExpire();
      }
      return;
    }
    handle = later(tick, Math.min(50, left));
  }
  return {
    start(ms) {
      clearHandle();
      total = left = Math.max(0, ms);
      expired = false;
      running = false;
      onTick(left, total);
      if (total > 0) this.resume();
    },
    pause() {
      left = remaining();
      running = false;
      clearHandle();
      onTick(left, total);
    },
    resume() {
      if (running || expired || !total) return;
      deadline = now() + left;
      running = true;
      tick();
    },
    clear() {
      clearHandle();
      running = false;
      left = total = 0;
      expired = false;
    },
    get remaining() {
      return remaining();
    },
    get total() {
      return total;
    },
    get running() {
      return running;
    },
  };
}

export function createGameController({
  profile,
  app,
  player,
  dialog,
  words,
  anchors = [],
  onFinish = () => {},
  onRetry = () => {},
  onHome = () => {},
  onPractice = () => {},
  onLearn = () => {},
  environment = {},
}) {
  requireProfile(profile);
  const doc = environment.document ?? globalThis.document;
  const later = environment.setTimeout ?? globalThis.setTimeout;
  const cancel = environment.clearTimeout ?? globalThis.clearTimeout;
  const animateScene = environment.animateWorld ?? animateWorld;
  let run = null,
    phase = 'idle',
    active = false,
    paused = false,
    pauseReason = '',
    attached = false;
  let generation = 0,
    audioGeneration = 0,
    auto = null,
    audioReady = false,
    audioFailed = false;
  let inputValue = '',
    message = '',
    towerReady = true,
    outcome = null,
    answeredPosition = 1;
  let restoreFocus = null,
    observer = null,
    sceneAnimator = null,
    entryVisual = false;
  const boundTyping = new WeakSet();
  const q = (selector) => app.querySelector(selector);
  const qa = (selector) => Array.from(app.querySelectorAll(selector));
  const isTide = () => run?.config.challenge === 'tide';
  const answering = () =>
    active &&
    !paused &&
    phase === 'answering' &&
    audioReady &&
    !audioFailed &&
    !dialog?.open &&
    !doc?.hidden;
  const clock = createCountdown({
    now: environment.now,
    setTimeout: later,
    clearTimeout: cancel,
    onTick: updateClock,
    onExpire: () => fail('timeout'),
  });

  function cancelAuto() {
    if (auto !== null) cancel(auto);
    auto = null;
  }
  function stopPlayback() {
    audioGeneration++;
    player.stop();
  }
  function stop({ keepScene = false } = {}) {
    if (!keepScene) {
      sceneAnimator?.dispose();
      sceneAnimator = null;
    }
    generation++;
    cancelAuto();
    clock.clear();
    stopPlayback();
  }
  function attach() {
    if (attached) return;
    attached = true;
    doc?.addEventListener('keydown', keydown);
    doc?.addEventListener('visibilitychange', visibility);
    dialog?.addEventListener('close', dialogClosed);
    const Observer = environment.MutationObserver ?? globalThis.MutationObserver;
    if (Observer && dialog) {
      observer = new Observer(() => {
        if (active && dialog.open) pause('dialog');
      });
      observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    }
  }
  function detach() {
    if (!attached) return;
    attached = false;
    doc?.removeEventListener('keydown', keydown);
    doc?.removeEventListener('visibilitychange', visibility);
    dialog?.removeEventListener('close', dialogClosed);
    observer?.disconnect();
    observer = null;
  }
  function visibility() {
    if (active && doc.hidden) pause('hidden');
  }
  function dialogClosed() {
    if (paused && pauseReason === 'dialog') resume();
  }
  function captureInput() {
    const input = q('#transcription-answer');
    if (input) inputValue = input.value;
  }
  function position() {
    if (run.config.practice && run.config.format === 'drill') return 1;
    return Math.max(
      1,
      Math.min(100, phase === 'correct' || phase === 'landing' ? answeredPosition : run.opened + 1),
    );
  }
  function district() {
    return (
      districts[run.config.challenge]?.[Math.min(4, Math.floor((position() - 1) / 20))] ?? {
        name: 'The ascent',
      }
    );
  }
  function presentation() {
    return paused
      ? 'paused'
      : audioFailed
        ? 'unavailable'
        : phase === 'review'
          ? run.lastFailure === 'timeout'
            ? 'timeout'
            : run.lastFailure === 'reveal'
              ? 'reveal'
              : 'wrong'
          : phase === 'correct' || phase === 'landing'
            ? 'success'
            : message && isTide()
              ? 'retry'
              : phase;
  }
  function instruction() {
    if (entryVisual) return 'Entering the tower… The first sound follows the opening.';
    if (phase === 'review')
      return run.lastFailure === 'timeout'
        ? 'Time’s up. Compare the answer below.'
        : run.lastFailure === 'reveal'
          ? 'Answer revealed. Take a closer look.'
          : 'Not quite. Compare the tones below.';
    if (phase === 'correct' || phase === 'landing')
      return run.config.practice ? '✓ Correct!' : '✓ Correct! The way is open.';
    if (phase === 'listening') return 'Listen to the recording…';
    return isTide()
      ? run.config.practice && run.config.spellingFocus !== 'full'
        ? 'Type only the ' +
          run.config.spellingFocus +
          (run.targets.length === 1 ? ' for the highlighted syllable.' : ' for the whole word.')
        : run.targets.length === 1
          ? 'Type the highlighted syllable.'
          : 'Type the whole word.'
      : 'Listen to the highlighted syllable and choose its tone number.';
  }
  function progressMarkup() {
    const drill = run.config.practice && run.config.format === 'drill',
      finite = drill && run.config.length !== 'endless';
    const label = drill
      ? run.attempts + (finite ? ' / ' + run.config.length : '')
      : run.opened +
        (isTide() ? ' ' : ' / 100 ') +
        (isTide()
          ? run.opened === 1
            ? 'span crossed'
            : 'spans crossed'
          : run.opened === 1
            ? 'floor lit'
            : 'floors lit');
    return '<span class="game-progress-label" role="status">' + label + '</span>';
  }
  function lifeMarkup() {
    if (run.lives === null)
      return '<span class="life-meter is-unlimited">Unlimited attempts</span>';
    return (
      '<span class="life-meter" role="img" aria-label="' +
      run.lives +
      ' of ' +
      run.maxLives +
      ' lives remaining">' +
      Array.from(
        { length: run.maxLives },
        (_, i) =>
          '<svg class="pixel-life ' +
          (i >= run.lives ? 'is-empty ' : '') +
          (phase === 'review' && i === run.lives
            ? 'heart-lost '
            : outcome?.recovered && i >= run.lives - outcome.recovered && i < run.lives
              ? 'is-restored '
              : '') +
          '" viewBox="0 0 20 22" aria-hidden="true"><path d="M1 5L5 1h4l1 3 1-3h4l4 4v7L10 21 1 12Z"/><path class="life-facet" d="M4 6h3v6H4m8-6h3v3h-3"/></svg>',
      ).join('') +
      '</span>'
    );
  }
  function promptMarkup(reveal = false) {
    return /* HTML */ `<div
      class="word-prompt"
      data-length="${run.word.syllables.length}"
      ${run.word.syllables.length >= 4 ? 'data-long="true"' : ''}
      style="--syllables:${run.word.syllables.length}"
    >
      <div class="prompt-syllables">
        ${run.word.syllables
          .map((s, i) => {
            const target = run.targets.includes(i),
              spelling = reveal
                ? profile.format(s.transcription)
                : !isTide()
                  ? profile.withoutTones(s.transcription)
                  : '';
            return /* HTML */ `<span class="prompt-syllable ${target ? 'is-target' : ''}"
              >${target && run.targets.length === 1 ? '<span class="target-label">Listen here</span>' : ''}<span
                class="prompt-character"
                >${escape(s.text)}</span
              ><span class="prompt-romanization"
                >${spelling ? escape(spelling) : '&nbsp;'}</span
              ></span
            >`;
          })
          .join('')}
      </div>
      ${reveal && run.word.syllables.some((s) => s.dictionaryTone !== undefined && s.dictionaryTone !== s.tone) ? '<p class="tone-explanation">Heard tones: ' + escape(run.word.syllables.map((s) => profile.toneDefinitions.find((d) => d.value === s.tone)?.label).join(' · ')) + '. Dictionary spelling: ' + escape(profile.format(run.word.transcription || run.word.syllables.map((s) => s.transcription).join(' '))) + '. Tone Tower follows this recording; Skyrail uses dictionary spelling.</p>' : ''}
      <p class="prompt-gloss">${escape(run.word.gloss)}</p>
    </div>`;
  }
  function toneButtons() {
    return run.choices
      .map(
        (t, index) =>
          /* HTML */ `<button
            style="${doorSlots(run.choices.length).map(([x, y, w, h]) => `left:${x / 4.8}%;top:${y / 2.4}%;width:${w / 4.8}%;height:${h / 2.4}%`)[index]}"
            type="button"
            class="tone-door ${(phase === 'correct' || phase === 'landing') && t === run.word.tone ? 'is-correct' : ''} ${phase === 'review' && t === run.word.tone ? 'is-answer' : ''} ${phase === 'review' && t === run.lastAnswer ? 'is-wrong' : ''}"
            data-tone="${t}"
            aria-label="${phase === 'review' && t === run.word.tone ? 'Correct answer: tone ' : phase === 'review' && t === run.lastAnswer ? 'Your choice: tone ' : 'Choose tone '}${t}"
            ${!answering() ? 'disabled' : ''}
          >
            ${phase === 'review' && t === run.word.tone ? '<span class="answer-mark" aria-hidden="true">✓</span>' : ''}<span
              class="tone-number"
              >${t}</span
            >${run.config.practice ? '<svg class="practice-tone-contour" viewBox="0 0 100 36" aria-hidden="true"><path d="' + profile.toneDefinitions.find((def) => def.value === t).path + '"/></svg>' : ''}<span
              class="tone-name"
              >${phase === 'review' && t === run.lastAnswer ? '✕ Your choice' : phase === 'review' && t === run.word.tone ? 'CORRECT' : escape(profile.toneDefinitions.find((def) => def.value === t).label)}</span
            ><kbd class="door-key"
              >${run.choices.length === 2 ? (run.choices.indexOf(t) === 0 ? '←' : '→') : run.choices.length === 3 ? ['←', '↑ ↓', '→'][run.choices.indexOf(t)] : run.choices.length === 4 ? ['↑', '←', '→', '↓'][run.choices.indexOf(t)] : t}</kbd
            >
          </button>`,
      )
      .join('');
  }
  function typedForm() {
    if (!isTide()) return '';
    const full = run.config.variant === 'full',
      focus = run.config.practice ? run.config.spellingFocus : 'full';
    const target =
      run.targets.length === 1
        ? `the highlighted syllable, ${escape(run.word.syllables[run.targets[0]].text)}`
        : 'the whole word';
    return /* HTML */ `<form id="typed-form" class="form-controls">
      <label for="transcription-answer"
        >${focus === 'initials' ? 'Initials' : focus === 'finals' ? 'Finals' : profile.romanization}
        for ${target}</label
      >
      <div class="answer-input-row">
        <input
          id="transcription-answer"
          name="answer"
          type="text"
          value="${escape(inputValue)}"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="go"
          aria-describedby="typed-help input-status"
          ${paused || !['listening', 'answering', 'correct'].includes(phase) ? 'disabled' : ''}
        /><button class="primary" id="check-answer" type="submit" ${!answering() ? 'disabled' : ''}>
          ${run.config.practice ? 'Check spelling' : 'Build span'} <span aria-hidden="true">→</span>
        </button>
      </div>
      ${profile.usesToneMarks ? '<div class="pinyin-tools" role="group" aria-label="Pinyin typing helpers"><button type="button" data-insert="ü">ü</button>' + [1, 2, 3, 4, 5].map((t) => '<button type="button" data-insert="' + t + '">' + (t === 5 ? '5 · neutral' : t) + '</button>').join('') + '</div>' : ''}
      <p id="typed-help" class="small">
        ${full ? (profile.allowWordSpaces ? 'Use tone marks or add a tone number after each ' : 'Add the tone number after each ') + (focus === 'initials' ? 'initial' : focus === 'finals' ? 'final' : 'syllable') + '.' : 'Tone numbers are optional.'}
        ${focus === 'initials' ? 'Use - for a syllable with no initial. ' : ''}${profile.allowWordSpaces ? 'Spaces separate syllables. Use Replay to listen again.' : 'Space replays the recording.'}
      </p>
      <p id="input-status" class="game-message" role="status">
        ${escape(message || (phase === 'review' ? 'Compare the answer above. Continue when ready.' : phase === 'landing' ? 'Checkpoint reached. Continue when ready.' : phase === 'correct' ? '✓ Accepted.' : run.config.practice ? 'Correct answers continue automatically. Take your time.' : 'Correct answers build automatically. Retries cost no lives.'))}
      </p>
    </form>`;
  }
  function railFeedback() {
    const review = phase === 'review',
      landing = phase === 'landing',
      correct = phase === 'correct';
    const text = audioFailed
      ? 'Recording unavailable. Clock stopped. Replay to retry.'
      : review
        ? (run.config.practice
            ? 'Not quite. Answer: '
            : 'Connection missed' + (run.lives === null ? '' : ' — 1 life lost') + '. Answer: ') +
          run.expected()
        : landing
          ? 'Station reached · ' + districts.tide[run.stage].name
          : correct
            ? run.config.practice
              ? '✓ Correct!'
              : '✓ Correct. Bridge restored.'
            : message || instruction();
    return (
      '<div class="rail-feedback" role="status" data-feedback="' +
      (audioFailed || review
        ? 'error'
        : landing || correct
          ? 'success'
          : message
            ? 'retry'
            : 'neutral') +
      '"><span id="rail-message">' +
      escape(text) +
      '</span>' +
      (audioFailed
        ? '<button class="primary rail-continue" id="replace-recording" type="button">Replace word →</button>'
        : '') +
      '</div>'
    );
  }
  const terminal = () => !run.config.practice && run.status !== 'playing';
  function sceneContinue() {
    if (isTide() && run.config.practice && run.status === 'complete')
      return '<div class="scene-review-action"><button class="primary" id="continue-game" type="button">See results <kbd>Enter</kbd> →</button></div>';
    return phase === 'review' && run.status === 'playing'
      ? '<div class="scene-review-action"><span>' +
          (isTide()
            ? 'Replay and compare with the answer above.'
            : 'Replay to hear the correct tone before continuing.') +
          '</span><button class="primary" id="continue-game" type="button">' +
          (run.config.practice
            ? 'Next recording'
            : isTide()
              ? 'Catch the next car'
              : 'Try the next sound') +
          ' <kbd>Enter</kbd> →</button></div>'
      : '';
  }
  function railInterlude() {
    if (!isTide() || phase !== 'landing' || terminal()) return '';
    const whole =
      run.config.target === 'whole' || (run.config.target === 'stage' && run.opened >= 40);
    return (
      '<section class="rail-interlude"><span class="eyebrow">' +
      escape(districts.tide[run.stage].name) +
      '</span><h2>Checkpoint reached.</h2><p>' +
      RAIL_CARS[run.stage] +
      ' car · ' +
      (run.timeLimit() ? Math.round(run.timeLimit() / 1000) + 's per word' : 'untimed') +
      '<br>Next: type ' +
      (whole ? 'the whole word' : 'the highlighted syllable') +
      '.' +
      (run.lives === null ? '' : ' All lives restored.') +
      '</p>' +
      towerContinue('Depart when ready') +
      '</section>'
    );
  }
  function runConclusion() {
    if (!terminal()) return '';
    const won = run.status === 'won';
    return (
      '<section class="run-conclusion ' +
      (!towerReady ? 'is-arriving' : '') +
      '" aria-labelledby="run-end-title"><span class="eyebrow">' +
      (won ? 'ADVENTURE COMPLETE' : 'RUN ENDED') +
      '</span><h2 id="run-end-title">' +
      (won
        ? isTide()
          ? 'Next stop: the horizon.'
          : 'The whole tower is alight.'
        : isTide()
          ? 'Skyrail run ended.'
          : 'Tower run ended.') +
      '</h2><p>' +
      run.opened +
      ' ' +
      (isTide() ? 'spans crossed' : 'floors lit') +
      ' · ' +
      run.mistakes +
      ' ' +
      (run.mistakes === 1 ? 'miss' : 'misses') +
      (won ? ' · Journey complete.' : '.') +
      '</p>' +
      (!won
        ? '<p class="ending-word">' +
          escape(run.word.syllables.map((s) => s.text + ' ' + s.transcription).join(' · ')) +
          ' <button class="text-button" id="ending-replay" type="button">▶ Listen again <kbd>Space</kbd></button></p>'
        : '') +
      '<div class="results-actions"><button class="primary" id="retry-run" type="button" ' +
      (!towerReady ? 'disabled' : '') +
      '>' +
      (won ? 'A new adventure' : 'Try again') +
      ' →</button><button class="secondary" id="ending-home" type="button" ' +
      (!towerReady ? 'disabled' : '') +
      '>World map</button>' +
      (!won
        ? '<button class="text-button" id="ending-practice" type="button" ' +
          (!towerReady ? 'disabled' : '') +
          '>Practise these sounds</button>'
        : '') +
      '</div></section>'
    );
  }
  function setRailNotice(text, kind = 'neutral') {
    const notice = q('#rail-message');
    if (notice) notice.textContent = text;
    const panel = q('.rail-feedback');
    if (panel) panel.dataset.feedback = kind;
  }
  const towerTerminal = () => !isTide() && run.status !== 'playing';
  const towerStop = () => phase === 'landing' || terminal() || towerTerminal();
  function towerContinue(label) {
    return (
      '<button class="primary" id="continue-game" type="button" ' +
      (!towerReady ? 'disabled' : '') +
      '>' +
      label +
      ' →</button>'
    );
  }
  function towerInterlude() {
    if (isTide()) return '';
    if (phase === 'landing') {
      const available =
          run.config.practice && run.config.format === 'drill'
            ? run.config.choices
            : Math.min(run.config.tones.length, profile.stageChoices[run.stage]),
        nextChoices = profile.choiceCounts.filter((n) => n <= available).at(-1);
      return (
        '<section class="tower-interlude" aria-label="Rest landing"><div class="landing-copy"><span class="eyebrow">LANDING ' +
        run.opened +
        '</span><h2>' +
        (run.lives === null ? 'Checkpoint reached.' : 'Lives refilled.') +
        '</h2><p>' +
        (run.lives === null ? 'Unlimited lives.' : run.lives + ' of ' + run.maxLives + ' lives.') +
        ' Next: ' +
        escape(districts.tone[run.stage].name) +
        ' · ' +
        nextChoices +
        ' doors.</p>' +
        towerContinue('Continue when ready') +
        '</div></section>'
      );
    }
    return '';
  }
  function towerEnding() {
    if (!towerTerminal() || terminal()) return '';
    const won = run.status === 'won',
      practice = run.config.practice && run.status === 'complete';
    return (
      '<section class="tower-run-end" aria-labelledby="tower-end-title"><span class="eyebrow">' +
      (practice ? 'PRACTICE TONES' : won ? '100 FLOORS · THE SUMMIT IS YOURS' : 'RUN ENDED') +
      '</span><h2 id="tower-end-title">' +
      (practice ? 'Practice complete.' : won ? 'The whole tower is alight.' : 'Tower run ended.') +
      '</h2><p>' +
      (won
        ? 'Take one last step into the open sky.'
        : run.cleared + ' ' + (practice ? 'correct answers' : 'floors lit') + '.') +
      '</p>' +
      towerContinue(
        practice ? 'See practice results' : won ? 'Step onto the summit' : 'Finish this climb',
      ) +
      '</section>'
    );
  }
  function unlockTowerStop() {
    cancelAuto();
    const own = generation,
      delay =
        run.config.practice || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          ? 0
          : phase === 'landing'
            ? 2400
            : 2800;
    auto = later(() => {
      auto = null;
      if (active && !paused && own === generation) {
        towerReady = true;
        render({ focus: false });
      }
    }, delay);
  }
  function towerFeedback() {
    const review = phase === 'review',
      landing = phase === 'landing',
      correct = phase === 'correct';
    const next = districts.tone[run.stage],
      restored = outcome?.recovered
        ? ' · ' +
          outcome.recovered +
          ' ' +
          (outcome.recovered === 1 ? 'life' : 'lives') +
          ' restored'
        : '';
    const text = audioFailed
      ? 'Recording unavailable. Replay to retry, or replace this word.'
      : towerTerminal()
        ? run.status === 'won'
          ? '✓ The last door opens. The summit is waiting.'
          : run.status === 'lost'
            ? 'No lives remain. The correct tone is ' + run.word.tone + '.'
            : '✓ Practice complete.'
        : review
          ? 'Not quite' +
            (run.lives === null ? '' : ' — 1 life lost') +
            '. Tone ' +
            run.lastAnswer +
            ' → tone ' +
            run.word.tone +
            '. The bright door is the correct tone.'
          : landing
            ? run.opened + ' floors lit · A rest landing. ' + next.name + ' is next.' + restored
            : correct
              ? '✓ Correct. Floor lit.' + restored
              : instruction();
    const action = audioFailed
      ? '<button class="primary tower-continue" id="replace-recording" type="button">Replace word →</button>'
      : '<span class="tower-action-space" aria-hidden="true"></span>';
    return (
      '<div class="tower-feedback" role="status" data-feedback="' +
      (audioFailed || review ? 'error' : landing || correct ? 'success' : 'neutral') +
      '"><span id="tower-message">' +
      escape(text) +
      '</span>' +
      action +
      '</div>'
    );
  }
  function pauseMarkup() {
    if (!paused) return '';
    return /* HTML */ `<section
      class="pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div class="pause-card">
        <p class="eyebrow">Paused</p>
        <h2 id="pause-title">Run paused.</h2>
        <p>Reloading or closing this page ends the run. Resume to continue.</p>
        <div class="game-actions">
          <button class="primary" id="resume-game" type="button">
            Resume <span aria-hidden="true">→</span></button
          >${run.config.practice ? '<button class="secondary" id="finish-paused-practice" type="button">Finish practice</button>' : ''}<button
            class="quiet"
            id="end-run"
            type="button"
          >
            End run & return
          </button>
        </div>
      </div>
    </section>`;
  }
  function clockMarkup() {
    if (!isTide()) return '';
    return (
      '<div class="rail-clock"><strong id="countdown" aria-live="off">' +
      (run.timeLimit()
        ? Math.ceil((clock.total ? clock.remaining : run.timeLimit()) / 1000) + 's'
        : '∞') +
      '</strong><span>' +
      (phase === 'review'
        ? 'Stopped'
        : phase === 'correct' || phase === 'landing'
          ? 'Span repaired'
          : run.timeLimit()
            ? 'To the gap'
            : 'Untimed practice') +
      '</span></div>'
    );
  }
  function syncScene() {
    const scene = q('.world-scene');
    if (!scene) return;
    const canvas = q('.world-canvas');
    if (!sceneAnimator || sceneAnimator.canvas !== canvas) {
      sceneAnimator?.dispose();
      sceneAnimator = animateScene(canvas);
    }
    const sceneState = {
      scene: isTide() ? 'rail' : 'tone',
      ending: terminal() ? run.status : null,
      progress: run.opened,
      count: run.choices.length,
      phase,
      reason: run.lastFailure,
      selected: run.choices.indexOf(run.lastAnswer),
      paused: paused || audioFailed,
      entry: entryVisual && phase === 'listening',
      floor: answeredPosition - 1,
      answer: run.choices.indexOf(run.word.tone),
      recovered: outcome?.recovered || 0,
      lives: run.lives,
      maxLives: run.maxLives,
      timed: run.timeLimit() > 0,
      remaining: (clock.total ? clock.remaining : run.timeLimit()) / 1000,
      approach:
        clock.total && ['answering', 'review'].includes(phase)
          ? Math.min(1, Math.max(0, 1 - clock.remaining / clock.total))
          : 0,
    };
    if (run.config.practice && run.config.format === 'drill')
      Object.assign(sceneState, {
        scene: isTide() ? 'rail' : 'tone',
        progress: 0,
        floor: 0,
        count: isTide() ? 2 : run.choices.length,
        phase: 'answering',
        reason: null,
        selected: -1,
        answer: -1,
        practice: true,
        recovered: 0,
        lives: null,
        maxLives: null,
        timed: false,
        entry: false,
      });
    sceneAnimator.update(sceneState);
  }
  function render({ focus = true } = {}) {
    if (!active) return;
    const d = district(),
      previousFrame = q('.scene-frame'),
      previousScene = q('.world-scene');
    const sceneKey = run.config.challenge;
    const keepScene =
      previousFrame &&
      previousScene &&
      previousScene.dataset.sceneKey === sceneKey &&
      typeof previousFrame.replaceWith === 'function';
    app.dataset.view = 'game';
    app.dataset.world = run.config.challenge;
    app.dataset.practice = String(run.config.practice);
    app.dataset.outcome = presentation();
    const markup = /* HTML */ `<div
      class="game-layout"
      data-outcome="${presentation()}"
      data-terminal="${terminal()}"
      data-landing="${phase === 'landing'}"
    >
      <div class="game-hud">
        <div class="run-title">
          <span class="eyebrow"
            >${run.config.practice ? 'Practice' : isTide() ? escape(run.config.difficulty + ' · ' + (run.config.variant === 'full' ? 'With tones' : 'Without tones')) : escape(run.config.variant + ' · ' + d.name)}</span
          >
          <h1>
            ${run.config.practice ? (isTide() ? (run.config.variant === 'full' ? 'Practice spelling + tones' : 'Practice spelling') : 'Practice tones') : escape(challenges[run.config.challenge].title)}
          </h1>
        </div>
        <div class="scene-status">
          ${lifeMarkup()}
          <div class="game-progress">${progressMarkup()}</div>
        </div>
        ${run.config.practice ? '' : clockMarkup()}<button
          class="quiet"
          id="pause-run"
          type="button"
          aria-label="Pause game"
        >
          Ⅱ
        </button>
      </div>
      <div class="scene-question">
        ${isTide() ? railFeedback() : towerFeedback()}${promptMarkup(['review', 'correct', 'landing'].includes(phase))}
        <div class="prompt-actions">
          <button class="secondary" id="replay-word" type="button">
            ▶ Replay <kbd>Space</kbd>
          </button>
          ${['review', 'correct', 'landing'].includes(phase) ? '<a class="recording-report text-button" href="' + escape(recordingIssueUrl(run.word, profile)) + '" target="_blank" rel="noopener">Report recording ↗</a>' : ''}
        </div>
        ${towerEnding()}
      </div>
      <div class="scene-frame">
        ${worldScene(run.config.challenge, { position: position(), phase: paused ? 'paused' : phase, content: (isTide() ? railInterlude() : toneButtons() + towerInterlude()) + sceneContinue(), count: run.choices.length })}
      </div>
      ${isTide() ? /* HTML */ `<div class="typing-slot">${typedForm()}</div>` : ''}
      <div class="game-panel">
        ${runConclusion()}
        <div class="feedback-zone"></div>
        <div class="game-actions">
          ${run.config.practice && run.status === 'playing' ? '<button class="quiet" id="finish-practice" type="button">Finish practice</button>' : ''}
        </div>
        <p id="audio-status" class="game-message sr-only" role="status">
          ${entryVisual ? 'Entering the tower…' : phase === 'listening' ? 'Listening…' : audioFailed ? 'Replay to retry the recording.' : ''}
        </p>
        <div id="audio-error" class="error" role="alert"></div>
        <p class="small keyboard">
          ${isTide() ? (run.config.practice ? 'Enter checks spelling · Space / R replays' : 'Enter builds · Space / R replays') : (run.choices.length <= 4 ? 'Arrow keys choose · ' : '') + profile.tones.join(' / ') + ' choose a tone · Space / R replays'}
          · Esc pauses${['review', 'landing'].includes(phase) ? ' · Enter continues' : ''}
        </p>
      </div>
      ${pauseMarkup()}
    </div>`;
    // Keep the live input and canvas mounted: mobile keyboards and travel survive a word change.
    const keepMounted = keepScene && typeof doc?.createElement === 'function';
    if (keepMounted) {
      const next = doc.createElement('div');
      next.innerHTML = markup;
      for (const selector of ['.game-hud', '.scene-question', '.game-panel'])
        q(selector).replaceWith(next.querySelector(selector));
      if (isTide()) {
        const input = q('#transcription-answer'),
          fresh = next.querySelector('#transcription-answer');
        input.value = inputValue;
        input.disabled = fresh.disabled;
        input.removeAttribute('aria-invalid');
        q('#check-answer').disabled = next.querySelector('#check-answer').disabled;
        q('#typed-form > label').textContent =
          next.querySelector('#typed-form > label').textContent;
        q('#typed-help').textContent = next.querySelector('#typed-help').textContent;
        q('#input-status').textContent = next.querySelector('#input-status').textContent;
      }
      previousScene.querySelector('.scene-content').innerHTML =
        next.querySelector('.scene-content').innerHTML;
      previousScene.querySelector('.world-sr-only').textContent =
        next.querySelector('.world-sr-only').textContent;
      previousScene.dataset.count = String(run.choices.length);
      q('.game-layout').dataset.landing = String(phase === 'landing');
      q('.game-layout').dataset.terminal = String(terminal());
      q('.game-layout').dataset.outcome = presentation();
      previousScene.dataset.phase = paused ? 'paused' : phase;
      q('.pause-overlay')?.remove();
      const overlay = next.querySelector('.pause-overlay');
      if (overlay) q('.game-layout').append(overlay);
    } else app.innerHTML = markup;
    if (keepScene && !keepMounted) {
      const nextFrame = q('.scene-frame'),
        nextScene = q('.world-scene');
      previousScene.dataset.phase = nextScene.dataset.phase;
      previousScene.dataset.count = String(run.choices.length);
      previousScene.querySelector('.world-sr-only').textContent =
        nextScene.querySelector('.world-sr-only').textContent;
      previousScene.querySelector('.scene-content').innerHTML =
        nextScene.querySelector('.scene-content').innerHTML;
      nextFrame.replaceWith(previousFrame);
    }
    const mounted = q('.world-scene');
    if (mounted) mounted.dataset.sceneKey = sceneKey;
    bind();
    updateClock(clock.remaining, clock.total);
    syncScene();
    if (focus) {
      if (terminal() && !paused) {
        if (towerReady) q('#retry-run')?.focus({ preventScroll: true });
        return;
      }
      if (paused) q('#resume-game')?.focus({ preventScroll: true });
      else if (['review', 'landing'].includes(phase))
        q('#continue-game')?.focus({ preventScroll: true });
      else if (isTide()) {
        q('#transcription-answer')?.focus({ preventScroll: true });
        q('#transcription-answer')?.setSelectionRange(inputValue.length, inputValue.length);
      }
    }
  }
  function bind() {
    qa('.game-layout > :not(.pause-overlay)').forEach((element) => {
      element.inert = paused;
    });
    qa('[data-tone]').forEach((button) =>
      button.addEventListener('click', () =>
        choose(profile.tones.find((t) => String(t) === button.dataset.tone)),
      ),
    );
    qa('[data-insert]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => event.preventDefault());
      button.addEventListener('click', () => {
        const input = q('#transcription-answer');
        if (!input || input.disabled || input.composing) return;
        const start = input.selectionStart ?? input.value.length,
          end = input.selectionEnd ?? start;
        input.value = input.value.slice(0, start) + button.dataset.insert + input.value.slice(end);
        input.focus();
        input.setSelectionRange(
          start + button.dataset.insert.length,
          start + button.dataset.insert.length,
        );
        captureInput();
        submit(true);
      });
    });
    const form = q('#typed-form'),
      input = q('#transcription-answer');
    if (form && !boundTyping.has(form)) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit(false);
      });
      boundTyping.add(form);
    }
    if (input && !boundTyping.has(input)) {
      input.addEventListener('input', () => {
        captureInput();
        message = '';
        app.dataset.outcome = presentation();
        q('.game-layout').dataset.outcome = presentation();
        q('#input-status').textContent = run.config.practice
          ? 'Correct answers continue automatically. Take your time.'
          : 'Correct answers build automatically. Retries cost no lives.';
        q('#transcription-answer')?.removeAttribute('aria-invalid');
        if (!audioFailed) setRailNotice(instruction());
        if (!input.composing) submit(true);
      });
      input.addEventListener('compositionstart', () => {
        input.composing = true;
      });
      input.addEventListener('compositionend', () => {
        input.composing = false;
        captureInput();
        submit(true);
      });
      boundTyping.add(input);
    }

    q('#retry-run')?.addEventListener('click', () => {
      if (!towerReady) return;
      const config = { ...run.config };
      dispose();
      onRetry(config);
    });
    q('#ending-home')?.addEventListener('click', () => {
      if (towerReady) {
        dispose();
        onHome();
      }
    });
    q('#ending-practice')?.addEventListener('click', () => {
      if (towerReady) {
        const previous = run;
        dispose();
        onPractice(previous);
      }
    });
    q('#ending-replay')?.addEventListener('click', replay);
    q('#replay-word')?.addEventListener('click', replay);
    q('#pause-run')?.addEventListener('click', () => pause());
    q('#continue-game')?.addEventListener('click', advance);
    q('#resume-game')?.addEventListener('click', resume);
    q('#end-run')?.addEventListener('click', () => {
      dispose();
      onHome();
    });
    q('#finish-practice')?.addEventListener('click', finishPractice);
    q('#finish-paused-practice')?.addEventListener('click', finishPractice);
    q('#reveal-answer')?.addEventListener('click', () => fail('reveal'));
    q('#replace-recording')?.addEventListener('click', replace);
    q('#game-learn')?.addEventListener('click', () => {
      run.markAssisted();
      pause('dialog');
      onLearn({ returnToGame: true });
    });
  }
  function updateClock(left, total) {
    if (!active) return;
    const count = q('#countdown'),
      initialLimit = !audioReady ? run.timeLimit() : 0;
    if (count)
      count.textContent = total
        ? Math.ceil(left / 1000) + 's'
        : initialLimit
          ? Math.ceil(initialLimit / 1000) + 's'
          : '∞';
    const scene = q('.world-scene'),
      fraction =
        phase === 'review' && run.lastFailure === 'timeout'
          ? 1
          : total
            ? Math.min(1, Math.max(0, 1 - left / total))
            : 0;
    scene?.style.setProperty('--rail-progress', `${fraction * 100}%`);
    scene?.classList.toggle('is-danger', fraction >= 0.75);
    count?.classList.toggle('danger', fraction >= 0.75);
    syncScene();
  }
  function enableAnswers() {
    qa('[data-tone]').forEach((button) => (button.disabled = !answering()));
    for (const selector of ['#check-answer', '#reveal-answer']) {
      const button = q(selector);
      if (button) button.disabled = !answering();
    }
  }
  async function playPrompt() {
    if (!active || paused || dialog?.open || doc?.hidden) return;
    const own = ++audioGeneration,
      current = generation,
      first = !audioReady;
    if (first) phase = 'listening';
    const status = q('#audio-status');
    if (status) status.textContent = 'Listening…';
    enableAnswers();
    try {
      await player.play(run.word.audio);
      if (!active || own !== audioGeneration || current !== generation || paused) return;
      const wasFailed = audioFailed;
      audioReady = true;
      audioFailed = false;
      if (wasFailed) message = '';
      if (first) {
        entryVisual = false;
        phase = 'answering';
        clock.start(run.timeLimit());
      } else if (wasFailed) clock.resume();
      if (wasFailed) render({ focus: false });
      app.dataset.outcome = presentation();
      q('.game-layout').dataset.outcome = presentation();
      const error = q('#audio-error');
      if (error) error.textContent = '';
      if (status)
        status.textContent = isTide() ? 'Type your answer.' : 'Choose the tone number you heard.';
      const instructionNode = q('.game-instruction');
      if (instructionNode) instructionNode.textContent = instruction();
      if (isTide()) setRailNotice(message || instruction(), message ? 'retry' : 'neutral');
      else {
        const notice = q('#tower-message');
        if (notice) notice.textContent = instruction();
      }
      const scene = q('.world-scene');
      if (scene) scene.dataset.phase = phase;
      enableAnswers();
      syncScene();
      if (isTide()) submit(true);
    } catch (error) {
      if (!active || own !== audioGeneration || current !== generation || paused) return;
      clock.pause();
      captureInput();
      audioFailed = true;
      message = 'Sound is unavailable. Replay to retry, or replace this word without penalty.';
      render({ focus: false });
    }
  }
  function replay() {
    if (!active || paused || dialog?.open || doc?.hidden) return;
    if (entryVisual) {
      cancelAuto();
      entryVisual = false;
      render({ focus: false });
    }
    if (['listening', 'answering'].includes(phase)) {
      playPrompt();
      return;
    }
    const own = ++audioGeneration;
    player.play(run.word.audio).catch(() => {
      if (own === audioGeneration && active) {
        const error = q('#audio-error');
        if (error) error.textContent = 'This recording could not play. You can still continue.';
      }
    });
  }
  function playOpening() {
    cancelAuto();
    const own = generation;
    // The entrance takes 1.8s. Leave a short beat before the first recording.
    auto = later(() => {
      auto = null;
      if (!active || paused || own !== generation) return;
      entryVisual = false;
      render({ focus: false });
      playPrompt();
    }, 2000);
  }
  function beginPrompt() {
    cancelAuto();
    clock.clear();
    stopPlayback();
    audioReady = false;
    audioFailed = false;
    inputValue = '';
    message = '';
    towerReady = true;
    outcome = null;
    phase = 'listening';
    answeredPosition = run.opened + 1;
    render();
    player.preload?.([run.word.audio]);
    if (doc?.hidden || dialog?.open) pause(doc?.hidden ? 'hidden' : 'dialog');
    else if (entryVisual) playOpening();
    else playPrompt();
  }
  function choose(value) {
    if (!answering()) return;
    const result = run.answer(value);
    if (result?.kind === 'empty') return;
    settle(result);
  }
  function submit(quiet = false) {
    if (!isTide() || !answering() || q('#transcription-answer')?.composing) return;
    captureInput();
    if (clock.total && clock.remaining <= 0) {
      fail('timeout');
      return;
    }
    const expected = run.expectedParts();
    if (
      quiet &&
      profile.evaluate(
        inputValue,
        expected,
        run.config.variant === 'full',
        run.config.practice ? run.config.spellingFocus : 'full',
      ) !== true
    )
      return;
    const result = run.answer(inputValue);
    if (result?.kind === 'empty') {
      message = 'Type your answer first.';
      setRailNotice(message, 'retry');
      const status = q('#input-status');
      if (status) status.textContent = message;
      return;
    }
    if (run.config.practice && result?.reason === 'spelling') {
      settle(result);
      return;
    }
    if (!result?.correct) {
      message = run.config.practice
        ? 'Not quite — try again.'
        : 'Not quite—try again. No life lost.';
      setRailNotice(message, 'retry');
      q('#transcription-answer')?.setAttribute('aria-invalid', 'true');
      const status = q('#input-status');
      if (status) status.textContent = message;
      app.dataset.outcome = 'retry';
      q('.game-layout').dataset.outcome = 'retry';
      q('#transcription-answer')?.focus({ preventScroll: true });
      return;
    }
    settle(result);
  }
  function settle(result) {
    clock.pause();
    cancelAuto();
    stopPlayback();
    message = '';
    outcome = result;
    phase = result.correct ? (result.landing ? 'landing' : 'correct') : 'review';
    towerReady = !towerStop();
    render();
    if (terminal()) onFinish(run);
    if (towerStop()) unlockTowerStop();
    else if (result.correct && phase === 'correct') scheduleAdvance();
  }
  function scheduleAdvance() {
    const own = generation;
    cancelAuto();
    auto = later(
      () => {
        auto = null;
        if (active && !paused && own === generation) advance();
      },
      run.config.practice ? 900 : isTide() ? 900 : 1700,
    );
  }
  function fail(reason) {
    if (!answering()) return;
    captureInput();
    clock.pause();
    stopPlayback();
    cancelAuto();
    outcome = run.fail(reason, inputValue);
    if (isTide()) run.lastAnswer = inputValue;
    message = '';
    phase = 'review';
    towerReady = !towerStop();
    render();
    if (terminal()) onFinish(run);
    if (towerStop()) unlockTowerStop();
  }
  function advance() {
    if (
      !active ||
      paused ||
      terminal() ||
      !['review', 'correct', 'landing'].includes(phase) ||
      (towerStop() && !towerReady)
    )
      return;
    cancelAuto();
    if (run.status !== 'playing') {
      finish();
      return;
    }
    try {
      run.next();
      beginPrompt();
    } catch (error) {
      interrupt(error);
    }
  }
  function replace() {
    if (!active || paused || !audioFailed) return;
    stop({ keepScene: true });
    try {
      run.replace();
      beginPrompt();
    } catch (error) {
      interrupt(error);
    }
  }
  function interrupt(error) {
    clock.pause();
    cancelAuto();
    stopPlayback();
    phase = 'interrupted';
    app.innerHTML = /* HTML */ `<section class="game-panel">
      <p class="eyebrow">Recording unavailable</p>
      <h1>We couldn’t find the next recording.</h1>
      <p>${escape(error.message)}</p>
      <p>Your score has not changed.</p>
      <button class="primary" id="interrupted-home" type="button">Return to the map</button
      >${run.config.practice ? '<button class="secondary" id="interrupted-finish" type="button">Finish practice</button>' : ''}
    </section>`;
    q('#interrupted-home')?.addEventListener('click', () => {
      dispose();
      onHome();
    });
    q('#interrupted-finish')?.addEventListener('click', finishPractice);
    q('#interrupted-home')?.focus();
  }
  function finishPractice() {
    if (!active || !run.config.practice) return;
    run.finish();
    finish();
  }
  function finish() {
    if (!active) return;
    const completed = run;
    stop();
    active = false;
    phase = 'finished';
    paused = false;
    detach();
    onFinish(completed);
  }
  function pause(reason = 'manual') {
    if (!active || paused) return;
    captureInput();
    restoreFocus = doc?.activeElement?.id ?? null;
    paused = true;
    pauseReason = reason;
    clock.pause();
    cancelAuto();
    stopPlayback();
    render();
  }
  function resume() {
    if (!active || !paused || dialog?.open || doc?.hidden) return;
    paused = false;
    pauseReason = '';
    render({ focus: false });
    if (restoreFocus) q('#' + restoreFocus)?.focus();
    else if (isTide()) q('#transcription-answer')?.focus();
    if (['listening', 'answering'].includes(phase)) {
      if (entryVisual) playOpening();
      else if (!audioReady) playPrompt();
      else if (!audioFailed) clock.resume();
      enableAnswers();
    } else if (towerStop() && !towerReady) unlockTowerStop();
    else if (phase === 'correct' && !towerStop()) scheduleAdvance();
  }
  function keydown(event) {
    if (!active || dialog?.open || doc?.hidden) return;
    if (paused && event.key === 'Tab') {
      const controls = ['#resume-game', '#finish-paused-practice', '#end-run']
        .map(q)
        .filter(Boolean);
      const index = controls.indexOf(doc?.activeElement),
        next = event.shiftKey
          ? index <= 0
            ? controls.length - 1
            : index - 1
          : (index + 1) % controls.length;
      event.preventDefault();
      controls[next]?.focus();
      return;
    }
    if (event.repeat || event.isComposing) return;
    const tag = event.target?.tagName?.toLowerCase(),
      typing = ['input', 'textarea', 'select'].includes(tag) || event.target?.isContentEditable;
    if (event.key === 'Escape') {
      event.preventDefault();
      paused ? resume() : pause();
      return;
    }
    if (paused) return;
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      (event.key === ' ' ||
        (event.key.toLowerCase() === 'r' && !(typing && profile.allowWordSpaces)))
    ) {
      if (typing && profile.allowWordSpaces && event.key === ' ') return;
      event.preventDefault();
      replay();
      return;
    }
    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter' && (['review', 'landing'].includes(phase) || towerTerminal())) {
      event.preventDefault();
      advance();
      return;
    }
    if (event.key === ' ' || event.key.toLowerCase() === 'r') {
      event.preventDefault();
      replay();
      return;
    }
    if (!isTide() && answering()) {
      if (profile.tones.some((t) => String(t) === event.key)) {
        event.preventDefault();
        choose(profile.tones.find((t) => String(t) === event.key));
      } else {
        const index = arrowChoiceIndex(run.choices.length, event.key);
        if (index !== null) {
          event.preventDefault();
          choose(run.choices[index]);
        }
      }
    }
  }
  function dispose() {
    stop();
    active = false;
    paused = false;
    phase = 'idle';
    detach();
  }
  return {
    start(config) {
      dispose();
      run = createRun(config, words, { profile });
      entryVisual = run.config.challenge === 'tone' && !run.config.practice;
      active = true;
      attach();
      beginPrompt();
      return run;
    },
    pause,
    resume,
    dispose,
    setScript(script) {
      const update = (word) => {
        word.text = word.forms?.[script] ?? word.forms?.default ?? word.text;
        for (const syllable of word.syllables)
          syllable.text = syllable.forms?.[script] ?? syllable.forms?.default ?? syllable.text;
      };
      words.forEach(update);
      if (run) update(run.word);
      if (active) {
        captureInput();
        render({ focus: false });
      }
    },
    get active() {
      return active;
    },
    get state() {
      return run;
    },
    get phase() {
      return phase;
    },
  };
}

// Four doors form a compass; three doors share the middle vertical key.
export function arrowChoiceIndex(count, key) {
  const layouts = {
    2: { ArrowLeft: 0, ArrowRight: 1 },
    3: { ArrowLeft: 0, ArrowUp: 1, ArrowDown: 1, ArrowRight: 2 },
    4: { ArrowUp: 0, ArrowLeft: 1, ArrowRight: 2, ArrowDown: 3 },
    5: { ArrowUp: 0, ArrowLeft: 1, ArrowRight: 2, ArrowDown: 4 },
  };
  return layouts[count]?.[key] ?? null;
}
