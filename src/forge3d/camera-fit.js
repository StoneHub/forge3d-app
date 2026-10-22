// A bounding sphere must fit the narrower field of view. Using only vertical
// FOV clips models whenever editor/sidebar panels make the viewport portrait.
export function getCameraFitDistance(radius, verticalFovDegrees, aspect, padding = 1.15) {
  const safeRadius = Number.isFinite(radius) ? Math.max(radius, 1) : 1;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const safeFov = Number.isFinite(verticalFovDegrees) && verticalFovDegrees > 0 && verticalFovDegrees < 180 ? verticalFovDegrees : 45;
  const verticalHalfFov = safeFov * Math.PI / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * safeAspect);
  return safeRadius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov)) * padding;
}
