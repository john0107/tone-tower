import { requireProfile } from '../languages/profiles.js';

export function practiceSetupMarkup(config, profile) {
  requireProfile(profile);
  const options = (entries, value) =>
    entries
      .map(
        ([key, label]) =>
          /* HTML */ `<option value="${key}" ${String(key) === String(value) ? 'selected' : ''}>
            ${label}
          </option>`,
      )
      .join('');
  const tone = config.challenge === 'tone',
    includeTones = config.variant === 'full';
  const exampleParts = profile.example.parts.map((part) => {
    const value = profile.practiceSpelling(part, config.spellingFocus);
    return includeTones ? value : value.replace(/[0-9]/g, '');
  });
  return /* HTML */ `<div class="practice-setup">
    ${
      tone
        ? /* HTML */ `<fieldset class="practice-tones">
              <legend>Tones to practise</legend>
              <div class="practice-tone-options">
                ${profile.tones
                  .map(
                    (t) =>
                      /* HTML */ `<button
                        type="button"
                        data-practice-tone="${t}"
                        aria-label="Tone ${t}"
                        aria-pressed="${config.tones.includes(t)}"
                        ${config.tones.length === 2 && config.tones.includes(t) ? 'disabled' : ''}
                      >
                        <span>${t}</span
                        ><svg viewBox="0 0 100 36" aria-hidden="true">
                          <path
                            d="${profile.toneDefinitions.find((def) => def.value === t).path}"
                          />
                        </svg>
                      </button>`,
                  )
                  .join('')}
              </div>
              <p>Choose two for a tone pair, or add more.</p>
            </fieldset>
            <label
              >Answer choices<select data-practice-setting="choices">
                ${options(
                  profile.choiceCounts
                    .filter((n) => n <= config.tones.length)
                    .map((n) => [n, n + ' tones per question']),
                  config.choices,
                )}
              </select></label
            >`
        : /* HTML */ `<label
              >What to practise<select data-practice-setting="spellingFocus">
                ${options(
                  [
                    ...profile.spellingFocuses.map((focus) => [
                      focus,
                      focus === 'full'
                        ? 'Full spelling'
                        : focus === 'initials'
                          ? 'Initials only'
                          : 'Finals only',
                    ]),
                  ],
                  config.spellingFocus,
                )}
              </select></label
            >
            <div class="practice-spelling-options">
              <label class="practice-tone-toggle"
                ><input
                  type="checkbox"
                  data-practice-setting="variant"
                  ${config.variant === 'full' ? 'checked' : ''}
                />
                Include tones</label
              ><label class="practice-tone-toggle"
                ><input
                  type="checkbox"
                  data-practice-setting="target"
                  ${config.target === 'highlighted' ? 'checked' : ''}
                />
                Single syllable only</label
              >
            </div>
            <p class="practice-example">
              <span lang="zh-Hant">${profile.example.text}</span> →
              ${config.target === 'whole' ? exampleParts.join(' ') : exampleParts[0]}
            </p>`
    }<label class="practice-session-length"
      >Session length<select data-practice-setting="length">
        ${options(
          [
            [10, '10'],
            [20, '20'],
            [50, '50'],
            ['endless', 'Unlimited'],
          ],
          config.length,
        )}
      </select></label
    >
  </div>`;
}
