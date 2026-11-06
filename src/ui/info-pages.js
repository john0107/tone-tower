import { site } from '../site.js';

const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

function toneExamples(anchors, toneDefinitions) {
  return /* HTML */ `<div class="guide-tones">
      ${toneDefinitions
        .map((tone) => {
          const word = anchors.find((anchor) => anchor.tone === tone.value);
          return /* HTML */ `<button
            class="guide-tone"
            data-guide-tone="${escape(tone.value)}"
            type="button"
            aria-label="Hear ${escape(word?.jyutping || `tone ${tone.value}`)}, ${escape(tone.description)}"
          >
            <span class="guide-tone-number">${escape(tone.value)}</span>
            <svg viewBox="0 0 100 36" aria-hidden="true"><path d="${escape(tone.path)}" /></svg>
            <strong>${escape(word?.jyutping || '')}</strong>
            <span
              ><span lang="zh-Hant">${escape(word?.character || '')}</span> ·
              ${escape(word?.gloss || '')}</span
            >
            <small>${escape(tone.description)}</small>
          </button>`;
        })
        .join('')}
    </div>
    <p id="guide-status" class="small" role="status" aria-live="polite">
      Choose a tone to listen. Replay and compare as often as you like.
    </p>`;
}

export function guideResourcesMarkup() {
  return /* HTML */ `<div class="resource-links">
    <a
      href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide"
      target="_blank"
      rel="noopener"
      >Open Cantonese: pronunciation lessons ↗<span class="resource-type"
        >English explanations · lessons with audio · for learning the sounds</span
      ><span
        >Introduces initials, finals and tones progressively, with mouth-position instructions and
        exercises.</span
      ></a
    >
    <a href="https://www.youtube.com/watch?v=MOsf0BcLzlc" target="_blank" rel="noopener"
      >TypeDuck: Learn LSHK Jyutping in 52 minutes ↗<span class="resource-type"
        >Cantonese narration · video · for learners who can follow spoken Cantonese</span
      ><span
        >An introduction, pronunciation demonstrations and exercises. Particularly relevant if you
        already know Cantonese and are learning its spelling.</span
      ></a
    >
    <a href="https://jyutping.org/en/learn/" target="_blank" rel="noopener"
      >Jyutping.org: guide for English speakers ↗<span class="resource-type"
        >English explanations · illustrated guide with audio</span
      ><span
        >Explains spelling and pronunciation through comparisons with English. Use those comparisons
        where they are familiar to you.</span
      ></a
    >
    <a
      href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/jyutping-chart"
      target="_blank"
      rel="noopener"
      >Open Cantonese: interactive sound chart ↗<span class="resource-type"
        >English labels · audio reference · for looking up a sound</span
      ><span
        >The full set of initials, finals and tones, with recordings and links to their
        pronunciation lessons.</span
      ></a
    >
    <a href="https://lshk.org/jyutping-scheme/" target="_blank" rel="noopener"
      >LSHK: official Jyutping scheme ↗<span class="resource-type"
        >English and Chinese · spelling reference</span
      ><span
        >The Linguistic Society of Hong Kong’s standard, including complete tables and notation
        conventions.</span
      ></a
    >
    <a href="https://www.typeduck.hk/jyutping/" target="_blank" rel="noopener"
      >TypeDuck: downloadable Jyutping cheatsheet ↗<span class="resource-type"
        >Chinese and English · spelling and typing reference · assumes familiar Cantonese
        words</span
      ><span
        >Examples connect Hong Kong name and place spellings with their Jyutping. Useful when you
        already know the words and are learning to type them.</span
      ></a
    >
  </div>`;
}

function wordExamples(recordings, spellings, label) {
  const examples = spellings.map((jyutping) =>
    recordings.find((word) => word.jyutping === jyutping),
  );
  if (examples.some((word) => !word)) return '';
  return /* HTML */ `<div class="guide-example-block">
    <div class="guide-comparison" role="group" aria-label="${escape(label)}">
      ${examples.map((word) => /* HTML */ `<button class="secondary" data-guide-word="${escape(word.id)}" type="button" aria-label="Hear ${escape(word.jyutping)}, ${escape(word.character)}"><span aria-hidden="true">▶</span> <b>${escape(word.jyutping)}</b> <span lang="zh-Hant">${escape(word.character)}</span></button>`).join('')}
    </div>
    <p class="small guide-example-status" role="status" aria-live="polite"></p>
  </div>`;
}

export function soundPageMarkup(anchors, toneDefinitions, recordings = []) {
  const example = anchors.find((word) => word.tone === 2);
  return /* HTML */ `<article class="info-page sound-page">
    <header class="page-heading">
      <button class="text-button back-link" data-page="home" type="button">← World map</button>
      <span class="eyebrow" lang="zh-Hant">粵拼</span>
      <h1 tabindex="-1">Jyutping guide</h1>
      <p class="lead guide-introduction">
        Jyutping is a system for writing Cantonese pronunciation with Latin letters and tone
        numbers. Developed by the
        <a href="https://lshk.org/jyutping-scheme/" target="_blank" rel="noopener"
          >Linguistic Society of Hong Kong in 1993</a
        >, it helps you read a word’s pronunciation even before you know its Chinese characters.
      </p>
    </header>
    <section class="info-section" aria-labelledby="jyutping-heading">
      <h2 id="jyutping-heading">Syllable structure</h2>
      <p>
        An <b>initial</b> starts the sound. A <b>final</b> is the vowel and any ending. The
        <b>tone number</b> tells you the pitch pattern of the whole syllable.
      </p>
      <div class="syllable-lesson">
        <div
          class="lesson-equation"
          aria-label="f, initial, plus u, final, plus 2, tone, equals fu2"
        >
          <span><b>f</b><small>initial</small></span
          ><i aria-hidden="true">+</i> <span><b>u</b><small>final</small></span
          ><i aria-hidden="true">+</i> <span class="lesson-tone"><b>2</b><small>tone</small></span
          ><i aria-hidden="true">=</i>
          <span class="lesson-result"
            ><b>fu2</b
            ><small
              ><span lang="zh-Hant">${escape(example?.character || '虎')}</span> ·
              ${escape(example?.gloss || 'tiger')}</small
            ></span
          >
        </div>
        <button data-guide-tone="2" class="secondary" type="button" aria-label="Hear fu2, tone 2">
          ▶ Hear fu2
        </button>
      </div>
      <p>
        In <b>gong2</b> (<span lang="zh-Hant">講</span>, speak), the parts are <b>g + ong + 2</b>.
        The final is <b>ong</b>: the vowel <b>o</b> and the ending <b>ng</b>.
      </p>
      <p class="small">
        Some syllables have no initial: <b>aa3</b> starts directly with a vowel. Keep the tone digit
        after each syllable, on the same line: <b>nei5 hou2</b> (<span lang="zh-Hant">你好</span>,
        hello).
      </p>
      <p class="small">
        See the
        <a href="https://lshk.org/jyutping-scheme/" target="_blank" rel="noopener"
          >official scheme</a
        >
        for the full set of initials, vowels and endings.
      </p>
    </section>
    <section class="info-section" aria-labelledby="starting-heading">
      <h2 id="starting-heading">How to use this guide</h2>
      <div class="info-grid guide-starting-points">
        <div class="info-card">
          <h3>If you know Cantonese</h3>
          <p>
            If you already speak or understand Cantonese, much of the task may be learning how
            familiar sounds are written. Compare words you know with their Jyutping, paying
            attention to the initial, final and tone number.
          </p>
          <p>
            This
            <a href="https://www.youtube.com/watch?v=MOsf0BcLzlc" target="_blank" rel="noopener"
              >video tutorial</a
            >
            is taught in Cantonese and demonstrates the spelling system.
          </p>
        </div>
        <div class="info-card">
          <h3>If the sounds are new</h3>
          <p>
            Learn the pronunciation and spelling together. Listen to examples, practise producing
            the sounds, and compare contrasting words. Recognising a sound and pronouncing it are
            related skills that both need attention.
          </p>
          <p>
            The
            <a
              href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide"
              target="_blank"
              rel="noopener"
              >Open Cantonese lessons</a
            >
            provide explanations in English, with recordings and mouth-position guidance.
          </p>
        </div>
      </div>
      <p>
        You may need elements of both approaches, particularly if you understand more Cantonese than
        you speak.
      </p>
      <details class="guide-detail">
        <summary>How your other languages affect pronunciation learning</summary>
        <p>
          The sound categories you have learnt in other languages influence how you hear and produce
          new sounds. Two Cantonese sounds may initially seem alike if you associate both with one
          familiar sound. Experience with another language can also make a contrast more familiar.
        </p>
        <p>
          This depends on the particular contrast and your experience, rather than a simple ranking
          of languages by difficulty. For example, Cantonese <b>yu</b> is a vowel made with the
          front of the tongue raised and the lips rounded. Learners familiar with this combination
          have a different starting point from those learning it for the first time.
        </p>
        <p>
          Comparisons with English in this guide are labelled as such. They are approximate aids,
          not the definitions of Cantonese sounds; use the recordings and mouth-position
          explanations as your reference.
        </p>
      </details>
    </section>
    <section class="info-section" aria-labelledby="initials-heading">
      <span class="eyebrow">01</span>
      <h2 id="initials-heading">Initials</h2>
      <p>
        An initial is the consonant at the start of a syllable. Jyutping has
        <b>19 written initials</b>; spellings such as <b>ng</b> and <b>gw</b> each represent one
        initial.
      </p>
      <p>
        Five pairs differ in <b>aspiration</b>, the release of a noticeable puff of air. This
        distinction is important even if your other languages use the same letters differently.
      </p>
      <div class="guide-table">
        <table>
          <caption>
            Initial pairs
          </caption>
          <thead>
            <tr>
              <th scope="col">Unaspirated</th>
              <th scope="col">Aspirated</th>
            </tr>
          </thead>
          <tbody>
            ${[
              ['b', 'p'],
              ['d', 't'],
              ['g', 'k'],
              ['z', 'c'],
              ['gw', 'kw'],
            ]
              .map(
                ([a, b]) =>
                  /* HTML */ `<tr>
                    <td><b>${a}</b></td>
                    <td><b>${b}</b></td>
                  </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <p>
        Compare <b>baa1</b> (<span lang="zh-Hant">巴</span>) and <b>paa1</b> (<span lang="zh-Hant"
          >趴</span
        >). Listen for the puff of air in <b>p</b>.
      </p>
      ${wordExamples(recordings, ['baa1', 'paa1'], 'Compare unaspirated b and aspirated p')}
      <p>The other initials are <b>m, n, ng, f, s, h, l, w, j</b>.</p>
      <dl class="spelling-notes">
        <div>
          <dt>j</dt>
          <dd>
            In an English comparison, this is the <b>y</b> sound in <i>yes</i>, not the <b>j</b> in
            <i>job</i>: <b>jat1</b> (<span lang="zh-Hant">一</span>, one).
          </dd>
        </div>
        <div>
          <dt>z / c</dt>
          <dd>
            These begin with a brief closure followed by an s-like sound, pronounced as one initial.
            They form an unaspirated/aspirated pair. Use the
            <a
              href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/pronunciation-lesson-2/3-the-initial-pair-z-and-c"
              target="_blank"
              rel="noopener"
              >z and c lesson</a
            >
            to hear the contrast.
          </dd>
        </div>
        <div>
          <dt>ng</dt>
          <dd>
            This nasal can begin a syllable, as in <b>ngo5</b> (<span lang="zh-Hant">我</span>, I).
            It is also found at the end of finals such as <b>ong</b>.
          </dd>
        </div>
      </dl>
      <p class="small">
        For recordings and articulation instructions, see
        <a
          href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/pronunciation-lesson-1/3-initial-pairs"
          target="_blank"
          rel="noopener"
          >Open Cantonese’s initial-pair lesson</a
        >
        and the
        <a
          href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/jyutping-chart"
          target="_blank"
          rel="noopener"
          >complete sound chart</a
        >.
      </p>
    </section>
    <section class="info-section" aria-labelledby="finals-heading">
      <span class="eyebrow">02</span>
      <h2 id="finals-heading">Finals</h2>
      <p>
        A final contains a vowel and any ending that follows it. It can be a vowel alone, a vowel
        that moves towards another vowel, or a vowel followed by a nasal or stop consonant.
      </p>
      <div class="guide-table">
        <table>
          <caption>
            Examples of final structures
          </caption>
          <thead>
            <tr>
              <th scope="col">Final</th>
              <th scope="col">Structure</th>
              <th scope="col">Example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>aa</b></td>
              <td>Vowel alone</td>
              <td><b>s + aa + 1</b> = saa1 <span lang="zh-Hant">沙</span> · sand</td>
            </tr>
            <tr>
              <td><b>aai</b></td>
              <td>Vowel with an <b>i</b> ending</td>
              <td><b>g + aai + 1</b> = gaai1 <span lang="zh-Hant">街</span> · street</td>
            </tr>
            <tr>
              <td><b>aan</b></td>
              <td>Vowel with an <b>n</b> ending</td>
              <td><b>s + aan + 1</b> = saan1 <span lang="zh-Hant">山</span> · mountain</td>
            </tr>
            <tr>
              <td><b>aat</b></td>
              <td>Vowel with a <b>t</b> ending</td>
              <td><b>b + aat + 3</b> = baat3 <span lang="zh-Hant">八</span> · eight</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Other endings include <b>-u</b>, the nasals <b>-m, -ng</b>, and the stops <b>-p, -k</b>. Not
        every vowel combines with every ending; learn the combinations from words and the
        <a
          href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/jyutping-chart"
          target="_blank"
          rel="noopener"
          >full finals chart</a
        >.
      </p>
      <dl class="spelling-notes">
        <div>
          <dt>aa / a</dt>
          <dd>
            These differ in vowel quality as well as length: <b>aa</b> is more open and longer;
            <b>a</b> is more central and shorter. Compare <b>saam1</b> (<span lang="zh-Hant"
              >三</span
            >, three) with <b>sam1</b> (<span lang="zh-Hant">心</span>, heart). The initial and tone
            stay the same; the final changes from <b>aam</b> to <b>am</b>.
            <a href="https://jyutping.org/en/learn/" target="_blank" rel="noopener"
              >Hear the aa / a examples in Jyutping.org’s guide</a
            >.
          </dd>
        </div>
        <div>
          <dt>yu</dt>
          <dd>
            This is one rounded vowel, not a sequence of <b>j + u</b>. The
            <a
              href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/pronunciation-lesson-4/6-the-final-yu"
              target="_blank"
              rel="noopener"
              >yu lesson</a
            >
            demonstrates it with tongue and lip instructions.
          </dd>
        </div>
        <div>
          <dt>oe / eo</dt>
          <dd>
            These spell different rounded vowels. <b>oe</b> occurs alone and in finals such as
            <b>oeng</b>; <b>eo</b> appears in <b>eoi, eon, eot</b>. Compare the recordings in
            <a href="https://jyutping.org/en/learn/" target="_blank" rel="noopener"
              >Jyutping.org’s vowel guide</a
            >.
          </dd>
        </div>
        <div>
          <dt>-p -t -k</dt>
          <dd>
            These endings are unreleased: close the lips or place the tongue to stop the sound,
            without a final burst or an added vowel. In <b>sik6</b> (<span lang="zh-Hant">食</span>,
            eat), the final is <b>ik</b>, including the <b>k</b>.
          </dd>
        </div>
      </dl>
      <p class="small">
        The nasal sounds <b>m</b> and <b>ng</b> can also form syllables without a vowel, as in
        <b>m4</b> (<span lang="zh-Hant">唔</span>, not).
      </p>
    </section>
    <section class="info-section" aria-labelledby="tones-heading">
      <span class="eyebrow">03</span>
      <h2 id="tones-heading">The six tones</h2>
      <p>
        Tone is part of a word’s pronunciation: changing it can change the meaning. These six words
        keep <b>fu</b> the same, so you can concentrate on the pitch.
      </p>
      ${toneExamples(anchors, toneDefinitions)}
      <div class="guide-note">
        <p>
          Tones <b>1, 3 and 6</b> are level: high, mid and low respectively. Tones
          <b>2 and 5</b> rise; tone <b>4</b> falls low. The numbers identify tone categories rather
          than ordering them by pitch.
        </p>
      </div>
      <p class="small">
        The lines are simplified pitch guides, not measurements of the recordings. Pitch is relative
        to the speaker’s voice.
      </p>
      <p class="small">
        For lessons and further listening examples, see the
        <a
          href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide"
          target="_blank"
          rel="noopener"
          >Open Cantonese pronunciation course</a
        >.
      </p>
      <details class="guide-detail">
        <summary>Why do some resources say Cantonese has nine tones?</summary>
        <p>
          The traditional nine-tone count treats syllables ending in <b>-p, -t, -k</b> as separate
          “entering tone” categories. Jyutping writes those with <b>1, 3 or 6</b>, so you still use
          just six tone numbers. See
          <a
            href="https://corpus.eduhk.hk/cantonese/eng/chapter3/3-0.html"
            target="_blank"
            rel="noopener"
            >EdUHK’s explanation of the tone categories</a
          >.
        </p>
      </details>
    </section>
    <section class="info-section" aria-labelledby="resources-heading">
      <h2 id="resources-heading">Further learning and references</h2>
      <p>
        Choose a resource by its teaching language and purpose. Lessons explain how sounds are
        produced; charts and the official scheme are useful for checking a spelling.
      </p>
      ${guideResourcesMarkup()}
    </section>
    <section class="info-section" aria-labelledby="use-heading">
      <span class="eyebrow">04</span>
      <h2 id="use-heading">Practising with Tone Tower</h2>
      <p>
        Once you have studied the sounds, the games provide listening and spelling exercises to
        accompany the resources above. They assume some familiarity with Cantonese pronunciation and
        Jyutping.
      </p>
      <div class="info-grid">
        <div class="info-card">
          <h3>Tone Tower</h3>
          <p>
            Listen to the highlighted syllable and choose its tone number. There is no typing or
            timer, and recordings can be replayed.
          </p>
          <button class="text-button" data-start-world="tone" type="button">
            Choose Tower difficulty →
          </button>
        </div>
        <div class="info-card">
          <h3>Skyrail</h3>
          <p>
            Type what you hear within the time limit. Spelling accepts <b>fu</b>; Full Jyutping
            requires <b>fu2</b>. Spaces between syllables are optional.
          </p>
          <button class="text-button" data-start-world="tide" type="button">
            Choose Skyrail settings →
          </button>
        </div>
      </div>
      <p>
        <button class="text-button inline-link" data-info-action="practice" type="button">
          Practice
        </button>
        offers exercises without a timer or lives. You can focus on a tone pair, initials, finals or
        full spelling.
      </p>
    </section>
    <div class="info-actions">
      <button class="primary" data-page="home" type="button">Go to the games →</button
      ><button class="text-button" data-page="about" type="button">About Tone Tower</button>
    </div>
  </article>`;
}

export function compactGuideMarkup(anchors, toneDefinitions) {
  return /* HTML */ `<h2 id="dialog-title">Jyutping at a glance</h2>
    <p>
      Read each syllable as <b>initial + final + tone</b>: <b>f + u + 2 = fu2</b>. A final includes
      the vowel and any ending: <b>g + ong + 2 = gong2</b>. Some syllables have no initial.
    </p>
    <h3>Hear the six tones.</h3>
    ${toneExamples(anchors, toneDefinitions)}
    <p class="small">
      The lines show simplified pitch shapes. Compare the level tones 1, 3, 6, then the rising tones
      2, 5. Tone 4 falls low.
    </p>
    <h3>Pronunciation resources</h3>
    ${guideResourcesMarkup()}
    <h3>Answering in the games</h3>
    <p>
      In Tone Tower, choose the highlighted syllable’s tone number. In Skyrail, Spelling accepts
      <b>fu</b>; Full Jyutping requires <b>fu2</b>. Spaces between syllables are optional.
    </p>`;
}

export function aboutPageMarkup({ recordingCount } = {}) {
  const count =
    Number.isSafeInteger(recordingCount) && recordingCount > 0
      ? recordingCount.toLocaleString('en') + ' '
      : '';
  return /* HTML */ `<article class="info-page about-page">
    <header class="page-heading">
      <button class="text-button back-link" data-page="home" type="button">← World map</button>
      <h1 tabindex="-1">About Tone Tower</h1>
      <p class="lead">Tone Tower is a browser game for practising Jyutping.</p>
    </header>
    <section class="info-section" aria-labelledby="purpose-heading">
      <h2 id="purpose-heading">What you can practise</h2>
      <p>
        The exercises connect Cantonese pronunciation with its written representation in Jyutping.
        You listen to a recording, then identify a tone or type the sounds you hear. Answers advance
        you through a tower or a railway, depending on the game.
      </p>
      <p>
        The games are suitable for learners of Cantonese and for Cantonese speakers learning
        Jyutping. You do not need to read Chinese characters to play. The
        <button class="text-button inline-link" data-page="sounds" type="button">
          Jyutping guide
        </button>
        explains the notation and includes examples of the six tones.
      </p>
      <p>
        The exercises supplement pronunciation study. If you are learning the sounds for the first
        time, start with the
        <a
          href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide"
          target="_blank"
          rel="noopener"
          >Open Cantonese pronunciation course</a
        >
        or
        <a href="https://jyutping.org/en/learn/" target="_blank" rel="noopener"
          >Jyutping.org’s guide</a
        >.
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
            Type the recording’s Jyutping within the time limit to build the track. Spelling
            practises initials and finals; Full Jyutping also requires tone numbers.
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
        Tone Tower trains listening recognition and Jyutping spelling. It does not assess your
        spoken pronunciation. Use it alongside conversation, vocabulary and a fuller Cantonese
        course.
      </p>
    </section>
    <section class="info-section" aria-labelledby="recordings-heading">
      <h2 id="recordings-heading">Recordings and sources</h2>
      <p>
        The ${count}recordings are human speech from Wikimedia Commons, each with its own source,
        creator and licence. Readings and English meanings include credited dictionary sources such
        as CC-Canto and CC-CEDICT.
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
        saved in this browser and do not sync between devices. Clearing browser storage removes
        them; closing or reloading the page ends the current run.
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
        recording issue, include the Chinese characters and Jyutping so it is easy to find.
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
      ><button class="text-button" data-page="sounds" type="button">Jyutping guide</button>
    </div>
  </article>`;
}
