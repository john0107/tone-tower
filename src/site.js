// Public project identity. Update siteUrl when the production address changes.
export const site = {
  siteUrl: 'https://john0107.github.io/tone-tower/',
  repository: 'https://github.com/john0107/tone-tower',
  maintainer: 'john0107',
  maintainerUrl: 'https://github.com/john0107',
};
export const pages = {
  home: {
    path: '',
    title: 'Tone Tower · Cantonese Jyutping games',
    description:
      'Train your ear for Cantonese. Climb Tone Tower, type your way along Skyrail, and practise Jyutping with human speech recordings. Free to play, no account needed.',
  },
  sounds: {
    path: 'guide/',
    title: 'Jyutping guide · Tone Tower',
    description:
      'Get to know Cantonese initials, finals and six tones, with playable examples and pronunciation resources. Then practise in Tone Tower and Skyrail.',
  },
  about: {
    path: 'about/',
    title: 'About · Tone Tower',
    description:
      'Meet Tone Tower, an open-source Cantonese Jyutping game maintained by john0107. Find the source code, recording credits, and a place to share feedback.',
  },
  practice: {
    path: 'practice/',
    title: 'Practice Workshop · Tone Tower',
    description:
      'Practise Cantonese tones and Jyutping spelling at your own pace. Choose focused listening exercises without a timer or lives.',
  },
};
export function pageFromLocation(url, base) {
  const relative = url.pathname.startsWith(base.pathname)
    ? url.pathname.slice(base.pathname.length).replace(/index\.html$/, '')
    : '';
  return Object.keys(pages).find((key) => pages[key].path === relative) || 'home';
}
