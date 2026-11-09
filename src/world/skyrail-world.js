import {
  drawCloud,
  drawGlow,
  drawSky,
  drawSprout,
  drawTree,
  drawRoof,
  drawIsland,
  drawGarden,
  drawRepairSpan,
} from './pixel-art.js';
import { drawTowerHearts } from './tower-details.js';
import { RAIL_SPAN } from './rail-journey.js';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const RAIL_CARS = ['Local', 'Climber', 'Express', 'Skyglider', 'Comet'];
export function drawSkyrail(ctx, s, base) {
  const region = s.journey?.region ?? Math.min(4, Math.floor((s.progress || 0) / 20));
  const skies = ['#202c49', '#203e48', '#493647', '#303453', '#20243e'],
    fars = ['#344461', '#355961', '#715161', '#515779', '#414e70'];
  const blend = (a, b, f) =>
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - f) + parseInt(b.slice(i, i + 2), 16) * f)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  const lo = Math.floor(region),
    hi = Math.min(4, lo + 1),
    P = {
      ...base,
      sky: blend(skies[lo], skies[hi], region - lo),
      far: blend(fars[lo], fars[hi], region - lo),
    };
  const H = 288,
    t = s.reduced ? 0 : s.time || 0,
    j = s.journey || {
      camera: (s.progress || 0) * RAIL_SPAN,
      segment: s.progress || 0,
      progress: s.progress || 0,
      repaired: new Set(),
      failed: new Set(),
      celebration: 0,
      rescue: 0,
    },
    cam = j.camera,
    level = clamp(Math.floor((s.progress || 0) / 20), 0, 4);
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.max(0, Math.round(w)),
      Math.max(0, Math.round(h)),
    );
  };
  const circle = (x, y, rad, c) => {
    for (let yy = -rad; yy <= rad; yy++)
      for (let xx = -rad; xx <= rad; xx++)
        if (xx * xx + yy * yy <= rad * rad) r(x + xx, y + yy, 1, 1, c);
  };
  const text = (value, x, y, c = P.cream, size = 10) => {
    ctx.fillStyle = c;
    ctx.font = 'bold ' + size + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(value), Math.round(x), Math.round(y));
  };
  const hash = (n) => (((n * 137 + 73) % 997) + 997) % 997;
  const cloud = (x, y, w) => drawCloud(ctx, x, y, w, P);
  const tree = (x, y, grand = false) => drawTree(ctx, x, y, P, grand);
  const lamp = (x, y, lit = true) => {
    if (lit) drawGlow(ctx, x + 1, y + 9, P, 1.5);
    r(x, y, 2, 18, P.deep);
    r(x - 3, y + 3, 8, 2, P.gold);
    r(x - 2, y + 5, 6, 8, lit ? P.gold : P.shade);
    r(x, y + 6, 2, 5, lit ? P.cream : P.stone);
  };
  const eaves = (x, y, w) => drawRoof(ctx, x, y - 4, w, P);
  const house = (x, y, w = 30) => {
    r(x, y, w, 28, P.shade);
    r(x + 2, y + 2, w - 4, 24, P.stone);
    eaves(x - 4, y - 8, w + 8);
    r(x + 5, y + 8, 5, 9, P.gold);
    r(x + 7, y + 9, 2, 6, P.cream);
    r(x + w - 11, y + 8, 5, 9, P.deep);
    r(x + w / 2 - 3, y + 18, 7, 10, P.deep);
  };
  ctx.imageSmoothingEnabled = false;
  drawSky(ctx, { time: t, reduced: s.reduced, camera: cam, height: H }, P);
  // Distant mountain/island silhouettes move at a fraction of the foreground pace.
  const farStart = Math.floor((cam * 0.12) / 130) - 2;
  for (let i = farStart; i < farStart + 8; i++) {
    const x = i * 130 - cam * 0.12,
      y = 120 + (hash(i) % 42);
    drawIsland(
      ctx,
      x,
      y,
      105,
      47,
      { ...P, grass: P.cloud, leaf: P.cloud, stone: P.far, shade: P.far, deep: P.far },
      i,
    );
    if (hash(i) % 3 === 0) house(x + 40, y - 24, 25);
    if (level >= 2) {
      r(x + 18, y - 48, 16, 48, P.far);
      r(x + 14, y - 51, 24, 4, P.cloud);
      r(x + 23, y - 64, 6, 13, P.cloud);
    }
  }
  for (let i = -1; i < 5; i++) {
    const x = i * 145 - ((cam * 0.06) % 145);
    cloud(x, 64 + (i % 2) * 24, 58);
    if (level >= 3) cloud(x + 24, 164 + (i % 2) * 11, 79);
  }
  // Region-specific landmarks pass naturally, rather than being replaced per word.
  const midStart = Math.floor((cam * 0.35) / 170) - 2;
  for (let i = midStart; i < midStart + 8; i++) {
    const x = i * 170 - cam * 0.35,
      region = clamp(
        Math.floor(((i * 170) / 0.35 / RAIL_SPAN - (j.segment - (s.progress || 0))) / 20),
        0,
        4,
      ),
      y = 150 + (hash(i) % 18);
    drawIsland(ctx, x, y, 116, 39, P, i);
    if (region === 0) {
      house(x + 36, y - 29, 32);
      tree(x + 82, y - 25);
    }
    if (region === 1) {
      house(x + 21, y - 30, 36);
      r(x + 8, y - 3, 100, 3, P.grass);
      for (let k = 0; k < 4; k++) {
        r(x + 14 + k * 25, y + 3, 2, 25 + (hash(k + i) % 17), P.grass);
        r(x + 10 + k * 25, y + 12, 10, 3, P.leaf);
      }
      r(x + 65, y + 16, 5, 44, P.water);
    }
    if (region === 2) {
      house(x + 56, y - 28, 36);
      r(x + 14, y - 63, 8, 64, P.wood);
      r(x + 10, y - 67, 42, 5, P.gold);
      r(x + 40, y - 62, 2, 34, P.gold);
      r(x + 34, y - 29, 15, 9, P.shade);
      for (let k = 0; k < 4; k++) {
        r(x + 6 + k * 28, y - 7, 2, 7, P.gold);
      }
    }
    if (region === 3) {
      house(x + 26, y - 35, 52);
      r(x + 44, y - 50, 16, 15, P.stone);
      r(x + 40, y - 54, 24, 4, P.teal);
      r(x + 50, y - 68, 4, 14, P.gold);
      r(x + 6, y - 10, 2, 13, P.wood);
      r(x + 8, y - 10, 18, 3, P.red);
    }
    if (region === 4) {
      r(x + 24, y - 81, 58, 82, P.shade);
      r(x + 29, y - 76, 48, 77, P.stone);
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 4; col++) r(x + 35 + col * 10, y - 67 + row * 13, 4, 6, P.gold);
      r(x + 18, y - 85, 70, 4, P.edge);
      r(x + 39, y - 94, 28, 9, P.stone);
      r(x + 49, y - 109, 8, 15, P.teal);
    }
  }
  // The near track is a single world-space route. Old repairs stay behind the car.
  const first = Math.floor((cam - 300) / RAIL_SPAN);
  for (let i = first; i < first + 7; i++) {
    const x = i * RAIL_SPAN - cam,
      biome = clamp(Math.floor(((s.progress || 0) + i - j.segment) / 20), 0, 4),
      isCliff = hash(i) % 3 === 0 || i === 0;
    if (isCliff) {
      r(x - 5, 214, RAIL_SPAN + 10, 75, P.deep);
      r(x, 214, RAIL_SPAN, 5, P.grass);
      for (let k = 0; k < 7; k++) {
        r(x + 10 + k * 24, 225, 3, 50, P.shade);
        r(x + 7 + k * 24, 228, 2, 16, P.stone);
        r(x + 8 + k * 24, 246 + (k % 3) * 5, 13, 2, P.shade);
        r(x + 6 + k * 24, 249 + (k % 3) * 5, 6, 3, P.deep);
      }
    } else {
      r(x, 214, RAIL_SPAN, 5, P.stone);
      r(x, 219, RAIL_SPAN, 3, P.edge);
      for (let k = 0; k < 5; k++) {
        r(x + k * 40, 222, 6, 58, P.shade);
        r(x + k * 40 + 6, 222, 34, 3, P.shade);
        r(x + k * 40 + 6, 225, 4, 6, P.shade);
        r(x + k * 40 + 32, 225, 4, 6, P.shade);
      }
    }
    if (isCliff) {
      drawGarden(ctx, x + 14, 204, P, i);
      drawGarden(ctx, x + 150, 205, P, i + 1);
      r(x + 36, 220, 23, 2, P.grass);
      r(x + 41, 222, 2, 17, P.grass);
      r(x + 39, 232, 5, 2, P.leaf);
    }
    for (let k = 0; k < 15; k++) {
      r(x + k * 12, 207, 5, 12, P.deep);
      r(x + k * 12, 208, 4, 10, P.wood);
      r(x + k * 12 + 1, 209, 1, 7, P.brick);
    }
    r(x, 207, RAIL_SPAN, 2, P.edge);
    r(x, 215, RAIL_SPAN, 2, P.stone);
    if (i === 0) {
      house(x + 18, 169, 63);
      r(x + 12, 197, 78, 5, P.edge);
      lamp(x + 9, 176);
    } else if (i % 5 === 0) {
      r(x + 20, 168, 2, 39, P.wood);
      r(x + 22, 168, 17, 4, P.red);
      r(x + 22, 172, 11, 3, P.cream);
      lamp(x + 55, 187);
    } else if (biome === 0) {
      tree(x + 105, 182);
    } else if (biome === 1) {
      r(x + 91, 191, 31, 8, P.brick);
      for (let k = 0; k < 4; k++) {
        r(x + 95 + k * 7, 181, 3, 11, P.grass);
        r(x + 94 + k * 7, 178, 5, 4, P.leaf);
      }
      r(x + 120, 220, 2, 30, P.grass);
    } else if (biome === 2) {
      r(x + 86, 126, 7, 80, P.wood);
      r(x + 86, 127, 67, 4, P.gold);
      r(x + 145, 127, 7, 79, P.wood);
      for (let k = 0; k < 4; k++) r(x + 95 + k * 13, 132 + k * 8, 3, 9, P.gold);
      r(x + 102, 197, 34, 6, P.deep);
    } else if (biome === 3) {
      r(x + 75, 117, 7, 91, P.stone);
      r(x + 150, 117, 7, 91, P.stone);
      r(x + 75, 114, 82, 5, P.edge);
      r(x + 93, 101, 47, 5, P.stone);
      r(x + 80, 119, 5, 13, P.shade);
      r(x + 145, 119, 5, 13, P.shade);
      lamp(x + 115, 132);
    } else {
      r(x + 74, 115, 9, 93, P.stone);
      r(x + 155, 115, 9, 93, P.stone);
      r(x + 74, 110, 90, 7, P.edge);
      r(x + 88, 98, 63, 8, P.stone);
      r(x + 100, 87, 38, 9, P.edge);
      r(x + 111, 66, 16, 21, P.gold);
      r(x + 79, 118, 11, 21, P.shade);
      r(x + 148, 118, 11, 21, P.shade);
      for (let k = 0; k < 4; k++) r(x + 99 + k * 13, 123, 2, 14, P.teal);
    }
  }
  const newestRepair = j.repaired.size ? Math.max(...j.repaired) : null;
  // Gaps are separate from scenery chunks, so construction and camera motion never reset.
  for (let i = first - 1; i < first + 6; i++) {
    const gx = i * RAIL_SPAN + 270 - cam,
      done = j.repaired.has(i) || (i < j.segment && !j.failed.has(i));
    if (!done) {
      r(gx, 205, 58, 83, P.far);
      r(gx - 3, 206, 3, 8, P.gold);
      r(gx + 58, 206, 3, 8, P.gold);
      r(gx - 7, 215, 7, 3, P.wood);
      r(gx + 58, 215, 7, 3, P.wood);
    } else {
      const building = i === newestRepair && j.celebration > 0;
      if (building && !s.reduced && j.celebration > 1.43) r(gx, 205, 58, 83, P.far);
      drawRepairSpan(ctx, gx, P, { age: building ? 1.65 - j.celebration : 1, reduced: s.reduced });
      if (building && !s.reduced && j.celebration < 1.43) {
        for (let k = 0; k < 4; k++)
          r(gx + 8 + k * 13, 199 - ((t * 15 + k * 3) % 13), 2, 3, P.cream);
      }
    }
    // A real trackside sign carries the deadline. Its old face becomes a route arrow.
    if (i < j.segment) continue;
    const post = gx + 75;
    r(post, 181, 3, 27, P.wood);
    r(post - 24, 154, 51, 29, P.deep);
    r(post - 22, 156, 47, 25, P.shade);
    r(post - 22, 156, 47, 2, P.edge);
    if (i === j.segment) {
      const ready = s.result === 'success';
      text(
        ready ? 'GO' : s.timed === false ? '∞' : Math.ceil(s.remaining || 0) + 's',
        post + 1,
        176,
        ready ? P.leaf : (s.remaining || 0) <= 4 && s.timed !== false ? P.red : P.cream,
        16,
      );
    } else {
      text(i < j.segment ? '›' : '·', post + 1, 176, P.gold, 12);
    }
  }
  // A station appears after the crossing, with time to notice the new district.
  if (j.station !== null && j.station !== undefined && !s.ending) {
    const arrive =
        s.reduced || s.phase !== 'landing' ? 1 : Math.min(1, Math.max(0, (s.elapsed - 0.5) / 0.8)),
      sy = 105 + (1 - arrive) * 24,
      sx = j.station - cam;
    if (sx > -200 && sx < 500) {
      r(sx, sy + 14, 173, 82, P.deep);
      r(sx + 7, sy + 19, 159, 74, P.wood);
      eaves(sx - 9, sy, 191);
      r(sx + 18, sy + 32, 135, 40, P.shade);
      for (const xx of [sx + 24, sx + 129]) {
        r(xx, sy + 38, 17, 29, P.gold);
        r(xx + 7, sy + 38, 2, 29, P.wood);
        r(xx, sy + 49, 17, 2, P.wood);
      }
      r(sx + 63, sy + 38, 47, 55, P.dark);
      r(sx + 73, sy + 43, 27, 50, P.teal);
      lamp(sx + 1, sy + 25);
      lamp(sx + 170, sy + 25);
      r(sx - 16, 202, 200, 4, P.edge);
    }
  }
  // Car upgrades increase the apparent pace and silhouette at the twenty-span checkpoints.
  const fall = s.fall || 0,
    rescue = s.reduced ? 0 : j.rescue || 0,
    carX = 160 + fall * 32,
    carY = 203 + fall * fall * 190 - (rescue > 0 ? Math.pow(rescue / 1.5, 2) * 100 : 0),
    half = 26 + level * 3;
  const rotate = fall > 0 && typeof ctx.rotate === 'function';
  if (rotate) {
    ctx.save();
    ctx.translate(carX, carY);
    ctx.rotate(fall * 0.65);
    ctx.translate(-carX, -carY);
  }
  if (rescue > 0) {
    r(carX - 14, carY - 68, 28, 5, P.gold);
    r(carX - 19, carY - 63, 38, 6, P.cream);
    r(carX - 14, carY - 57, 2, 22, P.edge);
    r(carX + 12, carY - 57, 2, 22, P.edge);
  }
  r(carX - half + 4, carY - 37, half * 2 - 8, 2, P.dark);
  r(carX - half, carY - 35, half * 2, 2, P.wood);
  r(carX - half + 5, carY - 36, half * 2 - 10, 1, P.gold);
  r(carX - half - 2, carY - 34, half * 2 + 4, 3, P.deep);
  r(carX - half - 4, carY - 31, half * 2 + 8, 4, level >= 2 ? P.gold : P.wood);
  r(carX - half + 2, carY - 27, half * 2 - 4, 24, level >= 3 ? P.water : P.teal);
  r(carX - half + 4, carY - 25, half * 2 - 8, 2, P.glass);
  for (const side of [-1, 1]) {
    r(carX + side * 12 - 7, carY - 22, 14, 13, P.sky);
    r(carX + side * 12 - 5, carY - 20, 3, 9, P.glass);
  }
  for (const cx of [carX - half + 3, carX + half - 6]) {
    r(cx, carY - 24, 3, 20, P.wood);
    r(cx, carY - 24, 1, 19, P.gold);
  }
  r(carX - half - 3, carY - 5, half * 2 + 6, 6, P.gold);
  r(carX - half - 5, carY + 1, half * 2 + 10, 3, P.deep);
  r(carX - half + 7, carY + 5, half * 2 - 14, 2, P.wood);
  for (const sx of [carX - half + 11, carX + half - 15]) {
    r(sx, carY, 5, 1, P.edge);
    r(sx + 1, carY + 2, 3, 1, P.stone);
  }
  if (level >= 1) {
    r(carX - half - 9, carY - 11, 8, 3, P.gold);
    r(carX + half + 2, carY - 15, 4, 6, P.cream);
  }
  if (level >= 2) {
    r(carX - half + 4, carY - 40, 6, 10, P.wood);
    r(carX - half + 2, carY - 42, 10, 3, P.deep);
  }
  if (level >= 3) {
    r(carX - half - 15, carY - 20, 15, 3, P.edge);
    r(carX + half, carY - 20, 15, 3, P.edge);
    r(carX - half - 10, carY - 17, 3, 10, P.wood);
    r(carX + half + 7, carY - 17, 3, 10, P.wood);
  }
  if (level >= 4) {
    r(carX + half + 4, carY - 2, 9, 3, P.gold);
    r(carX + half + 8, carY - 5, 5, 3, P.gold);
    r(carX - 8, carY - 33, 16, 2, P.cream);
  }
  for (const wx of [carX - half + 10, carX + half - 10]) {
    circle(wx, carY + 6, 6, P.deep);
    circle(wx, carY + 6, 4, level >= 2 ? P.gold : P.stone);
    const phase = Math.floor(cam / 3) % 4;
    r(
      wx + (phase % 2 ? 0 : -3),
      carY + 6 + (phase % 2 ? -3 : 0),
      phase % 2 ? 1 : 7,
      phase % 2 ? 7 : 1,
      P.edge,
    );
  }
  // The explorer uses the same face, scarf and leaf poses in every scene.
  drawSprout(ctx, carX, carY - 8, P, { time: t, reduced: s.reduced, seated: true });
  r(carX - 9, carY - 7, 18, 3, P.water);
  r(carX - half + 5, carY - 4, half * 2 - 10, 1, P.cream);
  for (let k = 0; k < 3; k++) r(carX - half + 5 + k * 4, carY - 12, 2, 4, P.deep);
  r(carX + half - 4, carY - 19, 5, 9, P.deep);
  r(carX + half - 3, carY - 18, 4, 6, P.gold);
  r(carX + half - 2, carY - 17, 3, 3, P.cream);
  drawGlow(ctx, carX + half, carY - 15, P, 1.5);
  for (let k = 0; k < 3; k++) {
    const age = s.reduced ? k * 8 : (t * 12 + k * 10) % 36;
    const puff = 3 + Math.floor(age / 9);
    r(carX - half - 5 - age, carY - 29 - age / 3, puff, 3, age > 23 ? P.far : P.cloud);
    r(carX - half - 4 - age, carY - 30 - age / 3, Math.max(1, puff - 2), 1, P.mist);
  }
  if (j.celebration > 0) {
    const cx = carX + half + 8,
      cy = carY - 25;
    r(cx, cy, 3, 3, P.leaf);
    r(cx + 3, cy + 3, 3, 3, P.leaf);
    r(cx + 6, cy, 3, 3, P.leaf);
    r(cx + 9, cy - 3, 3, 3, P.leaf);
  }
  if (rotate) ctx.restore();
  drawTowerHearts(
    ctx,
    s.phase === 'landing' ? { ...s, restTime: Math.max(0, (s.elapsed || 0) - 0.9) } : s,
    P,
    { x: 160 - (s.maxLives || 4) * 6, y: 141, scale: 2 },
  );
  if (s.recovered && !s.reduced && (s.elapsed || 0) < 1.5) {
    const p = Math.min(1, (s.elapsed || 0) / 1.1),
      x = 230 - 75 * p,
      y = 198 - 57 * p - Math.sin(p * Math.PI) * 28;
    r(x - 4, y - 3, 3, 3, P.cream);
    r(x + 1, y - 3, 3, 3, P.cream);
    r(x - 4, y, 8, 3, P.red);
    r(x - 2, y + 3, 4, 2, P.red);
    if (p > 0.3) text('+ LIFE', 222, 125 - Math.min(1, p) * 10, P.cream, 8);
    for (let k = 0; k < 4; k++) r(x + 8 + k * 6, y + 5 + k * 3, 2, 2, P.gold);
  }
  if (s.phase === 'review' && s.reason === 'timeout' && (s.elapsed || 0) > 1.2) {
    const p = s.reduced ? 1 : Math.min(1, ((s.elapsed || 0) - 1.2) / 1.2),
      lx = 166,
      ly = 246 - p * 41;
    r(lx - 16, ly - 55, 32, 4, P.gold);
    r(lx - 21, ly - 51, 42, 9, P.cream);
    r(lx - 15, ly - 42, 2, 30, P.wood);
    r(lx + 13, ly - 42, 2, 30, P.wood);
    r(lx - 18, ly - 12, 36, 13, P.gold);
    r(lx - 14, ly - 8, 28, 7, P.wood);
    drawSprout(ctx, lx, ly - 11, P, { time: t, reduced: s.reduced, seated: true });
    r(lx - 14, ly - 8, 28, 2, P.gold);
    for (let k = 0; k < 6; k++) cloud(lx - 100 + k * 37, 218 + Math.sin(t + k) * 3, 48);
  }
}
