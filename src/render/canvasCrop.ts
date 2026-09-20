/** Intersect a CSS-space photo with the actual backing canvas, including clipped left/top edges. */
export function canvasCrop(
  x: number,
  y: number,
  size: number,
  dpr: number,
  width: number,
  height: number,
  output: number,
) {
  if (
    ![x, y, size, dpr, width, height, output].every(Number.isFinite) ||
    Math.min(size, dpr, width, height, output) <= 0
  )
    return null;
  const left = Math.round((x - size / 2) * dpr),
    top = Math.round((y - size / 2) * dpr),
    span = Math.round(size * dpr);
  if (span <= 0) return null;
  const sx = Math.max(0, left),
    sy = Math.max(0, top),
    sw = Math.min(width, left + span) - sx,
    sh = Math.min(height, top + span) - sy;
  if (sw <= 0 || sh <= 0) return null;
  return {
    sx,
    sy,
    sw,
    sh,
    dx: ((sx - left) / span) * output,
    dy: ((sy - top) / span) * output,
    dw: (sw / span) * output,
    dh: (sh / span) * output,
  };
}
