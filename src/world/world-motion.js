const smooth = (value) => {
  const p = Math.max(0, Math.min(1, value));
  return p * p * (3 - 2 * p);
};

// Presentation follows the controller outcome; it never awards points or changes deadlines.
export function sceneMotion({ phase, reason }, elapsed = 0, reduced = false) {
  const success = phase === 'correct' || phase === 'landing',
    wrong = phase === 'review' && reason === 'tone',
    timeout = phase === 'review' && reason === 'timeout',
    t = Math.max(0, elapsed);
  return {
    hit: wrong && !reduced ? Math.max(0, 1 - Math.abs(t - 0.65) / 0.4) : 0,
    result: success ? 'success' : wrong || timeout ? 'wrong' : '',
    open: success || wrong ? (reduced ? 1 : smooth(t / 0.35)) : 0,
    walk: reduced
      ? success
        ? 1
        : 0
      : success
        ? smooth((t - 0.3) / 0.9)
        : wrong
          ? t < 0.55
            ? smooth(t / 0.55)
            : 1 - smooth((t - 0.55) / 0.65)
          : 0,
    fall: timeout ? (reduced ? 1 : Math.min(1, Math.max(0, (t - 0.55) / 0.85))) : 0,
    travel: success && !reduced ? Math.max(0, 1.8 - t) : 0,
    build: success ? (reduced ? 1 : Math.min(1, t * 2.5)) : 0,
  };
}
