const districtColors = (P) => [P.grass, P.water, P.gold, P.leaf, '#b4b2dc'];
const heart = ['11011', '11111', '01110', '00100'];
function pixels(ctx) {
  return (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.max(0, Math.round(w)),
      Math.max(0, Math.round(h)),
    );
  };
}
function label(ctx, value, x, y, color, size = 8) {
  ctx.fillStyle = color;
  ctx.font = 'bold ' + size + 'px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(value), Math.round(x), Math.round(y));
}

export function drawFloorGauge(ctx, s, P) {
  if (s.practice) return;
  const r = pixels(ctx),
    cleared = Math.max(0, Math.min(100, s.progress || 0)),
    floor = Math.min(100, (s.floor ?? cleared) + 1),
    colors = districtColors(P);
  // The complete silhouette stays visible: one window per floor, five districts of twenty.
  r(0, 16, 31, 208, P.dark);
  for (let tier = 0; tier < 5; tier++) {
    const width = 18 + tier * 2,
      x = 15 - width / 2,
      y = 31 + tier * 35;
    r(x, y, width, 33, P.stone);
    r(x + 2, y + 2, width - 4, 29, P.deep);
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 5; col++) {
        const index = (4 - tier) * 20 + (3 - row) * 5 + col,
          wx = x + 3 + (col * (width - 6)) / 5,
          wy = y + 5 + row * 6;
        r(wx, wy, 2, 3, index < cleared ? colors[4 - tier] : P.shade);
        if (index < cleared) r(wx, wy, 1, 1, P.cream);
        if (index === floor - 1 && cleared < 100) r(wx - 1, wy - 1, 4, 1, P.teal);
      }
    r(x - 2, y - 3, width + 4, 2, P.teal);
    r(x - 4, y - 1, width + 8, 2, P.gold);
  }
  r(11, 24, 8, 5, P.stone);
  r(14, 18, 2, 6, P.gold);
  r(2, 207, 26, 4, P.edge);
  r(10, 199, 10, 8, P.wood);
  const currentY = 197 - ((floor - 1) / 99) * 166;
  r(28, currentY - 2, 3, 5, P.cream);
  r(25, currentY - 1, 3, 3, P.teal);
  r(2, 0, 109, 13, P.dark);
  label(ctx, 'FLOOR ' + String(floor).padStart(2, '0') + ' / 100', 56, 10, P.cream, 8);
}

export function drawTowerHearts(ctx, s, P, { x = 94, y = 22, scale = 3 } = {}) {
  if (s.lives === undefined) return;
  if (s.lives === null) {
    label(ctx, '∞', x + 12, y + 12, P.cream, 16);
    return;
  }
  const r = pixels(ctx),
    max = s.maxLives || 4,
    elapsed = s.elapsed || 0,
    rest = s.restTime;
  const recovered = s.recovered || 0,
    previous = s.lives - recovered;
  const visible =
    rest !== undefined
      ? Math.min(s.lives, previous + Math.floor(Math.max(0, rest) / 0.25))
      : s.phase === 'landing'
        ? previous
        : s.lives;
  const drawHeart = (hx, hy, color) => {
    for (let yy = 0; yy < 4; yy++)
      for (let xx = 0; xx < 5; xx++)
        if (heart[yy][xx] === '1') r(hx + xx * scale, hy + yy * scale, scale, scale, color);
  };
  for (let i = 0; i < max; i++) {
    const hx = x + i * (scale * 5 + 3),
      fresh = i >= previous && i < s.lives && recovered > 0;
    const age =
      rest !== undefined ? rest - (i - previous) * 0.25 : elapsed - 0.25 - (i - previous) * 0.14;
    const arrived = !fresh || s.reduced || age > 0.5;
    drawHeart(hx, y, i < visible && arrived ? (fresh && age < 0.8 ? P.cream : P.red) : P.deep);
    if (fresh && !s.reduced && age >= 0 && age < 0.8) {
      const p = Math.min(1, age / 0.5),
        ease = 1 - (1 - p) * (1 - p);
      drawHeart(hx + (1 - ease) * 34, y + (1 - ease) * 38 - Math.sin(p * Math.PI) * 12, P.cream);
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const distance = Math.max(0, age - 0.25) * 24;
        r(
          hx + 6 + Math.cos(a) * distance,
          y + 5 + Math.sin(a) * distance,
          2,
          2,
          k % 2 ? P.gold : P.teal,
        );
      }
    }
  }
  // A lost heart lifts out of its empty slot, then breaks into four soft sparks.
  if (
    s.phase === 'review' &&
    ['tone', 'timeout'].includes(s.reason) &&
    !s.reduced &&
    elapsed < 1.4
  ) {
    const p = Math.min(1, elapsed / 1.4),
      hx = x + s.lives * (scale * 5 + 3),
      hy = y - p * 15;
    if (p < 0.55) drawHeart(hx, hy, P.red);
    else
      for (let k = 0; k < 4; k++)
        r(
          hx + 6 + (k % 2 ? 1 : -1) * (p - 0.5) * 22,
          hy + 4 + (k < 2 ? -1 : 1) * (p - 0.5) * 15,
          3,
          3,
          k % 2 ? P.cream : P.red,
        );
  }
}

export function drawDoorCreature(ctx, { x, y, w, h, elapsed = 0, reduced = false }, P) {
  const r = pixels(ctx),
    peek = reduced ? 1 : Math.min(1, Math.max(0, (elapsed - 0.2) / 0.35));
  const cx = x + w / 2,
    cy = y + h * 0.66 + (1 - peek) * 8,
    bob = reduced ? 0 : Math.round(Math.sin(elapsed * 5));
  // A small mischievous dust creature lives behind the mistaken door.
  r(cx - 10, cy - 9 + bob, 20, 14, P.shade);
  r(cx - 7, cy - 13 + bob, 14, 20, '#9690b9');
  r(cx - 10, cy - 16 + bob, 5, 8, '#b4b2dc');
  r(cx + 5, cy - 16 + bob, 5, 8, '#b4b2dc');
  r(cx - 6, cy - 7 + bob, 4, 5, P.cream);
  r(cx + 3, cy - 7 + bob, 4, 5, P.cream);
  r(cx - 4, cy - 5 + bob, 2, 3, P.dark);
  r(cx + 3, cy - 5 + bob, 2, 3, P.dark);
  r(cx - 3, cy + 2 + bob, 7, 2, P.deep);
  r(cx - 7, cy + 7, 4, 3, P.shade);
  r(cx + 4, cy + 7, 4, 3, P.shade);
}

export function drawRestLanding(ctx, s, P, sprite) {
  const r = pixels(ctx),
    colors = districtColors(P),
    level = Math.min(4, Math.floor((s.progress || 0) / 20));
  r(0, 0, 480, 240, P.sky);
  r(0, 154, 480, 86, P.far);
  for (let i = 0; i < 5; i++) {
    const x = i * 108 - 35,
      y = 95 + (i % 2) * 25;
    r(x, y, 84, 4, P.cloud);
    r(x + 10, y + 4, 64, 13, P.far);
    r(x + 25, y + 17, 32, 22, P.far);
  }
  r(0, 0, 480, 15, P.stone);
  r(0, 15, 480, 3, P.edge);
  r(18, 18, 13, 208, P.stone);
  r(449, 18, 13, 208, P.stone);
  r(0, 224, 480, 16, P.stone);
  r(0, 224, 480, 3, P.edge);
  r(25, 196, 430, 4, P.edge);
  for (let i = 0; i < 16; i++) r(29 + i * 28, 199, 3, 25, P.shade);
  // Quiet reading space beside a lantern fountain and the open sky.
  // An open balcony, rather than a blank backing panel, keeps the landing alive on phones.
  r(36, 38, 408, 3, colors[level]);
  r(381, 49, 18, 3, P.mist);
  r(377, 52, 26, 10, P.mist);
  r(381, 62, 18, 3, P.mist);
  r(389, 47, 16, 13, P.sky);
  r(73, 153, 61, 41, P.shade);
  r(79, 145, 49, 4, P.water);
  r(74, 149, 59, 4, P.teal);
  r(68, 152, 71, 3, P.gold);
  r(67, 148, 3, 5, P.teal);
  r(138, 148, 3, 5, P.teal);
  for (let k = 0; k < 4; k++) r(82 + k * 12, 164, 4, 12, P.gold);
  for (const x of [49, 185, 426]) {
    r(x, 204, 14, 16, P.wood);
    r(x + 5, 178, 3, 26, P.grass);
    r(x - 2, 185, 10, 4, P.leaf);
    r(x + 7, 179, 9, 5, P.grass);
  }
  for (let k = 0; k < 5; k++) {
    const lx = 70 + k * 74,
      ly = 65 + (k % 2) * 14 + (s.reduced ? 0 : Math.sin((s.time || 0) * 0.7 + k) * 2);
    r(lx, ly - 14, 1, 14, P.wood);
    r(lx - 3, ly, 7, 9, P.gold);
    r(lx - 1, ly + 1, 3, 6, P.cream);
    r(lx, ly + 9, 1, 4, P.red);
  }
  r(343, 205, 69, 6, P.stone);
  r(350, 196, 55, 9, P.water);
  r(358, 191, 39, 5, P.glass);
  r(373, 168, 8, 25, P.wood);
  r(368, 157, 18, 12, P.gold);
  r(372, 160, 10, 6, P.cream);
  if (!s.reduced)
    for (let k = 0; k < 5; k++)
      r(355 + k * 10, 196 - (((s.restTime || 0) * 16 + k * 7) % 22), 2, 3, P.glass);
  drawTowerHearts(ctx, s, P, { x: 326, y: 139, scale: 2 });
  sprite(345, 218, false);
  drawFloorGauge(ctx, { ...s, floor: Math.max(0, (s.progress || 1) - 1) }, P);
  label(ctx, 'REST', 377, 122, P.cream, 9);
}
