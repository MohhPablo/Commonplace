import { expect, it, vi } from "vitest";
import { installViewportTracking } from "../src/lib/viewport";

it("keeps the frame above the keyboard and restores it when the keyboard closes", () => {
  const viewport = new EventTarget();
  Object.assign(viewport, { height: 800, offsetTop: 0, scale: 1 });
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("innerHeight", 800);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
    fn(0);
    return 1;
  });
  const dispose = installViewportTracking();
  const input = document.createElement("textarea");
  document.body.append(input);
  input.focus();
  Object.assign(viewport, { height: 460, offsetTop: 20 });
  viewport.dispatchEvent(new Event("resize"));
  expect(document.documentElement.style.getPropertyValue("--app-height")).toBe(
    "460px",
  );
  expect(document.documentElement.style.getPropertyValue("--app-top")).toBe(
    "20px",
  );
  expect(document.documentElement.dataset.keyboard).toBe("true");
  input.blur();
  Object.assign(viewport, { height: 800, offsetTop: 0 });
  viewport.dispatchEvent(new Event("resize"));
  expect(document.documentElement.dataset.keyboard).toBe("false");
  expect(document.documentElement.style.getPropertyValue("--app-height")).toBe(
    "800px",
  );
  Object.assign(viewport, { scale: 2, height: 400, offsetTop: 50 });
  viewport.dispatchEvent(new Event("resize"));
  expect(document.documentElement.style.getPropertyValue("--app-height")).toBe(
    "800px",
  );
  expect(document.documentElement.style.getPropertyValue("--app-top")).toBe(
    "0px",
  );
  dispose();
  Object.assign(viewport, { scale: 1, height: 600 });
  viewport.dispatchEvent(new Event("resize"));
  expect(document.documentElement.style.getPropertyValue("--app-height")).toBe(
    "800px",
  );
  input.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
