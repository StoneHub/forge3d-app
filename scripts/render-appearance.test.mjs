import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_RENDER_APPEARANCE,
  getMaterialSwatch,
  normalizeRenderAppearance,
} from '../src/forge3d/render-appearance.js';

test('normalizes render appearance with softer default lighting', () => {
  assert.deepEqual(normalizeRenderAppearance(), DEFAULT_RENDER_APPEARANCE);
  assert.equal(getMaterialSwatch('cool-blue').color, '#75b8d4');
});

test('clamps render appearance sliders and rejects unknown presets', () => {
  assert.deepEqual(normalizeRenderAppearance({
    material: 'unknown',
    background: 'missing',
    exposure: 100,
    contrast: -4,
    edgeStrength: 3,
  }), {
    material: DEFAULT_RENDER_APPEARANCE.material,
    background: DEFAULT_RENDER_APPEARANCE.background,
    exposure: 1.15,
    contrast: 0.35,
    edgeStrength: 0.9,
  });
});
