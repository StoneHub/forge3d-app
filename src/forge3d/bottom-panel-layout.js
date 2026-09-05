export const COLLAPSED_BOTTOM_PANEL_HEIGHT = 31;
export const MIN_EXPANDED_BOTTOM_PANEL_HEIGHT = 100;
export const DEFAULT_BOTTOM_PANEL_HEIGHT = 180;

export function clampBottomPanelHeight(height, maximum = 520) {
  if (!Number.isFinite(height)) return DEFAULT_BOTTOM_PANEL_HEIGHT;
  const snapThreshold = (COLLAPSED_BOTTOM_PANEL_HEIGHT + MIN_EXPANDED_BOTTOM_PANEL_HEIGHT) / 2;
  if (height < snapThreshold) return COLLAPSED_BOTTOM_PANEL_HEIGHT;
  return Math.max(MIN_EXPANDED_BOTTOM_PANEL_HEIGHT, Math.min(maximum, height));
}
