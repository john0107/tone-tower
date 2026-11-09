import { drawGlow, drawSprout, drawRoof } from './pixel-art.js';
// A persistent epilogue in the same scene: the world lights up around the traveller.
export function drawFinale(ctx, s, P) {
  const t = s.reduced ? 12 : Math.max(0, s.elapsed || 0),
    rail = s.scene === 'rail',
    W = 480,
    H = 240;
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.max(0, Math.round(w)),
      Math.max(0, Math.round(h)),
    );
  };
  const disc = (x, y, rad, c) => {
    for (let yy = -rad; yy <= rad; yy++)
      r(
        x - Math.sqrt(Math.max(0, rad * rad - yy * yy)),
        y + yy,
        Math.sqrt(Math.max(0, rad * rad - yy * yy)) * 2 + 1,
        1,
        c,
      );
  };
  const roof = (x, y, w) => drawRoof(ctx, x, y, w, P);
  const lantern = (x, y, small = false) => {
    const a = small ? 2 : 3;
    if (!small) drawGlow(ctx, x, y, P);
    r(x - a, y - a, 2 * a + 1, 2 * a + 3, P.gold);
    r(x - 1, y - a + 1, 2, 2 * a, P.cream);
    r(x, y + a + 3, 1, 3, P.red);
  };
  const person = (x, y) =>
    drawSprout(ctx, x, y - 2, P, {
      time: t,
      reduced: s.reduced,
      walking: rail && t >= 2.7 && t < 5.1,
    });
  r(0, 0, W, H, '#1b2945');
  r(0, 118, W, 122, '#354661');
  disc(238, 65, 44, '#33475c');
  disc(238, 65, 34, '#617580');
  disc(238, 65, 29, '#dfd3a5');
  disc(231, 59, 5, '#cfca9e');
  for (let i = 0; i < 43; i++)
    r((i * 73 + 19) % 480, 8 + ((i * 31) % 131), 1, 1, i % 3 ? P.mist : P.cream);
  for (let i = 0; i < 8; i++) {
    const x = i * 75 - 30,
      y = 141 + (i % 3) * 13;
    r(x, y, 69, 3, P.cloud);
    r(x + 9, y + 3, 51, 17, P.far);
    r(x + 23, y + 20, 23, 17, P.deep);
    roof(x + 20, y - 17, 28);
    r(x + 24, y - 5, 20, 6, P.shade);
  }
  if (rail) {
    // Moon-gate terminus: the car glides in, brakes, and the explorer disembarks.
    r(285, 133, 155, 75, P.shade);
    r(295, 141, 135, 67, P.wood);
    roof(271, 115, 183);
    roof(307, 96, 111);
    r(334, 145, 55, 63, P.deep);
    r(340, 150, 43, 58, t > 4 ? P.gold : P.shade);
    r(348, 157, 27, 51, t > 4 ? P.cream : P.dark);
    for (const x of [304, 408]) {
      r(x, 151, 15, 31, P.gold);
      r(x + 6, 151, 2, 31, P.wood);
      r(x, 165, 15, 2, P.wood);
    }
    lantern(289, 146);
    lantern(434, 146);
    r(0, 208, 480, 5, P.edge);
    r(0, 216, 480, 3, P.gold);
    for (let x = 0; x < 480; x += 13) r(x, 211, 4, 12, P.wood);
    const p = Math.min(1, t / 2.6),
      ease = 1 - Math.pow(1 - p, 3),
      x = -58 + ease * 249,
      y = 199;
    r(x - 39, y - 34, 78, 4, P.gold);
    roof(x - 37, y - 44, 74);
    r(x - 34, y - 29, 68, 28, P.water);
    r(x - 29, y - 26, 58, 2, P.glass);
    for (const wx of [-22, 0, 22]) {
      r(x + wx - 7, y - 22, 14, 12, P.sky);
      r(x + wx - 5, y - 21, 3, 9, P.glass);
    }
    r(x - 39, y - 3, 78, 6, P.gold);
    for (const wx of [-24, 24]) {
      disc(x + wx, y + 8, 6, P.dark);
      disc(x + wx, y + 8, 3, P.gold);
    }
    if (t < 2.7) person(x, y - 7);
    else {
      const walk = Math.min(1, (t - 2.7) / 2.4);
      person(x + walk * 157, 208 - Math.sin(walk * Math.PI) * 3);
    }
    for (let k = 0; k < 4; k++) {
      const age = (t * 9 + k * 9) % 38;
      r(x - 42 - age, y - 31 - age * 0.6, 6, 3, P.cloud);
    }
  } else {
    // The summit's five rooflines illuminate upwards, then release their lanterns.
    for (let tier = 0; tier < 5; tier++) {
      const w = 138 - tier * 17,
        x = 240 - w / 2,
        y = 180 - tier * 29;
      r(x, y, w, 31, P.shade);
      r(x + 4, y + 3, w - 8, 25, P.stone);
      roof(x - 8, y - 8, w + 16);
      for (let k = 0; k < 7; k++) {
        const lit = t > 1 + tier * 0.38 + k * 0.07;
        r(x + 12 + (k * (w - 25)) / 7, y + 9, 4, 9, lit ? P.cream : P.deep);
      }
    }
    r(234, 27, 12, 18, P.gold);
    r(239, 17, 2, 10, P.cream);
    r(134, 211, 212, 5, P.edge);
    r(144, 216, 192, 24, P.deep);
    for (let x = 145; x < 340; x += 19) r(x, 219, 3, 21, P.stone);
    for (const x of [153, 325]) {
      r(x, 185, 3, 28, P.wood);
      lantern(x + 1, 182);
    }
    person(240, 213);
  }
  // Clouds part below the landing, while lanterns carry its colours into the night.
  for (let i = 0; i < 10; i++) {
    const x = i * 58 - 35 + (s.reduced ? 0 : Math.sin(t * 0.18 + i) * 8),
      y = 226 + (i % 3) * 5;
    r(x + 7, y, 47, 4, P.cloud);
    r(x, y + 4, 61, 8, P.cloud);
    r(x + 4, y + 12, 53, 4, P.mist);
  }
  for (let i = 0; i < 17; i++) {
    const age = Math.max(0, t - 2 - i * 0.11),
      x = 29 + i * 27 + (s.reduced ? 0 : Math.sin(t * 0.5 + i) * 5),
      y = 205 - ((age * (7 + (i % 3)) + i * 17) % 182);
    if (t > 2 || s.reduced) lantern(x, y, true);
  }
  // Slow expanding constellations rather than flashing bursts.
  if (t > 3 && !s.reduced)
    for (let i = 0; i < 3; i++) {
      const age = (t - 3 + i * 1.7) % 6;
      if (age > 2.6) continue;
      const cx = 78 + i * 161,
        cy = 54 + (i % 2) * 29,
        rad = age * 13;
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        r(
          cx + Math.cos(a) * rad,
          cy + Math.sin(a) * rad + age * age * 2,
          2,
          2,
          k % 2 ? P.gold : P.teal,
        );
      }
    }
}
