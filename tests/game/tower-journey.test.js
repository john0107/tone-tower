import test from 'node:test';
import assert from 'node:assert/strict';
import { createTowerJourney, TOWER_FLOOR_HEIGHT as H } from '../../src/world/tower-journey.js';

test('a cleared door stays in its room until the next recording, then the camera climbs once', () => {
  const j = createTowerJourney();
  j.update({ phase: 'answering', progress: 0, count: 2 });
  j.update({ phase: 'correct', progress: 1, selected: 1, count: 2 });
  assert.equal(j.tick(2).camera, 0);
  j.update({ phase: 'listening', progress: 1, count: 2 });
  const mid = j.tick(0.3);
  assert.ok(mid.camera > 0 && mid.camera < H);
  assert.equal(mid.offset, mid.camera - H);
  assert.equal(mid.previous.selected, 1);
  assert.equal(mid.previous.walk, 1);
  j.update({ phase: 'answering', progress: 1, count: 2 });
  const end = j.tick(1);
  assert.equal(end.camera, H);
  assert.equal(end.offset, 0);
  assert.equal(end.previous, null);
  assert.equal(j.tick(5).camera, H);
});

test('mistakes, replays and replacement recordings never create another floor', () => {
  const j = createTowerJourney(35);
  for (const phase of ['listening', 'answering', 'review', 'listening', 'answering']) {
    j.update({ phase, progress: 35 });
    assert.equal(j.tick(2).camera, 35 * H);
  }
});

test('district checkpoints preserve the departing door layout and freeze when paused', () => {
  const j = createTowerJourney(19);
  j.update({ phase: 'answering', progress: 19, count: 2 });
  j.update({ phase: 'landing', progress: 20, count: 2, selected: 0 });
  assert.equal(j.tick(5).camera, 19 * H);
  j.update({ phase: 'listening', progress: 20, count: 3 });
  const mid = j.tick(0.25);
  assert.equal(mid.previous.count, 2);
  assert.equal(mid.previous.scene, 'tower-rest');
  assert.equal(mid.previous.progress, 20);
  assert.equal(mid.previous.restTime, 99);
  assert.equal(j.tick(20, { paused: true }).camera, mid.camera);
  const end = j.tick(0, { reduced: true });
  assert.equal(end.camera, 20 * H);
  assert.equal(end.previous, null);
});

test('rehearsals start at the right height and the summit stays within the tower', () => {
  const j = createTowerJourney(80);
  j.update({ phase: 'listening', progress: 80 });
  assert.equal(j.tick(0).camera, 80 * H);
  j.update({ phase: 'listening', progress: 100 });
  assert.equal(j.tick(1).camera, 99 * H);
  j.update({ phase: 'answering', progress: 101 });
  assert.equal(j.tick(1).camera, 99 * H);
});

test('earned progress on the final answering tick never outruns the prompt room', () => {
  const j = createTowerJourney();
  j.update({ phase: 'answering', progress: 0, floor: 0 });
  j.update({ phase: 'answering', progress: 1, floor: 0 });
  assert.equal(j.tick(0.2).camera, 0);
  j.update({ phase: 'correct', progress: 1, floor: 0 });
  assert.equal(j.tick(1.7).camera, 0);
  j.update({ phase: 'listening', progress: 1, floor: 1 });
  assert.ok(j.tick(0.2).camera > 0);
});
