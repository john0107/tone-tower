import { drawFinale } from './world-finale.js';
import { P } from './pixel-world.js';
import { createRailJourney } from './rail-journey.js';
import { createTowerJourney } from './tower-journey.js';
import { sceneMotion } from './world-motion.js';
import { drawWorld, destinations } from './pixel-world.js';
export function animateWorld(canvas, initial = {}) {
  if (
    !canvas ||
    typeof canvas.getContext !== 'function' ||
    typeof globalThis.requestAnimationFrame !== 'function'
  )
    return { update() {}, dispose() {}, canvas };
  const ctx = canvas.getContext('2d');
  if (!ctx) return { update() {}, dispose() {}, canvas };
  const logicalWidth = canvas.width,
    logicalHeight = canvas.height;
  canvas.width = logicalWidth * 2;
  canvas.height = logicalHeight * 2;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = { scene: 'hub', progress: 0, count: 2, actor: { ...destinations.tone }, ...initial },
    time = 0,
    last = 0,
    effect = 0,
    entry = 0,
    id = 0,
    disposed = false,
    actor = { ...(initial.actor || destinations.tone) },
    target = null,
    waypoints = [],
    journey = null;
  let tower = null;
  function update(next) {
    if (next.scene === 'rail' && !journey) journey = createRailJourney(next.progress || 0);
    if (journey && (next.scene === 'rail' || state.scene === 'rail'))
      journey.update({ ...state, ...next });
    if (next.scene === 'tone' && !tower) tower = createTowerJourney(next.progress || 0);
    if (tower && next.scene === 'tone') tower.update({ ...state, ...next });
    if (next.phase !== undefined && next.phase !== state.phase) effect = 0;
    if (next.scene !== undefined && next.scene !== state.scene) {
      entry = 0;
      effect = 0;
    }
    if (next.destination && next.destination !== state.destination) {
      target = destinations[next.destination];
      if (Math.hypot(actor.x - target.x, actor.y - target.y) < 2) {
        target = null;
        waypoints = [];
        next.onTravel?.(false);
      } else {
        waypoints = [{ x: 237, y: 206 }, { ...target }];
        next.onTravel?.(true);
      }
    }
    state = { ...state, ...next };
    if (reduced.matches && target) {
      actor = { ...target };
      target = null;
      waypoints = [];
      state.onTravel?.(false);
    }
  }
  function frame(now) {
    if (disposed) return;
    if (!canvas.isConnected) {
      dispose();
      return;
    }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!state.paused) {
      if (!reduced.matches) time += dt;
      effect += dt;
      entry += dt;
      if (target) {
        const p = waypoints[0],
          dx = p.x - actor.x,
          dy = p.y - actor.y,
          dist = Math.hypot(dx, dy),
          step = 120 * dt;
        if (dist <= step || reduced.matches) {
          actor = { ...p };
          waypoints.shift();
          if (!waypoints.length) {
            target = null;
            state.onTravel?.(false);
          }
        } else {
          actor.x += (dx / dist) * step;
          actor.y += (dy / dist) * step;
        }
      }
    }
    const motion = sceneMotion(state, effect, reduced.matches);
    const rail =
      state.scene === 'rail'
        ? journey?.tick(dt, {
            approach: state.approach,
            paused: state.paused,
            reduced: reduced.matches,
          })
        : null;
    const entering = state.entry && entry < 1.8 && !reduced.matches;
    if (canvas.parentElement) canvas.parentElement.dataset.entering = String(entering);
    if (entering) {
      ctx.save();
      ctx.translate(0, -38);
    }
    const climb =
      state.scene === 'tone'
        ? tower?.tick(dt, { paused: state.paused, reduced: reduced.matches })
        : null;
    const snapshot = {
      ...state,
      scene: entering ? 'tower-entry' : state.scene,
      entry: Math.min(1, entry / 1.65),
      time,
      actor,
      walking: Boolean(target),
      reduced: reduced.matches,
      ...motion,
      fall: rail?.fall ?? motion.fall,
      elapsed: effect,
      journey: rail,
      approach: state.approach || 0,
      towerCamera: climb?.camera || 0,
    };
    const resting =
      state.scene === 'tone' && state.phase === 'landing' && (reduced.matches || effect >= 1.25);
    if (canvas.parentElement) canvas.parentElement.dataset.resting = String(resting);
    if (state.ending === 'won' && (effect > 1.2 || reduced.matches)) {
      canvas.parentElement?.style.setProperty('--tower-offset', '0%');
      drawFinale(ctx, { ...snapshot, scene: state.scene, elapsed: Math.max(0, effect - 1.2) }, P);
      if (!reduced.matches && effect < 1.9) {
        ctx.fillStyle = 'rgba(25,41,61,' + (1 - (effect - 1.2) / 0.7) + ')';
        ctx.fillRect(0, 0, 480, 240);
      }
    } else if (resting) {
      canvas.parentElement?.style.setProperty('--tower-offset', '0%');
      drawWorld(ctx, {
        ...snapshot,
        scene: 'tower-rest',
        restTime: reduced.matches ? 99 : Math.max(0, effect - 1.25),
      });
    } else if (climb && !entering) {
      // The controls ride the same room as the artwork, including across new door counts.
      canvas.parentElement?.style.setProperty('--tower-offset', climb.offset / 2.4 + '%');
      ctx.clearRect(0, 0, 480, 240);
      if (climb.previous) {
        ctx.save();
        ctx.translate(0, climb.offset + 240);
        ctx.beginPath();
        ctx.rect(0, 0, 480, 240);
        ctx.clip();
        drawWorld(ctx, { ...snapshot, ...climb.previous, time, reduced: reduced.matches });
        ctx.restore();
      }
      ctx.save();
      ctx.translate(0, climb.offset);
      ctx.beginPath();
      ctx.rect(0, 0, 480, 240);
      ctx.clip();
      drawWorld(ctx, snapshot);
      ctx.restore();
    } else drawWorld(ctx, snapshot);
    if (entering) ctx.restore();
    id = requestAnimationFrame(frame);
  }
  function dispose() {
    disposed = true;
    cancelAnimationFrame(id);
  }
  update(initial);
  id = requestAnimationFrame(frame);
  return { update, dispose, canvas };
}
