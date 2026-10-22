import test from 'node:test';
import assert from 'node:assert/strict';
import { getCameraFitDistance } from '../src/forge3d/camera-fit.js';

test('camera fit retains landscape framing but fits both axes in portrait viewports', () => {
  const radius = 44, fov = 45, padding = 1.15;
  const landscape = getCameraFitDistance(radius, fov, 16 / 9);
  const square = getCameraFitDistance(radius, fov, 1);
  const portrait = getCameraFitDistance(radius, fov, 396 / 746);
  assert.equal(landscape, square);
  assert.equal(landscape, radius / Math.sin(fov * Math.PI / 360) * padding);
  assert.ok(portrait > landscape * 1.7, 'narrow editor viewport needs additional camera distance');
  for (const aspect of [0.2, 0.5, 1, 2, 5]) {
    const distance = getCameraFitDistance(radius, fov, aspect);
    const sphereHalfAngle = Math.asin(radius / distance);
    assert.ok(sphereHalfAngle < fov * Math.PI / 360);
    assert.ok(sphereHalfAngle < Math.atan(Math.tan(fov * Math.PI / 360) * aspect));
  }
});

test('camera fit remains finite for unavailable aspect or degenerate geometry', () => {
  for (const aspect of [NaN, 0, -1, Infinity, undefined]) {
    const distance = getCameraFitDistance(0, 45, aspect);
    assert.ok(Number.isFinite(distance) && distance > 0);
  }
  assert.ok(Number.isFinite(getCameraFitDistance(NaN, NaN, 1)));
});
