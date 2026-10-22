/** Ignore upward drags and tiny flings so tapping a sheet never dismisses it. */
export function shouldDismissSheet(
  offset: number,
  velocity: number,
  height = 0,
): boolean {
  const threshold = height > 0 ? Math.min(120, height * 0.25) : 96;
  return offset > threshold || (offset > 24 && velocity > 800);
}
