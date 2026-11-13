const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function mandarinGuide(anchors, definitions, compact = false) {
  const tones = `<div class="guide-tones">${definitions
    .map((tone) => {
      const reference = anchors.find((a) => a.tone === tone.value);
      return `<button class="guide-tone" type="button" data-guide-tone="${tone.value}" ${reference ? '' : 'disabled'} aria-label="Hear ${escape(tone.label)}"><svg viewBox="0 0 100 36" aria-hidden="true"><path d="${tone.path}"/></svg><strong>${escape(tone.label)}</strong><span>${escape(tone.description)}</span>${reference ? '<small>' + reference.syllables.map((s, i) => (i === reference.targetIndex ? '<mark>' + escape(s.text) + '</mark>' : escape(s.text))).join('') + '</small>' : '<small>Example coming soon</small>'}</button>`;
    })
    .join(
      '',
    )}</div><p id="guide-status" class="small" role="status">Listen, replay, and compare.</p>`;
  if (compact)
    return `<h2 id="dialog-title">Mandarin tones</h2>${tones}<p>Tone Tower asks for the tone heard in the recording. Skyrail asks for dictionary Pinyin. Neutral tone is short and unstressed; its pitch depends on the preceding syllable.</p>`;
  return `<article class="info-page"><a class="back-link" href="./" data-page="home">← World map</a><h1 tabindex="-1">A short guide to Pinyin</h1><p class="lead">Pinyin writes Mandarin pronunciation with Latin letters and tone marks. Start with the sounds, then practise hearing and spelling them.</p>
  <section class="info-section"><h2>Four tones and a neutral tone</h2>${tones}<p>The lines are simplified pitch shapes. Tone 3 is often low without a final rise in connected speech. Neutral tone has no single fixed contour.</p></section>
  <section class="info-section"><h2>Reading and typing Pinyin</h2><p>Read <b>mā, má, mǎ, mà</b> as tones 1, 2, 3, and 4. An unmarked syllable, such as the second syllable of <b>māma</b>, is neutral.</p><p>Skyrail accepts <b>nǐ hǎo</b> or <b>ni3 hao3</b>. Use spaces or apostrophes where syllable boundaries need to be explicit: <b>xī'ān</b>. You can type <b>lü4</b>, <b>lv4</b>, or <b>lu:4</b>; plain <b>lu4</b> is a different syllable. Neutral tone accepts 5 or 0. In spelling-only mode, tones are optional.</p><p>On a phone, use the ü and tone buttons beside the answer field, or your usual Pinyin keyboard. Spaces work within Pinyin answers; use Replay to listen again.</p></section>
  <section class="info-section"><h2>Initials and finals</h2><p>An initial starts a syllable; the final is the rest. Compare <b>n + i → nǐ</b> and <b>h + ao → hǎo</b>. The written initials <b>zh, ch, sh</b> have two letters. Compare <b>z/c/s</b> with <b>zh/ch/sh</b>, and <b>j/q/x</b> with the sounds they precede.</p><p>Practice splits the written syllable: <b>y</b> and <b>w</b> count as spelling onsets, although they are not consonant initials in every phonetic analysis. After <b>j, q, x, y</b>, the spelling <b>u</b> represents the ü vowel; keep standard spelling, as in <b>jū</b>. Use <b>-</b> for no initial. Add a number when practising an initial with tones.</p></section>
  <section class="info-section"><h2>Written tones and heard tones</h2><p>Dictionary Pinyin keeps the original tones. In <b>你好 nǐ hǎo</b>, the first syllable is normally heard with a rising tone. Tone Tower tests that reviewed spoken tone; Skyrail expects <b>ni3 hao3</b>. Feedback shows both when they differ.</p><p><b>一 yī</b> and <b>不 bù</b> also change in context. Tone Tower follows these common changes in context; Skyrail keeps dictionary Pinyin. If a recording or answer seems wrong, use its feedback link to report it.</p><p>Changing simplified/traditional characters changes the writing shown, not the recording or pronunciation.</p></section>
  <section class="info-section"><h2>Continue learning</h2><p><a href="https://web.mit.edu/~jinzhang/www/pinyin/tones/" target="_blank" rel="noopener">MIT: Mandarin tones and changes in connected speech ↗</a></p><p><a href="https://www.mdbg.net/chinese/dictionary" target="_blank" rel="noopener">MDBG: Chinese–English dictionary ↗</a></p></section>
  <div class="info-actions"><button class="primary" data-start-world="tone">Try Tone Tower →</button><button class="secondary" data-info-action="practice">Open practice</button></div></article>`;
}
