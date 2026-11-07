import { drawSkyrail } from './skyrail-world.js';
import {
  drawFloorGauge,
  drawTowerHearts,
  drawDoorCreature,
  drawRestLanding,
} from './tower-details.js';
// One pixel grid and one palette for the map, destinations, sprites and effects.
export const P = {
  sky: '#263f58',
  night: '#19293d',
  far: '#385669',
  cloud: '#66848b',
  mist: '#8fa49a',
  stone: '#647b7c',
  edge: '#a1aaa0',
  shade: '#405b65',
  deep: '#293f4b',
  grass: '#6d947d',
  leaf: '#a1b98a',
  cream: '#f4d8a1',
  gold: '#d7a65c',
  wood: '#9a6853',
  brick: '#ba8060',
  red: '#d77c72',
  water: '#6aabaa',
  teal: '#83c5bc',
  glass: '#b5dbcf',
  dark: '#172b38',
};
export function doorSlots(count = 2) {
  return (
    {
      2: [
        [95, 88, 96, 130],
        [289, 88, 96, 130],
      ],
      3: [
        [51, 103, 86, 115],
        [197, 103, 86, 115],
        [343, 103, 86, 115],
      ],
      4: [
        [214, 37, 52, 59],
        [145, 100, 52, 59],
        [283, 100, 52, 59],
        [214, 162, 52, 59],
      ],
      6: [
        [105, 54, 72, 76],
        [204, 54, 72, 76],
        [303, 54, 72, 76],
        [105, 142, 72, 76],
        [204, 142, 72, 76],
        [303, 142, 72, 76],
      ],
    }[count] || doorSlots(2)
  );
}
export const destinations = {
  tone: { x: 145, y: 207 },
  rail: { x: 335, y: 207 },
};
export function drawWorld(ctx, s) {
  if (s.scene === 'rail') {
    drawSkyrail(ctx, s, P);
    return;
  }
  const hubOffset = s.scene === 'hub' ? Math.max(0, ((s.height || 288) - 288) / 2) : 0;
  if (hubOffset) {
    ctx.save();
    ctx.fillStyle = P.sky;
    ctx.fillRect(0, 0, 480, s.height);
    ctx.translate(0, hubOffset);
  }
  const t = s.time || 0;
  ctx.imageSmoothingEnabled = false;
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const line = (x, y, w, c) => r(x, y, w, 1, c);
  const block = (x, y, w, h, c = P.stone) => {
    r(x, y, w, h, P.dark);
    r(x + 2, y + 2, w - 4, h - 4, c);
    r(x + 2, y + 2, w - 4, 2, P.edge);
    r(x + w - 4, y + 4, 2, h - 6, P.shade);
    for (let yy = 12; yy < h - 4; yy += 10) {
      r(x + 4, y + yy, w - 8, 1, P.shade);
      for (let xx = 8 + (yy % 20 ? 7 : 0); xx < w - 7; xx += 17)
        r(x + xx, y + yy - 5, 1, 5, P.shade);
    }
  };
  const pixCircle = (x, y, rad, c) => {
    for (let yy = -rad; yy <= rad; yy++)
      for (let xx = -rad; xx <= rad; xx++)
        if (xx * xx + yy * yy <= rad * rad) r(x + xx, y + yy, 1, 1, c);
  };
  const cloud = (x, y, w) => {
    r(x + 8, y, w - 16, 4, P.cloud);
    r(x, y + 4, w, 7, P.cloud);
    r(x + 4, y + 11, w - 8, 3, P.cloud);
    line(x + 10, y + 4, w - 20, P.mist);
  };
  const lantern = (x, y, on = true) => {
    r(x, y, 2, 8, P.deep);
    r(x - 3, y + 8, 8, 2, P.dark);
    r(x - 2, y + 10, 6, 8, on ? P.gold : P.shade);
    r(x, y + 11, 2, 5, on ? P.cream : P.stone);
    r(x - 3, y + 18, 8, 2, P.dark);
  };
  function roof(x, y, w) {
    r(x + 10, y, w - 20, 3, P.teal);
    r(x + 6, y + 3, w - 12, 3, P.water);
    r(x + 2, y + 6, w - 4, 3, P.teal);
    r(x - 4, y + 5, 6, 3, P.gold);
    r(x + w - 2, y + 5, 6, 3, P.gold);
    r(x - 6, y + 2, 3, 4, P.teal);
    r(x + w + 3, y + 2, 3, 4, P.teal);
    r(x, y + 9, w, 3, P.dark);
    r(x + 3, y + 12, w - 6, 2, P.gold);
    for (let k = 14; k < w - 10; k += 9) r(x + k, y + 3, 1, 5, P.shade);
  }
  function window(x, y, on) {
    r(x, y, 7, 11, P.deep);
    r(x + 1, y + 1, 5, 8, on ? P.gold : P.sky);
    if (on) r(x + 2, y + 1, 2, 6, P.cream);
    r(x - 1, y + 11, 9, 2, P.edge);
  }
  function cliff(x, y, w, h) {
    r(x + 3, y, w - 6, h, P.deep);
    r(x, y, w, 5, P.grass);
    r(x + 3, y + 5, w - 6, 4, P.stone);
    r(x + 8, y + 9, w - 16, 6, P.shade);
    for (let i = 0; i < w / 18; i++) {
      r(x + 8 + i * 17, y + 16, 3, h - 25, P.shade);
      r(x + 6 + i * 17, y + 16, 2, 12, P.stone);
    }
    r(x + 10, y + h - 7, w - 20, 5, P.deep);
    r(x + 22, y + h - 2, w - 44, 3, P.far);
  }
  function tree(x, y) {
    r(x + 7, y + 9, 3, 18, P.wood);
    r(x + 2, y + 7, 14, 10, P.grass);
    r(x + 5, y + 2, 10, 17, P.grass);
    r(x, y + 10, 18, 5, P.leaf);
    r(x + 7, y, 5, 3, P.leaf);
  }
  function track(x, y, w, offset = 0) {
    r(x, y + 5, w, 9, P.deep);
    for (let i = 0; i < w / 12 + 2; i++) {
      const xx = x + i * 12 - (offset % 12);
      if (xx >= x && xx < x + w) r(xx, y + 3, 5, 12, P.wood);
    }
    r(x, y + 3, w, 2, P.edge);
    r(x, y + 11, w, 2, P.stone);
  }
  function archBridge(x, y, w) {
    r(x, y, w, 4, P.stone);
    r(x, y + 4, w, 3, P.edge);
    for (let i = 0; i < w / 30; i++) {
      let xx = x + i * 30;
      r(xx, y + 7, 6, 27, P.shade);
      r(xx + 6, y + 7, 24, 3, P.shade);
      r(xx + 6, y + 10, 4, 5, P.shade);
      r(xx + 26, y + 10, 4, 5, P.shade);
    }
    line(x, y - 4, w, P.wood);
    for (let i = 0; i < w / 12; i++) r(x + i * 12, y - 7, 2, 7, P.gold);
  }
  function tower(x, y, w, h, lit = 0) {
    const th = (h - 16) / 5;
    for (let tier = 0; tier < 5; tier++) {
      const tw = Math.round(w * (0.66 + tier * 0.085)),
        tx = x + (w - tw) / 2,
        ty = y + 16 + tier * th;
      block(tx, ty, tw, th + 3, tier % 2 ? P.shade : P.stone);
      r(tx + 5, ty + 3, 2, th - 1, P.edge);
      r(tx + tw - 8, ty + 3, 3, th - 1, P.deep);
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 5; col++) {
          const index = (4 - tier) * 20 + (3 - row) * 5 + col,
            wx = tx + 11 + (col * (tw - 22)) / 5,
            wy = ty + 5 + (row * (th - 10)) / 4;
          r(wx, wy, 3, 4, index < lit ? P.cream : P.deep);
          if (index === Math.min(99, lit)) {
            r(wx - 1, wy - 1, 5, 1, P.teal);
            r(wx - 1, wy + 4, 5, 1, P.teal);
          }
        }
      roof(tx - 6, ty + th - 11, tw + 12);
      for (let j = 0; j < 5; j++) r(tx + (j * tw) / 4, ty + th - 7, 2, 4, P.stone);
      if (tier === 1 || tier === 3) {
        r(tx - 6, ty + th - 8, 9, 5, P.grass);
        r(tx - 8, ty + th - 6, 2, 14, P.grass);
        r(tx + tw - 4, ty + th - 8, 9, 5, P.grass);
        r(tx + tw + 2, ty + th - 5, 2, 12, P.leaf);
      }
    }
    const topw = Math.round(w * 0.66),
      topx = x + (w - topw) / 2;
    roof(topx - 5, y + 7, topw + 10);
    r(x + w / 2 - 12, y - 1, 24, 8, P.stone);
    r(x + w / 2 - 8, y - 5, 16, 4, P.edge);
    r(x + w / 2 - 3, y - 14, 6, 9, lit === 100 ? P.cream : P.teal);
    r(x + w / 2 - 1, y - 21, 2, 7, P.gold);
    r(x + w * 0.84, y + h * 0.48, 2, h * 0.3, P.wood);
    for (let k = 0; k < 8; k++) r(x + w * 0.84, y + h * 0.48 + k * 5, 6, 1, P.gold);
    r(x + w / 2 - 8, y + h - 13, 16, 15, P.deep);
    r(x + w / 2 - 5, y + h - 10, 10, 12, P.gold);
  }
  function house(x, y, w, h) {
    block(x, y + 12, w, h - 12, P.brick);
    roof(x - 5, y, w + 10);
    r(x + w / 2 - 7, y + h - 24, 14, 24, P.deep);
    r(x + w / 2 - 5, y + h - 22, 10, 21, P.wood);
    r(x + w / 2 + 2, y + h - 12, 2, 2, P.gold);
    window(x + 7, y + 19, true);
    window(x + w - 14, y + 19, true);
  }
  function station(x, y, scale = 1) {
    block(x, y + 15, 94, 49, P.stone);
    roof(x - 8, y, 110);
    r(x + 29, y + 31, 32, 33, P.deep);
    r(x + 32, y + 34, 26, 30, P.wood);
    r(x + 35, y + 37, 20, 27, P.deep);
    r(x + 38, y + 43, 14, 21, P.gold);
    window(x + 10, y + 28, true);
    window(x + 75, y + 28, true);
    const bx = x + 68 + (!s.reduced && s.walking ? Math.floor(t * 5) % 2 : 0);
    r(bx, y + 15, 1, 8, P.wood);
    r(bx - 3, y + 22, 7, 5, P.gold);
    r(bx - 5, y + 27, 11, 2, P.cream);
    r(bx, y + 29, 1, 2, P.deep);
    r(x - 10, y + 64, 116, 6, P.edge);
    r(x - 10, y + 70, 116, 3, P.shade);
    pixCircle(x + 45, y + 22, 7, P.dark);
    pixCircle(x + 45, y + 22, 5, P.cream);
    r(x + 45, y + 19, 1, 4, P.deep);
    r(x + 43, y + 22, 3, 1, P.deep);
    r(x - 8, y + 20, 2, 44, P.wood);
    lantern(x - 8, y + 19);
    r(x + 97, y - 15, 2, 76, P.wood);
    r(x + 99, y - 13, 16, 4, P.red);
    r(x + 99, y - 9, 10 + Math.round(Math.sin(t * 2) * 3), 3, P.cream);
  }
  function cart(x, y, moving = false) {
    r(x - 25, y - 34, 50, 3, P.deep);
    r(x - 28, y - 31, 56, 4, P.gold);
    r(x - 22, y - 27, 44, 24, P.teal);
    r(x - 20, y - 25, 40, 2, P.glass);
    r(x - 18, y - 22, 14, 14, P.sky);
    r(x + 4, y - 22, 14, 14, P.sky);
    r(x - 15, y - 20, 3, 10, P.glass);
    r(x + 7, y - 20, 3, 10, P.glass);
    r(x - 25, y - 5, 50, 6, P.gold);
    r(x - 28, y + 1, 56, 3, P.deep);
    for (const xx of [x - 16, x + 16]) {
      pixCircle(xx, y + 6, 6, P.deep);
      pixCircle(xx, y + 6, 4, P.stone);
      const phase = moving ? Math.floor(t * 12) % 4 : 0;
      r(
        xx + (phase % 2 ? 0 : -3),
        y + 6 + (phase % 2 ? -3 : 0),
        phase % 2 ? 1 : 7,
        phase % 2 ? 7 : 1,
        P.edge,
      );
    }
    r(x + 27, y - 15, 4, 6, P.cream);
    r(x - 27, y - 15, 3, 6, P.red);
  }
  function sprite(x, y, walking = false) {
    const step = walking ? Math.floor(t * 10) % 2 : 0;
    r(x - 4, y - 13, 8, 10, P.gold);
    r(x - 6, y - 11, 12, 6, P.cream);
    r(x - 3, y - 9, 1, 2, P.dark);
    r(x + 3, y - 9, 1, 2, P.dark);
    r(x - 2, y - 5, 4, 1, P.brick);
    r(x - 4, y - 2, 8, 5, P.wood);
    r(x - 4 - step, y + 3, 3, 2, P.deep);
    r(x + 2 + step, y + 3, 3, 2, P.deep);
    r(x, y - 17, 2, 4, P.grass);
    r(x - 4, y - 20, 5, 4, P.leaf);
    r(x + 2, y - 22, 5, 4, P.leaf);
  }
  r(0, 0, 480, 288, P.sky);
  r(0, 190, 480, 98 + hubOffset, P.far);
  const moonX = 410;
  pixCircle(moonX, 39, 14, P.mist);
  pixCircle(moonX + 7, 34, 13, P.sky);
  for (let i = 0; i < 29; i++) {
    const x = (i * 67 + 19) % 480,
      y = 12 + ((i * 23) % 125);
    r(x, y, 1, 1, i % 3 === 0 ? P.cloud : P.mist);
  }
  // Distant islands and cloud layers share the same stepped silhouette.
  for (let i = 0; i < 6; i++) {
    let x = i * 95 - 20;
    r(x, 112 + (i % 2) * 18, 58, 3, P.cloud);
    r(x + 6, 115 + (i % 2) * 18, 46, 9, P.far);
    r(x + 15, 124 + (i % 2) * 18, 27, 18, P.far);
    r(x + 27, 142 + (i % 2) * 18, 6, 7, P.far);
  }
  cloud(13 + (s.reduced ? 0 : Math.sin(t * 0.09) * 5), 72, 62);
  cloud(204 + (s.reduced ? 0 : Math.sin(t * 0.06) * 8), 42, 57);
  cloud(356, 118, 74);
  cloud(-12, 228, 106);
  cloud(322, 246, 112);
  if (s.scene === 'hub') {
    cliff(54, 207, 168, 67);
    cliff(268, 207, 162, 67);
    archBridge(214, 212, 63);
    r(68, 207, 344, 5, P.gold);
    r(73, 208, 334, 1, P.cream);
    r(133, 207, 25, 13, P.gold);
    r(338, 209, 22, 12, P.gold);
    tower(94, 30, 102, 177, s.progress);
    r(132, 184, 26, 23, P.deep);
    r(136, 186, 18, 21, P.wood);
    r(142, 188, 6, 19, P.gold);

    ctx.save();
    ctx.translate(274, 112);
    ctx.scale(1.3, 1.3);
    station(0, 0);
    ctx.restore();
    track(264, 211, 216, s.travel > 0 ? t * 12 : 0);
    cart(398, 208, s.travel > 0);

    tree(32, 185);
    tree(66, 181);
    tree(204, 182);
    tree(268, 182);
    tree(438, 181);
    tree(456, 185);
    for (const x of [225, 258]) {
      r(x, 173, 2, 43, P.wood);
      lantern(x, 172);
      r(x - 5, 190, 11, 2, P.gold);
    }
    for (let i = 0; i < 4; i++) {
      r(274 + i * 3, 225, 2, 36, P.water);
      r(275 + i * 3, 229 + ((t * 9 + i * 3) % 15), 1, 6, P.glass);
    }
    for (let i = 0; i < 7; i++) {
      const x = 35 + i * 68,
        y = 54 + (i % 3) * 14 - (s.reduced ? 0 : Math.sin(t * 0.5 + i) * 3);
      r(x, y, 1, 5, P.wood);
      r(x - 3, y + 5, 7, 8, P.gold);
      r(x - 1, y + 6, 3, 5, P.cream);
      r(x, y + 13, 1, 4, P.red);
    }
    sprite(s.actor.x, s.actor.y, s.walking);
  } else if (s.scene === 'tower-entry') {
    cliff(126, 261, 228, 64);
    tower(186, 35, 108, 202, s.progress);
    archBridge(0, 265, 133);
    archBridge(347, 265, 133);
    tree(150, 236);
    tree(316, 237);
    // One grand entrance, with two leaves belonging to the same doorway.
    block(200, 181, 80, 80, P.wood);
    roof(190, 167, 100);
    r(208, 188, 64, 73, P.dark);
    r(216, 193, 48, 68, P.gold);
    r(224, 198, 32, 63, P.cream);
    const entry = Math.min(1, s.entry || 0),
      opening = Math.max(0, Math.min(1, (entry - 0.18) / 0.5));
    const leaf = 32 * (1 - opening);
    r(208, 188, leaf, 73, P.wood);
    r(272 - leaf, 188, leaf, 73, P.wood);
    if (leaf > 5) {
      for (let row = 0; row < 5; row++)
        for (const col of [5, 16, 27]) {
          r(208 + (col * leaf) / 32, 196 + row * 12, 2, 2, P.gold);
          r(272 - leaf + (col * leaf) / 32, 196 + row * 12, 2, 2, P.gold);
        }
      r(208 + leaf - 5, 218, 3, 7, P.gold);
      r(274 - leaf, 218, 3, 7, P.gold);
    }
    r(194, 259, 92, 4, P.edge);
    r(184, 263, 112, 4, P.stone);
    r(175, 267, 130, 4, P.shade);
    lantern(191, 201);
    lantern(287, 201);
    sprite(240, 285 - entry * 41, entry < 1);
  } else if (s.scene === 'tower-rest') {
    drawRestLanding(ctx, s, P, sprite);
  } else if (s.scene === 'tone') {
    // Each landing belongs to the same tower, with the isles visible farther below.
    const level = Math.max(0, Math.min(4, Math.floor((s.floor ?? s.progress ?? 0) / 20))),
      accent = [P.grass, P.water, P.gold, P.leaf, '#b4b2dc'][level];
    r(0, 0, 480, 240, P.deep);
    r(18, 18, 444, 210, P.shade);
    for (let row = 0; row < 12; row++)
      for (let col = 0; col < 17; col++) {
        r(20 + col * 27 - (row % 2) * 13, 22 + row * 16, 25, 14, row % 3 === 0 ? P.shade : P.deep);
      }
    r(0, 0, 480, 13, P.stone);
    r(0, 13, 480, 3, P.edge);
    r(18, 18, 12, 207, P.stone);
    r(450, 18, 12, 207, P.stone);
    r(30, 18, 420, 4, P.shade);
    r(0, 224, 480, 16, P.stone);
    r(0, 224, 480, 3, P.edge);
    for (let i = 0; i < 17; i++) r(i * 30, 228, 1, 12, P.shade);
    drawFloorGauge(ctx, s, P);
    for (const x of [34, 429]) {
      r(x - 2, 98, 21, 85, P.stone);
      r(x, 100, 17, 79, P.sky);
      for (let n = 0; n < 3; n++) {
        const yy = 110 + ((n * 31 + (s.towerCamera || 0) * 0.08) % 65);
        r(x, yy, 17, 2, P.cloud);
        r(x + 3, yy + 2, 11, 6, P.far);
      }
      r(x + 7, 100, 2, 79, P.wood);
      r(x, 139, 17, 2, P.wood);
      r(x - 3, 179, 23, 4, P.edge);
    }
    for (const x of [49, 412]) {
      r(x, 27, 19, 43, accent);
      r(x + 4, 28, 3, 35, P.edge);
      r(x - 3, 24, 25, 3, P.gold);
      r(x + 7, 38, 6, 2, P.cream);
      r(x + 9, 34, 2, 10, P.cream);
    }
    lantern(43, 77, s.lives !== 0);
    lantern(437, 77, s.lives !== 0);
    if (level === 0 || level === 3) {
      for (const x of [31, 442])
        for (let k = 0; k < 5; k++) {
          r(x, 41 + k * 15, 2, 18, P.grass);
          r(x + (k % 2 ? -4 : 2), 47 + k * 15, 5, 3, P.leaf);
        }
      if (level === 3) {
        for (const x of [73, 399]) {
          r(x, 205, 10, 15, P.brick);
          r(x + 4, 180, 2, 26, P.grass);
          for (let k = 0; k < 3; k++) {
            r(x - 3, 184 + k * 7, 8, 3, P.leaf);
            r(x + 5, 181 + k * 7, 8, 3, P.grass);
          }
        }
      }
    }
    if (level === 1) {
      for (const x of [36, 431])
        for (let k = 0; k < 5; k++)
          r(x + (k % 2) * 9, 104 + ((k * 17 + (s.reduced ? 0 : t * 19)) % 65), 1, 7, P.glass);
      for (const x of [33, 429]) {
        r(x, 211, 18, 3, P.water);
        r(x + 3, 209, 12, 1, P.glass);
      }
    }
    if (level === 2) {
      for (const x of [36, 434]) {
        r(x, 190, 11, 17, P.wood);
        r(x - 4, 186, 19, 4, P.gold);
        r(x + 4, 171, 3, 15, P.edge);
        const step = s.reduced ? 0 : Math.floor(t * 3) % 2;
        r(x - 2 + step * 3, 172, 15 - step * 6, 3, P.gold);
        r(x + 3, 168 + step * 3, 3, 13 - step * 6, P.gold);
      }
    }
    if (level === 4) {
      for (const x of [37, 434]) {
        r(x, 197, 3, 23, P.wood);
        r(x - 6, 204, 15, 3, P.gold);
        r(x - 6, 182, 15, 6, accent);
        r(x - 10, 178, 7, 7, P.gold);
      }
      for (let k = 0; k < 7; k++) {
        const x = 85 + k * 51;
        r(x, 27 + (k % 2) * 6, 2, 2, P.cream);
        r(x + 1, 25 + (k % 2) * 6, 1, 6, accent);
      }
    }
    drawTowerHearts(ctx, s, P);
    const slots = doorSlots(s.count),
      active = s.selected ?? -1,
      open = s.open || 0;
    if (s.count >= 4) {
      const levels = [...new Set(slots.map((v) => v[1] + v[3] + 5))].filter((v) => v < 221);
      for (const yy of levels) {
        r(78, yy, 324, 3, P.stone);
        r(78, yy + 3, 324, 2, P.shade);
      }
      for (let n = 0; n < 12; n++) {
        r(52 + n * 5, 225 - n * 11, 13, 3, P.stone);
        r(52 + n * 5, 228 - n * 11, 13, 2, P.shade);
      }
    }
    for (let i = 0; i < slots.length; i++) {
      const [x, y, w, h] = slots[i],
        selected = i === active,
        success = selected && s.result === 'success',
        bad = selected && s.result === 'wrong',
        solution = s.result === 'wrong' && i === s.answer;
      block(x - 5, y - 4, w + 10, h + 5);
      roof(x - 5, y - 17, w + 10);
      r(x + 5, y + 3, w - 10, h - 7, success ? '#315e46' : bad ? '#492e38' : P.dark);
      if (success) {
        r(x + 9, y + 7, w - 18, h - 15, '#4f8860');
        r(x + 15, y + 12, w - 30, h - 25, '#a1b98a');
      }
      if (bad && open > 0.3 && !(s.ending === 'lost' && (s.elapsed || 0) > 1.4))
        drawDoorCreature(ctx, { x, y, w, h, elapsed: s.elapsed, reduced: s.reduced }, P);
      const leaf = Math.max(0, 1 - (selected ? open : 0));
      r(x + 8, y + 5, (w - 16) * leaf, h - 11, solution ? P.cream : P.wood);
      r(x + 11, y + 8, Math.max(0, (w - 22) * leaf), 2, P.brick);
      for (let k = 0; k < 3; k++)
        if (15 + (k * (w - 28)) / 3 < (w - 8) * leaf)
          r(x + 15 + (k * (w - 28)) / 3, y + 10, 1, h - 20, P.deep);
      if (leaf > 0.4) r(x + (w - 18) * leaf, y + h * 0.65, 3, 5, P.gold);
      r(x - 7, y + h, w + 14, 3, success ? P.leaf : P.edge);
      r(x - 5, y + h + 3, w + 10, 2, P.deep);
      if (success || solution) {
        r(x - 5, y - 4, 3, h + 8, solution ? P.cream : P.grass);
        r(x + w + 2, y - 4, 3, h + 8, solution ? P.cream : P.grass);
        if (solution) r(x - 5, y - 4, w + 10, 3, P.cream);
      }
    }
    tree(43, 195);
    tree(419, 195);
    const start = { x: 240, y: 231 },
      slot = slots[Math.max(0, active)];
    const walk = s.walk || 0;
    const target = { x: slot[0] + slot[2] / 2, y: slot[1] + slot[3] - 8 };
    let ax = start.x + (target.x - start.x) * walk,
      ay = start.y + (target.y - start.y) * walk;
    if (s.count >= 4 && target.y < 180) {
      const points = [start, { x: 57, y: 231 }, { x: 112, y: target.y }, target];
      const lengths = points
        .slice(1)
        .map((v, i) => Math.hypot(v.x - points[i].x, v.y - points[i].y));
      let distance = walk * lengths.reduce((a, b) => a + b, 0);
      for (let i = 0; i < lengths.length; i++) {
        if (distance <= lengths[i]) {
          const f = lengths[i] ? distance / lengths[i] : 1;
          ax = points[i].x + (points[i + 1].x - points[i].x) * f;
          ay = points[i].y + (points[i + 1].y - points[i].y) * f;
          break;
        }
        distance -= lengths[i];
      }
    }
    if (!(s.result === 'success' && walk > 0.95)) {
      sprite(
        ax +
          (!s.reduced && s.result === 'wrong'
            ? (s.hit || 0) * Math.sin((s.elapsed || 0) * 45) * 5
            : 0),
        ay,
        walk > 0 && walk < 1,
      );
    }
    if (s.ending === 'lost') {
      const age = s.reduced ? 3 : s.elapsed || 0,
        fade = Math.min(0.62, Math.max(0, (age - 0.7) * 0.35));
      r(30, 18, 420, 206, 'rgba(23,43,56,' + fade + ')');
      if (age > 0.9) {
        const sit = Math.min(1, Math.max(0, (age - 1.1) / 0.6)),
          sy = 230 + sit * 3;
        r(236, sy - 13, 8, 9, P.gold);
        r(234, sy - 11, 12, 6, P.cream);
        r(237, sy - 8, 2, 1, P.dark);
        r(242, sy - 8, 2, 1, P.dark);
        r(236, sy - 4, 8, 4, P.wood);
        r(233, sy, 6, 2, P.dark);
        r(241, sy, 6, 2, P.dark);
        r(240, sy - 17, 2, 4, P.grass);
        r(236, sy - 20, 5, 4, P.leaf);
        r(242, sy - 21, 5, 4, P.leaf);
        const ly = 208 - Math.min(26, (age - 0.9) * 14);
        r(232, ly - 14, 18, 23, 'rgba(215,166,92,.12)');
        lantern(240, ly - 23, true);
        if (age > 1.4) {
          const p = Math.min(1, (age - 1.4) / 1.5),
            sx = target.x + (265 - target.x) * p;
          drawDoorCreature(
            ctx,
            { x: sx - 10, y: 205, w: 20, h: 23, elapsed: age, reduced: s.reduced },
            P,
          );
        }
        for (let k = 0; k < 7; k++)
          r(
            231 + Math.sin(age + k) * 18,
            222 - ((age * 9 + k * 12) % 65),
            2,
            2,
            k % 2 ? P.gold : P.leaf,
          );
      }
    }
  }
  // Subtle ambient specks, all constrained to the same pixel grid.
  if (!s.reduced)
    for (let i = 0; i < 5; i++) {
      const x = 24 + i * 101,
        y = 198 + Math.floor(Math.sin(t * 0.8 + i) * 12);
      r(x, y, 1, 1, P.cream);
    }
  if (hubOffset) ctx.restore();
}
