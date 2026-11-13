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
            aria-label="Hear ${escape(word?.transcription || `tone ${tone.value}`)}, ${escape(tone.description)}"
          >
            <span class="guide-tone-number">${escape(tone.value)}</span>
            <svg viewBox="0 0 100 36" aria-hidden="true"><path d="${escape(tone.path)}" /></svg>
            <strong>${escape(word?.transcription || '')}</strong>
            <span
              ><span lang="zh-Hant">${escape(word?.text || '')}</span> ·
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
      ><span>Explains spelling and pronunciation through comparisons with English.</span></a
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

function inlineWordAudio(recordings, jyutping, recordingId) {
  const word =
    recordings.find((entry) => entry.id === recordingId && entry.transcription === jyutping) ||
    recordings.find((entry) => entry.transcription === jyutping);
  if (!word) return `<b>${escape(jyutping)}</b>`;
  return /* HTML */ `<button
    class="guide-word-audio"
    data-guide-word="${escape(word.id)}"
    type="button"
    aria-label="Hear ${escape(word.transcription)}, ${escape(word.text)}"
  >
    <span aria-hidden="true">▶</span> <b>${escape(word.transcription)}</b>
    <span lang="zh-Hant">${escape(word.text)}</span>
  </button>`;
}

export function soundPageMarkup(anchors, toneDefinitions, recordings = []) {
  const example = anchors.find((word) => word.tone === 2);
  const audio = (jyutping, recordingId) => inlineWordAudio(recordings, jyutping, recordingId);
  const audioStatus = /* HTML */ `<span
    class="sr-only guide-example-status"
    role="status"
    aria-live="polite"
  ></span>`;
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
      <p class="small guide-introduction">
        Some courses use Yale, another system for writing Cantonese pronunciation. This guide and
        the games use Jyutping because its letters and tone numbers can be typed directly on a
        standard keyboard, including when you enter answers in Skyrail.
      </p>
    </header>
    <section class="info-section" aria-labelledby="jyutping-heading">
      <h2 id="jyutping-heading">Syllable structure</h2>
      <p>
        An <b>initial</b> starts the sound. A <b>final</b> usually contains a vowel and any ending.
        The <b>tone number</b> tells you the pitch pattern of the whole syllable.
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
              ><span lang="zh-Hant">${escape(example?.text || '虎')}</span> ·
              ${escape(example?.gloss || 'tiger')}</small
            ></span
          >
        </div>
        <button data-guide-tone="2" class="secondary" type="button" aria-label="Hear fu2, tone 2">
          ▶ Hear fu2
        </button>
      </div>
      <p class="guide-example-block">
        In <b>gong2</b> (<span lang="zh-Hant">講</span>, speak), the parts are <b>g + ong + 2</b>.
        The final is <b>ong</b>: the vowel <b>o</b> and the ending <b>ng</b>. Hear
        ${audio('gong2')}. ${audioStatus}
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
    <section class="info-section" aria-labelledby="initials-heading">
      <span class="eyebrow">01</span>
      <h2 id="initials-heading">Initials</h2>
      <p>
        An initial is the consonant at the start of a syllable. Jyutping has
        <b>19 written initials</b>; spellings such as <b>ng</b> and <b>gw</b> each represent one
        initial.
      </p>
      <p class="guide-example-block">
        These seven initials are close to their English sounds:
        <span class="guide-initial-sample"><b>m</b> in ${audio('maa1')}</span>,
        <span class="guide-initial-sample"><b>n</b> in ${audio('nei5', 'commons-147747458')}</span>,
        <span class="guide-initial-sample"><b>f</b> in ${audio('fu1')}</span>,
        <span class="guide-initial-sample"><b>s</b> in ${audio('si1')}</span>,
        <span class="guide-initial-sample"><b>h</b> in ${audio('hou2')}</span>,
        <span class="guide-initial-sample"><b>l</b> in ${audio('lou5')}</span>, and
        <span class="guide-initial-sample"><b>w</b> in ${audio('wai1')}</span>. ${audioStatus}
      </p>
      <p>
        The initials <b>b/p, d/t, g/k, z/c</b> and <b>gw/kw</b> form five pairs. The second sound in
        each pair has a stronger puff of air, called <b>aspiration</b>. Hold a loose piece of paper
        just in front of your mouth and say <b>baa1</b>, then <b>paa1</b> at a similar volume: the
        paper should move more with <b>paa1</b>.
      </p>
      <dl class="spelling-notes">
        <div>
          <dt>b / p</dt>
          <dd class="guide-example-block">
            Close the lips, then open them. Compare ${audio('baa1', 'commons-149276752')} and
            ${audio('paa1', 'commons-90813605')}; both use the final <b>aa</b> and tone <b>1</b>.
            ${audioStatus}
          </dd>
        </div>
        <div>
          <dt>d / t</dt>
          <dd class="guide-example-block">
            Place the front of the tongue against the ridge just behind the upper front teeth, then
            release it. Compare ${audio('dim2', 'commons-173769223')} and
            ${audio('tim2', 'commons-90557971')}. ${audioStatus}
          </dd>
        </div>
        <div>
          <dt>g / k</dt>
          <dd class="guide-example-block">
            Raise the back of the tongue against the soft palate at the back of the roof of the
            mouth, then release it: ${audio('gau2', 'commons-173769299')} and
            ${audio('kau3', 'commons-90812580')}. Both words have the final <b>au</b>; their tones
            differ. ${audioStatus}
          </dd>
        </div>
        <div>
          <dt>z / c</dt>
          <dd class="guide-example-block">
            Begin with a brief closure followed by an s-like sound, pronounced as one initial. As an
            English approximation, use the <b>ts</b> in <i>cats</i> at the start of a syllable.
            Compare ${audio('zou2', 'commons-149277092')} and ${audio('cou2', 'commons-173769321')};
            <b>c</b> adds the stronger puff of air. ${audioStatus}
          </dd>
        </div>
        <div>
          <dt>gw / kw</dt>
          <dd class="guide-example-block">
            Use the tongue position for <b>g/k</b> while rounding the lips for <b>w</b>. Make them
            together as one initial, without inserting a vowel between them. Hear <b>gw</b> in
            ${audio('gwok3', 'commons-147769176')} and <b>kw</b> in
            ${audio('kwan3', 'commons-90442925')}. ${audioStatus}
          </dd>
        </div>

        <div>
          <dt>j</dt>
          <dd class="guide-example-block">
            Use the English <b>y</b> sound in <i>yes</i>: ${audio('jat1')} (one). It is different
            from the English <b>j</b> in <i>job</i>. ${audioStatus}
          </dd>
        </div>
        <div>
          <dt>ng</dt>
          <dd class="guide-example-block">
            Use the nasal sound at the end of English <i>sing</i>. In Cantonese it can also begin a
            syllable, as in ${audio('ngaa4', 'commons-147747191')} (tooth). To practise, hold the
            <b>ng</b> sound with the back of the tongue raised, then move straight into the vowel.
            There is no separate <b>g</b> sound after it. ${audioStatus}
          </dd>
        </div>
      </dl>
      <p class="small">
        For more mouth-position guidance, see
        <a
          href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/pronunciation-lesson-1/3-initial-pairs"
          target="_blank"
          rel="noopener"
          >Open Cantonese’s initial-pair lesson</a
        >
        and its
        <a
          href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/pronunciation-lesson-6/1-the-initial-pair-gw-and-kw"
          target="_blank"
          rel="noopener"
          >gw and kw lesson</a
        >.
      </p>
    </section>
    <section class="info-section" aria-labelledby="finals-heading">
      <span class="eyebrow">02</span>
      <h2 id="finals-heading">Finals</h2>
      <p>Most finals contain a vowel, sometimes followed by another vowel or a consonant.</p>
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
              <td class="guide-example-block">
                <b>s + aa + 1</b> = ${audio('saa1')} · sand ${audioStatus}
              </td>
            </tr>
            <tr>
              <td><b>aai</b></td>
              <td>Vowel with an <b>i</b> ending</td>
              <td class="guide-example-block">
                <b>m + aai + 5</b> = ${audio('maai5')} · buy ${audioStatus}
              </td>
            </tr>
            <tr>
              <td><b>aan</b></td>
              <td>Vowel with an <b>n</b> ending</td>
              <td class="guide-example-block">
                <b>ng + aan + 5</b> = ${audio('ngaan5')} · eye ${audioStatus}
              </td>
            </tr>
            <tr>
              <td><b>aat</b></td>
              <td>Vowel with a <b>t</b> ending</td>
              <td class="guide-example-block">
                <b>b + aat + 3</b> = ${audio('baat3')} · eight ${audioStatus}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Other endings include <b>-u</b>, the nasals <b>-m, -ng</b>, and the stops <b>-p, -k</b>. The
        <a
          href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/jyutping-chart"
          target="_blank"
          rel="noopener"
          >full finals chart</a
        >
        shows which vowels and endings combine.
      </p>
      <dl class="spelling-notes">
        <div>
          <dt>aa / a</dt>
          <dd class="guide-example-block">
            These differ in vowel quality as well as length: <b>aa</b> is more open and longer;
            <b>a</b> is more central and shorter. Compare ${audio('haam4', 'commons-179112876')}
            (salty) with ${audio('ham4', 'commons-149276092')} (hold in the mouth). The initial,
            ending and tone stay the same; only the vowel changes. ${audioStatus}
          </dd>
        </div>
        <div>
          <dt>yu</dt>
          <dd class="guide-example-block">
            This is one rounded vowel, not a sequence of <b>j + u</b>. Raise the tongue as for
            <b>i</b> and round the lips. Hear it in ${audio('syu1')} (book). The
            <a
              href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/pronunciation-lesson-4/6-the-final-yu"
              target="_blank"
              rel="noopener"
              >yu lesson</a
            >
            demonstrates the mouth position. ${audioStatus}
          </dd>
        </div>
        <div>
          <dt>oe / eo</dt>
          <dd class="guide-example-block">
            These spell different rounded vowels. <b>oe</b> occurs alone and in finals such as
            <b>oeng</b>; <b>eo</b> appears in <b>eoi, eon, eot</b>. Hear <b>oe</b> in
            ${audio('soeng2')} (think) and <b>eo</b> in ${audio('seoi2')} (water). The endings
            differ in these two examples as well. ${audioStatus}
          </dd>
        </div>
        <div>
          <dt>-p -t -k</dt>
          <dd class="guide-example-block">
            These endings are unreleased: close the lips or place the tongue to stop the sound,
            without a final burst or an added vowel. Hear <b>-p</b> in ${audio('sap1')},
            <b>-t</b> in ${audio('baat3')}, and <b>-k</b> in ${audio('fuk1')}. ${audioStatus}
          </dd>
        </div>
        <div>
          <dt>m / ng</dt>
          <dd class="guide-example-block">
            Some syllables consist only of <b>m</b> or <b>ng</b> and a tone. In
            ${audio('ng5', 'commons-147747112')} (five), <b>ng</b> is the whole final; there is no
            initial or vowel. In ${audio('ngaa4', 'commons-147747191')} (tooth), <b>ng</b> is the
            initial and <b>aa</b> is the final. ${audioStatus}
          </dd>
        </div>
      </dl>
      <details class="guide-detail">
        <summary>Why do i and u sound different in some finals?</summary>
        <p>
          In <b>ing</b> and <b>ik</b>, the vowel <b>i</b> is shorter and more open than when it
          stands alone. The same happens to <b>u</b> in <b>ung</b> and <b>uk</b>.
        </p>
        <p class="guide-example-block">
          Compare ${audio('si1')} (poem) with ${audio('sing1')} (rise), then ${audio('fu1')}
          (husband) with ${audio('fuk1')} (width). Each pair keeps the initial and tone the same, so
          you can hear the vowel change when the ending is added. ${audioStatus}
        </p>
        <p>
          Open Cantonese’s lessons on
          <a
            href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/pronunciation-lesson-4/10-the-finals-ending-with-ng"
            target="_blank"
            rel="noopener"
            >-ng finals</a
          >
          and
          <a
            href="https://opencantonese.org/books/cantonese-life-1/pronunciation-guide/pronunciation-lesson-5/8-the-finals-ending-with-k"
            target="_blank"
            rel="noopener"
            >-k finals</a
          >
          show the mouth positions for these vowel variants.
        </p>
      </details>
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
          The difference comes from how syllables with a stop ending are counted. An
          <b>entering tone</b> (<span lang="zh-Hant">入聲</span>), also called a
          <b>checked tone</b>, is a traditional category for syllables ending in
          <b>-p, -t or -k</b>. The lips or tongue close to cut off the sound. “Entering” names this
          category; it does not mean that the pitch rises.
        </p>
        <p>
          These syllables normally have a high, middle or low level pitch. The traditional count
          gives them three separate tone categories, alongside the six tones on syllables without
          these stop endings: <b>six + three = nine</b>. Their pitch levels match tones
          <b>1, 3 and 6</b>:
        </p>
        <div class="guide-table">
          <table>
            <caption>
              Same pitch level, different ending
            </caption>
            <thead>
              <tr>
                <th scope="col">Pitch</th>
                <th scope="col">Without a stop ending</th>
                <th scope="col">With a stop ending</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>High · 1</td>
                <td class="guide-example-block">${audio('fu1')} ${audioStatus}</td>
                <td class="guide-example-block">${audio('fuk1')} ${audioStatus}</td>
              </tr>
              <tr>
                <td>Middle · 3</td>
                <td class="guide-example-block">${audio('fu3')} ${audioStatus}</td>
                <td class="guide-example-block">${audio('baat3')} ${audioStatus}</td>
              </tr>
              <tr>
                <td>Low · 6</td>
                <td class="guide-example-block">${audio('fu6')} ${audioStatus}</td>
                <td class="guide-example-block">${audio('sap6')} ${audioStatus}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          For syllables ending in <b>-p, -t or -k</b>, the usual tone numbers are <b>1</b> for high
          pitch, <b>3</b> for middle pitch and <b>6</b> for low pitch. For example, <b>fu1</b> and
          <b>fuk1</b> both have high level pitch. The <b>k</b> tells you how the second syllable
          ends; the <b>1</b> still marks its pitch.
        </p>
        <p>
          Some words have more than one tone reading. For example,
          <span lang="zh-Hant">碟</span> (dish) has the regular reading <b>dip6</b> and the changed
          reading <b>dip2</b>. This is why a stop-final syllable can sometimes have a rising tone.
          See
          <a
            href="https://corpus.eduhk.hk/cantonese/eng/chapter3/3-0.html"
            target="_blank"
            rel="noopener"
            >EdUHK’s explanation of the tone categories</a
          >.
        </p>
      </details>
      <details class="guide-detail">
        <summary>How are Mandarin and Cantonese tones related?</summary>
        <p>
          <b>Some tones sound similar.</b> Cantonese tone <b>1</b> is high and level, much like
          Mandarin first tone. Cantonese tone <b>2</b> rises high, making Mandarin second tone a
          useful starting point. The other numbers do not line up in the same way: Cantonese tone
          <b>3</b> is level rather than dipping, and tone <b>4</b> falls low rather than falling
          from high pitch.
        </p>
        <p class="guide-example-block">
          For tones <b>2 and 5</b>, listen especially to where the rise finishes. Tone
          <b>2</b> reaches high; tone <b>5</b> rises to around the middle of the voice. Compare
          ${audio('fu2')} and ${audio('fu5')}. ${audioStatus}
        </p>
        <p>
          <b>Related character readings.</b> The languages share a history, but their older tone
          categories developed differently. This leaves patterns between familiar characters’
          readings, even when the corresponding tones sound different:
        </p>
        <div class="guide-table">
          <table>
            <caption>
              Common tone correspondences for the same character
            </caption>
            <thead>
              <tr>
                <th scope="col">Mandarin tone</th>
                <th scope="col">Often Cantonese tone</th>
                <th scope="col">Examples: Pinyin → Jyutping</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>1</td>
                <td class="guide-example-block">
                  <i lang="cmn-Latn">tiān</i> → ${audio('tin1')} ${audioStatus}
                </td>
              </tr>
              <tr>
                <td>2</td>
                <td>4</td>
                <td class="guide-example-block">
                  <i lang="cmn-Latn">yá</i> → ${audio('ngaa4', 'commons-147747191')} ${audioStatus}
                </td>
              </tr>
              <tr>
                <td>3</td>
                <td>2 or 5</td>
                <td class="guide-example-block">
                  <i lang="cmn-Latn">hǎo</i> → ${audio('hou2')};<br />
                  <i lang="cmn-Latn">mǎ</i> → ${audio('maa5')} ${audioStatus}
                </td>
              </tr>
              <tr>
                <td>4</td>
                <td>3 or 6</td>
                <td class="guide-example-block">
                  <i lang="cmn-Latn">sì</i> → ${audio('sei3')};<br />
                  <i lang="cmn-Latn">fù</i> → ${audio('fu6')} ${audioStatus}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          These correspondences concern character readings, rather than similar-sounding tones. For
          example, Mandarin <i lang="cmn-Latn">yá</i> rises, but Cantonese <b>ngaa4</b> falls low.
          The Mandarin reading is also less informative for Cantonese syllables ending in
          <b>-p, -t or -k</b>, because Mandarin lost those endings.
        </p>
        <p>
          <b>Why do Mandarin third-tone characters often have Cantonese tone 2 or 5?</b> This split
          reflects an older distinction between <b>yin</b> (<span lang="zh-Hant">陰</span>, upper
          register) and <b>yang</b> (<span lang="zh-Hant">陽</span>, lower register). Cantonese
          tones <b>1, 2 and 3</b> belong to the yin group; <b>4, 5 and 6</b> to the yang group. Tone
          <b>2</b> is traditionally called <span lang="zh-Hant">陰上</span>, yin rising, and tone
          <b>5</b> <span lang="zh-Hant">陽上</span>, yang rising.
        </p>
        <p>
          Historically, syllables with <b>voiceless</b> initials tended to develop yin tones, and
          those with <b>voiced</b> initials developed yang tones. Voiced means that the vocal folds
          vibrate: feel your throat while humming <b>mmm</b>, then compare the voiceless hiss
          <b>sss</b>. The sounds <b>m</b> and <b>n</b> are voiced. Many older consonant distinctions
          have disappeared, but the resulting tone differences remain.
        </p>
        <p>
          Voicing is different from aspiration. Cantonese <b>b</b> and <b>p</b> are both voiceless;
          <b>p</b> has the stronger puff of air.
        </p>
        <p class="guide-example-block">
          Many Mandarin third-tone characters beginning with <b>m</b> or <b>n</b> have Cantonese
          tone <b>5</b>: <i lang="cmn-Latn">mǎ</i> → ${audio('maa5')} and
          <i lang="cmn-Latn">nǐ</i> → ${audio('nei5', 'commons-147747458')}. Compare
          <i lang="cmn-Latn">hǎo</i> → ${audio('hou2')} and <i lang="cmn-Latn">shǒu</i> →
          ${audio('sau2')}. There are exceptions to this pattern: <span lang="zh-Hant">扭</span> and
          <span lang="zh-Hant">紐</span> are both <i lang="cmn-Latn">niǔ</i> in Mandarin and
          <b>nau2</b> in Cantonese. ${audioStatus}
        </p>
        <p>
          If you know a character’s Mandarin reading,
          <a
            href="https://michellefullwood.com/languages/cantonese/correspondences/"
            target="_blank"
            rel="noopener"
            >Michelle Fullwood’s Cantonese–Mandarin correspondence tables</a
          >
          can help you predict its Cantonese initial, final and tone. The percentages show how often
          each mapping occurs in the character data, so you can see which guesses are more likely to
          be correct.
        </p>
      </details>
      <details class="guide-detail">
        <summary>Why might everyday speech sound different from the dictionary?</summary>
        <p>
          <b>Pronunciation variants.</b> Some speakers say <b>lei5</b> where a reference spelling
          gives <b>nei5</b> (<span lang="zh-Hant">你</span>, you), or <b>o5</b> for
          <b>ngo5</b> (<span lang="zh-Hant">我</span>, I). These are common differences in how
          speakers pronounce the sounds. The
          <a
            href="https://opencantonese.org/books/cantonese-life-1/unit-0/5-cantonese-pronunciation"
            target="_blank"
            rel="noopener"
            >Open Cantonese pronunciation notes</a
          >
          explain why recordings can differ from the spelling used in a course.
        </p>
        <p class="guide-example-block">
          <b>Changed tones.</b> A character can take a different tone in a particular word.
          ${audio('tau4', 'commons-88201954')} means “head.” In
          ${audio('fu2 tau2', 'commons-149277076')} (“axe”), the same character
          <span lang="zh-Hant">頭</span> is pronounced <b>tau2</b>. Compare the second syllable of
          <b>fu2 tau2</b> with <b>tau4</b>: the tone changes from low falling to high rising.
          ${audioStatus}
        </p>
        <p>
          The
          <a href="https://cantowords.com/dictionary/%E9%A0%AD" target="_blank" rel="noopener"
            >Cantowords entry for 頭</a
          >
          lists words that use <b>tau4</b> and words that use the changed tone <b>tau2</b>.
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
