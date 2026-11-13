import { languages } from './languages/profiles.js';
export const site = {
  siteUrl: 'https://tone-tower.github.io/tone-tower/',
  repository: 'https://github.com/tone-tower/tone-tower',
  maintainer: 'john0107',
  maintainerUrl: 'https://github.com/john0107',
};
export function languagePages(profile) {
  const root = profile.slug + '/';
  return {
    home: {
      path: root,
      title: 'Tone Tower · ' + profile.label + ' ' + profile.romanization + ' games',
      description:
        'Train your ear for ' +
        profile.label +
        '. Play Tone Tower, Skyrail, and focused ' +
        profile.romanization +
        ' practice with human recordings.',
    },
    sounds: {
      path: root + 'guide/',
      title: profile.romanization + ' guide · ' + profile.label + ' Tone Tower',
      description:
        'Learn ' +
        profile.label +
        ' sounds, tones, and ' +
        profile.romanization +
        ' spelling with playable pronunciation examples.',
    },
    practice: {
      path: root + 'practice/',
      title: 'Practice Workshop · ' + profile.label + ' Tone Tower',
      description:
        'Practise ' +
        profile.label +
        ' tones and ' +
        profile.romanization +
        ' spelling at your own pace, without a timer or lives.',
    },
    about: {
      path: root + 'about/',
      title: 'About · ' + profile.label + ' Tone Tower',
      description:
        'About the open-source ' +
        profile.label +
        ' pronunciation games. Find recording credits, source code, and feedback links.',
    },
  };
}
export const pages = Object.fromEntries(
  Object.values(languages).flatMap((profile) =>
    Object.entries(languagePages(profile)).map(([page, metadata]) => [
      profile.id + ':' + page,
      { ...metadata, page, language: profile.id },
    ]),
  ),
);
export function pageFromLocation(url, base, profile) {
  const relative = url.pathname.startsWith(base.pathname)
    ? url.pathname.slice(base.pathname.length).replace(/index\.html$/, '')
    : '';
  return (
    Object.keys(languagePages(profile)).find(
      (key) => languagePages(profile)[key].path === relative,
    ) ?? 'home'
  );
}
