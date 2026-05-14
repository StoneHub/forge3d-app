export const MATERIAL_SWATCHES = [
  { id: 'cool-blue', label: 'Blue', color: '#75b8d4' },
  { id: 'graphite', label: 'Graphite', color: '#8f9baa' },
  { id: 'warm-gray', label: 'Warm', color: '#b7aa9b' },
  { id: 'mint', label: 'Mint', color: '#82c7a5' },
];

export const BACKGROUND_PRESETS = [
  { id: 'studio', label: 'Studio' },
  { id: 'soft', label: 'Soft' },
  { id: 'dark', label: 'Dark' },
];

export const DEFAULT_RENDER_APPEARANCE = {
  material: 'cool-blue',
  background: 'studio',
  exposure: 0.74,
  contrast: 0.78,
  edgeStrength: 0.38,
};

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizeRenderAppearance(value = {}) {
  const materialIds = new Set(MATERIAL_SWATCHES.map((swatch) => swatch.id));
  const backgroundIds = new Set(BACKGROUND_PRESETS.map((preset) => preset.id));
  return {
    material: materialIds.has(value.material) ? value.material : DEFAULT_RENDER_APPEARANCE.material,
    background: backgroundIds.has(value.background) ? value.background : DEFAULT_RENDER_APPEARANCE.background,
    exposure: clampNumber(value.exposure, 0.45, 1.15, DEFAULT_RENDER_APPEARANCE.exposure),
    contrast: clampNumber(value.contrast, 0.35, 1.25, DEFAULT_RENDER_APPEARANCE.contrast),
    edgeStrength: clampNumber(value.edgeStrength, 0.05, 0.9, DEFAULT_RENDER_APPEARANCE.edgeStrength),
  };
}

export function getMaterialSwatch(id) {
  return MATERIAL_SWATCHES.find((swatch) => swatch.id === id) || MATERIAL_SWATCHES[0];
}
