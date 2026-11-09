export const RAIL_SPAN = 180;
export const RAIL_CROSSING_SECONDS = 0.85;
const settled = (p) => ['correct', 'landing', 'review'].includes(p);
const smooth = (p) => p * p * (3 - 2 * p);
// Physical route state survives prompts. A missed car coasts until its rear wheel leaves support.
export function createRailJourney(start = 0) {
  let segment = Math.max(0, start),
    camera = segment * RAIL_SPAN,
    phase = null,
    reason = null,
    progress = start,
    celebration = 0,
    rescue = 0,
    elapsed = 0,
    from = camera,
    station = null,
    region = Math.min(4, Math.floor(start / 20));
  const repaired = new Set(),
    failed = new Set();
  return {
    update(next) {
      if (next.phase !== phase) {
        from = camera;
        elapsed = 0;
        if (next.phase === 'landing') station = (segment + 1) * RAIL_SPAN + 65;
        if (
          (next.phase === 'correct' || next.phase === 'landing') &&
          !['correct', 'landing'].includes(phase)
        ) {
          repaired.add(segment);
          celebration = 1.65;
        }
        if (next.phase === 'listening' && settled(phase)) {
          if (phase === 'review') {
            failed.add(segment);
            rescue = reason === 'timeout' ? 1.5 : 0;
          }
          segment++;
          for (const set of [repaired, failed])
            for (const i of set) if (i < segment - 16) set.delete(i);
        }
        phase = next.phase;
        reason = next.reason;
      }
      progress = next.progress ?? progress;
    },
    tick(dt, { paused = false, reduced = false } = {}) {
      if (!paused) {
        dt = Math.max(0, dt);
        elapsed += dt;
        const crossing = ['correct', 'landing'].includes(phase),
          missed = phase === 'review' && reason === 'timeout';
        const target =
          (segment + (crossing ? 1 : 0)) * RAIL_SPAN +
          (missed ? 132 + Math.min(4, Math.floor(progress / 20)) * 3 : 0);
        // Hold the entire view still while the player listens and types.
        // Countdown feedback lives on the signal; travel is reserved for outcomes.
        if (phase !== 'answering') {
          if (reduced) camera = Math.max(camera, target);
          else if (crossing || missed)
            camera = Math.max(
              camera,
              from +
                (target - from) *
                  smooth(Math.min(1, elapsed / (missed ? 0.55 : RAIL_CROSSING_SECONDS))),
            );
          else camera += Math.max(0, target - camera) * (1 - Math.exp(-14 * dt));
        }
        region = reduced
          ? Math.min(4, Math.floor(progress / 20))
          : region + (Math.min(4, Math.floor(progress / 20)) - region) * (1 - Math.exp(-2 * dt));
        celebration = Math.max(0, celebration - dt);
        rescue = Math.max(0, rescue - dt);
      }
      return {
        camera,
        segment,
        progress,
        repaired,
        failed,
        celebration,
        rescue,
        station,
        region,
        elapsed,
        fall:
          phase === 'review' && reason === 'timeout'
            ? reduced
              ? 1
              : Math.max(0, Math.min(1, (elapsed - 0.55) / 0.85))
            : 0,
      };
    },
    get camera() {
      return camera;
    },
    get segment() {
      return segment;
    },
  };
}
