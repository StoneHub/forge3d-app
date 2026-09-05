import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_RENDER_APPEARANCE,
  RENDER_APPEARANCE_CONTROLS,
  getMaterialSwatch,
  getViewportBackgroundGradient,
  getViewportBackgroundStops,
  normalizeRenderAppearance,
} from '../src/forge3d/render-appearance.js';
import { getThemeColors } from '../src/forge3d/theme.js';

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

test('shares slider limits and themed viewport backgrounds with the controls and renderer', () => {
  assert.deepEqual(RENDER_APPEARANCE_CONTROLS.map(({ key, min, max }) => ({ key, min, max })), [
    { key: 'exposure', min: 0.45, max: 1.15 },
    { key: 'contrast', min: 0.35, max: 1.25 },
    { key: 'edgeStrength', min: 0.05, max: 0.9 },
  ]);

  const colors = getThemeColors('dark');
  assert.deepEqual(getViewportBackgroundStops(colors, 'soft'), colors.viewportBackgrounds.soft);
  assert.deepEqual(getViewportBackgroundStops(colors, 'missing'), colors.viewportBackgrounds.studio);
  assert.equal(
    getViewportBackgroundGradient(colors, 'dark'),
    'linear-gradient(180deg,#1e2937 0%, #121923 56%, #080b10 100%)',
  );
});
