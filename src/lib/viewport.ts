/** The layout viewport owns the screen. Only foreground panes avoid the keyboard. */
export function installViewportTracking() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let restingHeight = window.innerHeight;
  let width = window.innerWidth;
  let keyboard = false;
  let frame = 0;
  let settle = 0;

  const update = () => {
    const focused =
      document.activeElement instanceof HTMLElement &&
      document.activeElement.matches(
        'input:not([type="button"]):not([type="checkbox"]), textarea, [contenteditable="true"]',
      );
    const layoutHeight = root.clientHeight || window.innerHeight;
    const rotated = Math.abs(window.innerWidth - width) > 80;
    const zoomed = viewport && Math.abs(viewport.scale - 1) > 0.01;
    if (zoomed) return; // Pinch is not a keyboard resize and must not change its baseline.
    const visibleHeight = viewport?.height ?? window.innerHeight;
    const visibleBottom = Math.min(
      layoutHeight,
      (viewport?.offsetTop ?? 0) + visibleHeight,
    );
    if (rotated) {
      restingHeight = Math.max(layoutHeight, window.innerHeight);
      width = window.innerWidth;
    }
    // Keep the baseline through focusout: the keyboard can take several frames to close.
    if (!keyboard && !focused)
      restingHeight = Math.max(restingHeight, layoutHeight, window.innerHeight);
    const contracted = restingHeight - visibleHeight > 100;
    keyboard = contracted && (focused || keyboard);
    if (!contracted) {
      keyboard = false;
      restingHeight = Math.max(layoutHeight, window.innerHeight);
    }
    root.style.setProperty(
      "--keyboard-inset",
      `${keyboard ? Math.max(0, layoutHeight - visibleBottom) : 0}px`,
    );
    root.dataset.keyboard = String(keyboard);
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  const onFocus = () => {
    schedule();
    window.clearTimeout(settle);
    settle = window.setTimeout(schedule, 400);
  };
  const resume = () => {
    if (document.visibilityState === "visible") onFocus();
  };
  // Safari may ignore viewport scale limits. Restrict page gestures on app surfaces,
  // without touching one-finger scrolling, native text selection, or OS accessibility Zoom.
  const preventPageZoom = (event: Event) => {
    if (
      event.target instanceof Element &&
      event.target.closest("#root, .sheet-viewport")
    ) {
      if (event.cancelable) event.preventDefault();
    }
  };
  const multiTouch = (event: TouchEvent) => {
    if (event.touches.length > 1) preventPageZoom(event);
  };
  update();
  window.addEventListener("resize", schedule);
  window.addEventListener("pageshow", onFocus);
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);
  document.addEventListener("focusin", onFocus);
  document.addEventListener("focusout", onFocus);
  document.addEventListener("visibilitychange", resume);
  document.addEventListener("gesturestart", preventPageZoom, {
    passive: false,
  });
  document.addEventListener("gesturechange", preventPageZoom, {
    passive: false,
  });
  document.addEventListener("touchstart", multiTouch, { passive: false });
  return () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(settle);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("pageshow", onFocus);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    document.removeEventListener("focusin", onFocus);
    document.removeEventListener("focusout", onFocus);
    document.removeEventListener("visibilitychange", resume);
    document.removeEventListener("gesturestart", preventPageZoom);
    document.removeEventListener("gesturechange", preventPageZoom);
    document.removeEventListener("touchstart", multiTouch);
    root.style.removeProperty("--keyboard-inset");
    delete root.dataset.keyboard;
  };
}
