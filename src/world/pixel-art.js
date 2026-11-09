// Shared, integer-grid artwork. Animation is quantized into deliberate sprite poses.
export function pixelBrush(ctx) {
  return (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.max(0, Math.round(w)),
      Math.max(0, Math.round(h)),
    );
  };
}

export function drawGlow(ctx, x, y, P, size = 1) {
  const r = pixelBrush(ctx);
  // Stepped octagons avoid square light patches while retaining the pixel grid.
  for (const [dy, inset, height] of [
    [-12, 7, 3],
    [-9, 10, 3],
    [-6, 12, 12],
    [6, 10, 3],
    [9, 7, 3],
  ]) {
    r(x - inset * size, y + dy * size, inset * 2 * size, height * size, 'rgba(255,191,102,.035)');
  }
  r(x - 6 * size, y - 4 * size, 12 * size, 8 * size, 'rgba(255,207,128,.045)');
  r(x - 4 * size, y - 6 * size, 8 * size, 12 * size, 'rgba(255,207,128,.045)');
  r(x - 3 * size, y - 3 * size, 6 * size, 6 * size, 'rgba(255,224,160,.07)');
}

export function drawCloud(ctx, x, y, w, P) {
  const r = pixelBrush(ctx);
  // Uneven lobes, a bright upper rim and a quiet underside.
  r(x + 12, y, w * 0.32, 3, P.cloud);
  r(x + 7, y + 3, w - 23, 4, P.cloud);
  r(x + 2, y + 7, w - 7, 4, P.cloud);
  r(x, y + 11, w, 3, P.far);
  r(x + 7, y + 14, w - 17, 2, P.far);
  r(x + 14, y, w * 0.22, 1, P.mist);
  r(x + 8, y + 4, 10, 1, P.mist);
  r(x + w - 19, y + 5, 9, 2, P.cloud);
}

export function drawSky(ctx, { time = 0, reduced = false, camera = 0, height = 288 } = {}, P) {
  const r = pixelBrush(ctx),
    t = reduced ? 0 : time;
  r(0, 0, 480, height, P.sky);
  // Broad color bands keep the sky calm behind the detailed foreground.
  r(0, 156, 480, Math.max(0, height - 156), P.far);
  for (let i = 0; i < 48; i++) {
    const x = (((i * 83 + 17 - Math.round(camera * 0.015)) % 480) + 480) % 480;
    const y = 12 + ((i * 37) % 132);
    const bright = i % 9 === 0 && Math.floor(t * 0.65 + i) % 5 === 0;
    r(x, y, 1, 1, i % 4 === 0 ? P.mist : P.cloud);
    if (bright) {
      r(x - 1, y, 3, 1, P.mist);
      r(x, y - 1, 1, 3, P.mist);
    }
  }
  const mx = 408 - Math.round((camera * 0.012) % 120),
    my = 35;
  drawGlow(ctx, mx, my, P, 2);
  for (let y = -13; y <= 13; y++) {
    for (let x = -13; x <= 13; x++) {
      if (x * x + y * y <= 169 && (x - 5) * (x - 5) + (y + 4) * (y + 4) > 144)
        r(mx + x, my + y, 1, 1, x < -6 ? P.cream : P.gold);
    }
  }
  // Layered peaks establish distance without competing with destination silhouettes.
  for (let i = -1; i < 8; i++) {
    const x = i * 83 - Math.round((camera * 0.08) % 83),
      y = 142 + (i % 3) * 9;
    r(x, y, 88, 47, P.far);
    r(x + 12, y - 13, 56, 13, P.far);
    r(x + 25, y - 27, 28, 14, P.far);
    r(x + 31, y - 34, 15, 7, P.far);
  }
}

export function drawTree(ctx, x, y, P, grand = false) {
  const r = pixelBrush(ctx),
    shift = grand ? -4 : 0;
  r(x + 2, y + 25, 16, 2, P.deep);
  r(x + 7, y + 9, 4, 17, P.deep);
  r(x + 8, y + 10, 2, 15, P.wood);
  r(x + 4, y + 13, 4, 3, P.wood);
  r(x + 10, y + 9, 5, 3, P.wood);
  r(x - 2 + shift, y + 9, 23 - shift * 2, 8, P.deep);
  r(x + 1 + shift, y + 3, 17 - shift * 2, 15, P.grass);
  r(x + 5, y - 1 + shift, 10, 6 - shift, P.grass);
  r(x - 1 + shift, y + 8, 9, 6, P.grass);
  r(x + 16, y + 7, 5 - shift, 7, P.grass);
  r(x + 3, y + 4, 8, 3, P.leaf);
  r(x + 7, y, 6, 3, P.leaf);
  r(x + 1 + shift, y + 9, 5, 2, P.leaf);
  r(x + 13, y + 8, 5, 2, P.leaf);
  r(x + 5, y + 15, 9, 3, P.shade);
  r(x + 15, y + 12, 4, 3, P.shade);
  r(x + 6, y + 5, 2, 1, P.glass);
}

export function drawSprout(
  ctx,
  x,
  y,
  P,
  { time = 0, walking = false, reduced = false, direction = 1, hurt = false, seated = false } = {},
) {
  const r = pixelBrush(ctx),
    t = reduced ? 0 : time;
  const frame = walking && !reduced ? Math.floor(t * 10) % 6 : 0;
  const stride = walking && !reduced ? [-2, -1, 0, 2, 1, 0][frame] : 0;
  const bob =
    walking && !reduced ? [0, -1, -1, 0, -1, -1][frame] : Math.floor(t * 1.5) % 4 === 2 ? -1 : 0;
  x = Math.round(x);
  y = Math.round(y);
  // Feet stay grounded while the body bobs; shadow stays still.
  if (!seated) {
    r(x - 7, y + 4, 14, 2, 'rgba(12,22,37,.35)');
    r(x - 5 - stride, y + 1, 4, 3, P.dark);
    r(x + 2 + stride, y + 1, 4, 3, P.dark);
    r(x - 5 - stride, y + 1, 3, 1, P.gold);
    r(x + 2 + stride, y + 1, 3, 1, P.gold);
  }
  const by = y + bob;
  // Little travel coat, satchel and scarf make the explorer readable at map scale.
  r(x - 5, by - 6, 10, 8, P.dark);
  r(x - 4, by - 6, 8, 7, P.water);
  r(x - 3, by - 5, 3, 5, P.teal);
  r(x + 3 * direction, by - 5, 4, 6, P.wood);
  r(x + 4 * direction, by - 5, 2, 1, P.gold);
  r(x - 7, by - 5 + stride / 2, 3, 4, P.gold);
  r(x + 5, by - 5 - stride / 2, 3, 4, P.gold);
  r(x - 6, by - 17, 12, 12, P.dark);
  r(x - 8, by - 14, 16, 7, P.dark);
  r(x - 5, by - 17, 10, 2, P.gold);
  r(x - 6, by - 14, 12, 8, P.gold);
  r(x - 5, by - 15, 10, 8, P.cream);
  r(x - 7, by - 12, 2, 3, P.cream);
  r(x + 6, by - 12, 1, 3, P.gold);
  const blink = !reduced && !walking && t % 4.7 > 4.53;
  r(x - 3 + direction, by - 12, 1, blink || hurt ? 1 : 2, P.dark);
  r(x + 2 + direction, by - 12, 1, blink || hurt ? 1 : 2, P.dark);
  r(x - 5, by - 10, 2, 1, P.red);
  r(x + 4, by - 10, 2, 1, P.red);
  r(x, by - 8, 2, 1, P.brick);
  r(x - 5, by - 6, 10, 2, P.red);
  r(x - 7 - (walking ? Math.abs(stride) : 0), by - 5, 4, 2, P.red);
  const sway = reduced ? 0 : [0, 1, 0, -1][Math.floor(t * (walking ? 5 : 2)) % 4];
  r(x, by - 22, 2, 5, P.grass);
  r(x - 5 + sway, by - 24, 5, 3, P.grass);
  r(x - 4 + sway, by - 25, 3, 2, P.leaf);
  r(x + 2 + sway, by - 26, 5, 3, P.grass);
  r(x + 3 + sway, by - 27, 4, 2, P.leaf);
}

export function drawRoof(ctx, x, y, w, P) {
  const r = pixelBrush(ctx);
  // A curved tile silhouette, upturned corners and carved brackets beneath the eaves.
  r(x + 5, y + 13, w - 10, 5, P.deep);
  const bands = [
    [0, 14, 3, P.water],
    [3, 9, 3, P.water],
    [6, 3, 3, P.teal],
    [9, -3, 3, P.water],
  ];
  for (const [dy, inset, height, color] of bands) {
    r(x + inset, y + dy, w - inset * 2, height, color);
    for (let k = 0; k < w - inset * 2; k += 7) {
      r(x + inset + k, y + dy, 1, height, P.shade);
      if (k + 2 < w - inset * 2) r(x + inset + k + 1, y + dy, 1, 1, P.glass);
    }
  }
  r(x + 14, y - 1, w - 28, 2, P.teal);
  r(x + 15, y - 1, w - 30, 1, P.glass);
  r(x - 6, y + 4, 3, 6, P.teal);
  r(x - 8, y + 2, 3, 3, P.glass);
  r(x + w + 3, y + 4, 3, 6, P.teal);
  r(x + w + 5, y + 2, 3, 3, P.glass);
  r(x - 4, y + 12, w + 8, 2, P.dark);
  r(x - 2, y + 12, w + 4, 1, P.gold);
  for (const bx of [x + 7, x + w - 12]) {
    r(bx, y + 14, 5, 2, P.wood);
    r(bx + 1, y + 16, 3, 2, P.gold);
  }
}

export function drawIsland(ctx, x, y, w, h, P, seed = 0) {
  const r = pixelBrush(ctx);
  // Broken rock faces taper unevenly into the mist instead of forming a box.
  for (let col = 0; col < w; col += 4) {
    const ridge = Math.sin((col / w) * Math.PI);
    const depth = Math.min(h, 8 + ridge * (h - 12) + ((col * 7 + seed * 13) % 11));
    r(x + col, y + 4, Math.min(4, w - col), depth, col < w * 0.38 ? P.shade : P.deep);
    if (col > 8 && col < w - 8 && col % 12 === 0) {
      r(x + col, y + 9, 2, Math.max(2, depth * 0.4), P.stone);
      r(x + col + 2, y + 14, 2, Math.max(2, depth * 0.6 - 9), P.deep);
    }
  }
  r(x, y, w, 3, P.grass);
  r(x + 3, y, w - 6, 1, P.leaf);
  r(x + 4, y + 4, w - 8, 3, P.stone);
  for (let k = 0; k < w - 12; k += 19) {
    const xx = x + 7 + k;
    r(xx, y - 2, 2, 3, P.grass);
    r(xx + 2, y - 1, 3, 1, P.leaf);
    if (k % 3 === 0) {
      r(xx + 3, y + 4, 2, 13, P.grass);
      r(xx + 1, y + 12, 5, 2, P.leaf);
    }
  }
}

export function drawGarden(ctx, x, y, P, seed = 0) {
  const r = pixelBrush(ctx);
  // Small, sparse ground clusters leave the traversal route readable.
  r(x, y - 4, 2, 5, P.grass);
  r(x - 3, y - 2, 3, 2, P.grass);
  r(x + 3, y - 3, 2, 3, P.leaf);
  if (seed % 3 === 0) {
    r(x + 1, y - 7, 1, 5, P.grass);
    r(x, y - 7, 3, 2, P.cream);
    r(x + 1, y - 8, 1, 4, P.gold);
  } else {
    r(x + 6, y - 2, 6, 3, P.shade);
    r(x + 7, y - 3, 4, 2, P.stone);
    r(x + 7, y - 3, 2, 1, P.edge);
  }
}

export function drawRepairSpan(ctx, x, P, { age = 1, reduced = false } = {}) {
  const r = pixelBrush(ctx);
  // Five sleepers rise and settle in sequence, finishing before the car crosses.
  for (let k = 0; k < 5; k++) {
    const p = reduced ? 1 : Math.max(0, Math.min(1, (age - k * 0.025) / 0.12));
    if (p === 0) continue;
    const y = 207 + Math.round((1 - p) * (1 - p) * 19);
    r(x + k * 12, y + 2, 5, 10, P.deep);
    r(x + k * 12, y + 2, 4, 9, P.wood);
    r(x + k * 12, y + 2, 1, 8, P.brick);
    r(x + k * 12, y, Math.min(12, 58 - k * 12), 2, P.edge);
    r(x + k * 12, y + 8, Math.min(12, 58 - k * 12), 2, P.stone);
    r(x + k * 12 + 1, y + 1, 2, 1, P.cream);
    if (!reduced && p > 0.6 && age < 0.7) {
      const lift = Math.max(0, age - k * 0.025 - 0.1) * 27;
      r(x + k * 12 + 2, 204 - lift, 1, 2, P.cream);
    }
  }
}
