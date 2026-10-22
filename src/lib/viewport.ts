/** Keep the app frame aligned with the visible viewport, including iOS keyboards. */
export function installViewportTracking() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let restingHeight = window.innerHeight;
  let width = window.innerWidth;
  let frame = 0;
  const update = () => {
    const focused =
      document.activeElement instanceof HTMLElement &&
      document.activeElement.matches(
        'input, textarea, [contenteditable="true"]',
      );
    if (!focused || Math.abs(window.innerWidth - width) > 80) {
      restingHeight = Math.max(window.innerHeight, viewport?.height ?? 0);
      width = window.innerWidth;
    }
    const zoomed = viewport && Math.abs(viewport.scale - 1) > 0.01;
    const height = !zoomed && viewport ? viewport.height : window.innerHeight;
    root.style.setProperty("--app-height", `${height}px`);
    root.style.setProperty(
      "--app-top",
      `${!zoomed ? (viewport?.offsetTop ?? 0) : 0}px`,
    );
    root.dataset.keyboard =
      focused && restingHeight - height > 100 ? "true" : "false";
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener("resize", schedule);
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", schedule);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedule);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    document.removeEventListener("focusin", schedule);
    document.removeEventListener("focusout", schedule);
  };
}
