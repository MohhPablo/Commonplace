/**
 * Haptic feedback. Uses the Vibration API where available (most Android
 * browsers). iOS Safari ignores it, so this is a safe no-op there — the
 * Framer Motion springs still provide visual feedback.
 */
export function tap(pattern: number | number[] = 10): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* unsupported — ignore */
  }
}
