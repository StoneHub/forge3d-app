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

export const RENDER_APPEARANCE_CONTROLS = [
  { key: 'exposure', label: 'Brightness', min: 0.45, max: 1.15, step: 0.01 },
  { key: 'contrast', label: 'Contrast', min: 0.35, max: 1.25, step: 0.01 },
  { key: 'edgeStrength', label: 'Edges', min: 0.05, max: 0.9, step: 0.01 },
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
  const normalizeControl = (key) => {
    const control = RENDER_APPEARANCE_CONTROLS.find((candidate) => candidate.key === key);
    return clampNumber(value[key], control.min, control.max, DEFAULT_RENDER_APPEARANCE[key]);
  };
  return {
    material: materialIds.has(value.material) ? value.material : DEFAULT_RENDER_APPEARANCE.material,
    background: backgroundIds.has(value.background) ? value.background : DEFAULT_RENDER_APPEARANCE.background,
    exposure: normalizeControl('exposure'),
    contrast: normalizeControl('contrast'),
    edgeStrength: normalizeControl('edgeStrength'),
  };
}

export function getMaterialSwatch(id) {
  return MATERIAL_SWATCHES.find((swatch) => swatch.id === id) || MATERIAL_SWATCHES[0];
}

export function getViewportBackgroundStops(colors, backgroundId) {
  return colors.viewportBackgrounds[backgroundId] || colors.viewportBackgrounds.studio;
}

export function getViewportBackgroundGradient(colors, backgroundId) {
  const [top, middle, bottom] = getViewportBackgroundStops(colors, backgroundId);
  return `linear-gradient(180deg,${top} 0%, ${middle} 56%, ${bottom} 100%)`;
}
