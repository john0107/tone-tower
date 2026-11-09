import test from 'node:test';
import assert from 'node:assert/strict';
import { createRailJourney, RAIL_SPAN } from '../../src/world/rail-journey.js';

test('the camera follows one route through rapid word handoffs, without rewinding', () => {
  const j = createRailJourney();
  j.update({ phase: 'listening', progress: 0 });
  j.update({ phase: 'answering', progress: 0 });
  const approaching = j.tick(1, { approach: 0.6 });
  assert.equal(approaching.camera, 0);
  j.update({ phase: 'correct', progress: 1 });
  const crossing = j.tick(0.18);
  assert.ok(crossing.camera > approaching.camera);
  assert.ok(crossing.camera < RAIL_SPAN);
  assert.ok(crossing.repaired.has(0));
  j.update({ phase: 'listening', progress: 1 });
  const handoff = j.tick(0.1);
  assert.equal(handoff.segment, 1);
  assert.ok(handoff.camera > crossing.camera);
  assert.ok(handoff.celebration > 0);
  j.update({ phase: 'listening', progress: 1 });
  assert.equal(j.segment, 1);
  j.update({ phase: 'answering', progress: 1 });
  const second = j.tick(0.1, { approach: 0 });
  assert.ok(second.camera >= handoff.camera);
  assert.ok(second.repaired.has(0));
});

test('a missed span stays behind, and rescue continues forward with no second progress award', () => {
  const j = createRailJourney(19);
  j.update({ phase: 'answering', progress: 19 });
  j.tick(1, { approach: 1 });
  j.update({ phase: 'review', reason: 'timeout', progress: 19 });
  const fallen = j.tick(1, { approach: 1 });
  j.update({ phase: 'listening', progress: 19 });
  const rescue = j.tick(0.1);
  assert.equal(rescue.segment, 20);
  assert.equal(rescue.progress, 19);
  assert.ok(rescue.failed.has(19));
  assert.ok(!rescue.repaired.has(19));
  assert.ok(rescue.rescue > 0);
  assert.ok(rescue.camera > fallen.camera);
  j.update({ phase: 'answering', progress: 19 });
  j.update({ phase: 'correct', progress: 20 });
  assert.ok(j.tick(0).repaired.has(20));
});

test('pause freezes travel and effects; reduced motion settles without an animated crossing', () => {
  const j = createRailJourney();
  j.update({ phase: 'answering', progress: 0 });
  j.tick(1, { approach: 1 });
  j.update({ phase: 'correct', progress: 1 });
  const before = j.tick(0),
    paused = j.tick(30, { paused: true });
  assert.equal(paused.camera, before.camera);
  assert.equal(paused.celebration, before.celebration);
  assert.equal(j.tick(0, { reduced: true }).camera, RAIL_SPAN);
});

test('checkpoints advance once and long journeys keep bounded repair history', () => {
  const j = createRailJourney(19);
  j.update({ phase: 'answering', progress: 19 });
  j.update({ phase: 'landing', progress: 20 });
  j.update({ phase: 'landing', progress: 20 });
  assert.equal(j.segment, 19);
  assert.ok(j.tick(0).repaired.has(19));
  j.update({ phase: 'listening', progress: 20 });
  assert.equal(j.segment, 20);
  for (let n = 20; n < 400; n++) {
    j.update({ phase: 'answering', progress: n });
    j.update({ phase: 'correct', progress: n + 1 });
    j.tick(0.18);
    j.update({ phase: 'listening', progress: n + 1 });
    j.tick(0.2);
  }
  const end = j.tick(0);
  assert.equal(end.segment, 400);
  assert.ok(end.camera > 399 * RAIL_SPAN);
  assert.ok(end.repaired.size <= 16);
});

test('timeout coasts to the unsupported edge before gravity begins', () => {
  const j = createRailJourney();
  j.update({ phase: 'answering', progress: 0 });
  j.tick(1, { approach: 1 });
  j.update({ phase: 'review', reason: 'timeout', progress: 0 });
  const early = j.tick(0.3, { approach: 1 });
  assert.equal(early.fall, 0);
  assert.ok(early.camera > 0);
  assert.ok(270 - early.camera > 144);
  const edge = j.tick(0.25, { approach: 1 });
  assert.equal(edge.fall, 0);
  assert.ok(270 - edge.camera < 144);
  const falling = j.tick(0.2, { approach: 1 });
  assert.ok(falling.fall > 0);
  assert.equal(falling.camera, edge.camera);
});

test('the district station persists in world space when departure starts', () => {
  const j = createRailJourney(19);
  j.update({ phase: 'answering', progress: 19 });
  j.update({ phase: 'landing', progress: 20 });
  const arrival = j.tick(2);
  assert.equal(arrival.station, 20 * RAIL_SPAN + 65);
  j.update({ phase: 'listening', progress: 20 });
  const departure = j.tick(0.2);
  assert.equal(departure.station, arrival.station);
  assert.ok(departure.camera >= arrival.camera);
});

test('every upgraded car keeps support until its rear wheel reaches the gap', () => {
  for (let level = 0; level < 5; level++) {
    const progress = level * 20,
      j = createRailJourney(progress);
    j.update({ phase: 'answering', progress });
    j.tick(1, { approach: 1 });
    j.update({ phase: 'review', reason: 'timeout', progress });
    const coast = j.tick(0.55, { approach: 1 }),
      gap = progress * RAIL_SPAN + 270 - coast.camera,
      rearWheel = 160 - (26 + level * 3) + 10;
    assert.equal(coast.fall, 0);
    assert.ok(gap < rearWheel);
    assert.ok(j.tick(0.05, { approach: 1 }).fall > 0);
  }
});

test('the camera stays fixed throughout the countdown, including after a crossing', () => {
  for (const start of [0, 19, 40, 80]) {
    const j = createRailJourney(start);
    j.update({ phase: 'answering', progress: start });
    const before = j.camera;
    for (let tick = 0; tick <= 120; tick++) {
      assert.equal(j.tick(0.125, { approach: tick / 120 }).camera, before);
    }
    j.update({ phase: 'correct', progress: start + 1 });
    assert.ok(j.tick(0.4).camera > before);
    j.tick(0.5);
    j.update({ phase: 'listening', progress: start + 1 });
    j.tick(0.1);
    j.update({ phase: 'answering', progress: start + 1 });
    const parked = j.camera;
    assert.equal(j.tick(15, { approach: 1 }).camera, parked);
    assert.equal(j.tick(15, { approach: 1, reduced: true }).camera, parked);
  }
});
