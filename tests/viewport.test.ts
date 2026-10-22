import { afterEach, expect, it, vi } from "vitest";
import { installViewportTracking } from "../src/lib/viewport";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup() {
  const viewport = new EventTarget();
  Object.assign(viewport, { height: 800, offsetTop: 0, scale: 1 });
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("innerHeight", 800);
  vi.stubGlobal("innerWidth", 390);
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
    800,
  );
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
    fn(0);
    return 1;
  });
  dispose = installViewportTracking();
  const field = document.createElement("textarea");
  document.body.append(field);
  const resize = (values: object) => {
    Object.assign(viewport, values);
    viewport.dispatchEvent(new Event("resize"));
  };
  return {
    viewport,
    field,
    resize,
    inset: () =>
      document.documentElement.style.getPropertyValue("--keyboard-inset"),
  };
}

it("keeps the shell stationary and avoids only the space below the visible viewport", () => {
  const { field, resize, inset } = setup();
  field.focus();
  resize({ height: 460, offsetTop: 20 });
  expect(inset()).toBe("320px");
  expect(document.documentElement.dataset.keyboard).toBe("true");
  expect(document.documentElement.style.getPropertyValue("--app-top")).toBe("");
  expect(document.documentElement.style.getPropertyValue("--app-height")).toBe(
    "",
  );
  field.blur();
  // focusout precedes the keyboard closing; don't overwrite the resting baseline.
  resize({ height: 600, offsetTop: 0 });
  expect(inset()).toBe("200px");
  resize({ height: 800, offsetTop: 0 });
  expect(inset()).toBe("0px");
  expect(document.documentElement.dataset.keyboard).toBe("false");
});

it("does not mistake pinch zoom for a keyboard or change keyboard geometry while zooming", () => {
  const { field, resize, inset } = setup();
  resize({ scale: 2, height: 400, offsetTop: 50 });
  expect(inset()).toBe("0px");
  field.focus();
  resize({ scale: 1, height: 460, offsetTop: 0 });
  expect(inset()).toBe("340px");
  resize({ scale: 2, height: 230, offsetTop: 80 });
  expect(inset()).toBe("340px");
});

it("does not subtract keyboard height twice when the browser already resizes the layout viewport", () => {
  const { field, resize, inset } = setup();
  field.focus();
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
    460,
  );
  vi.stubGlobal("innerHeight", 460);
  resize({ height: 460 });
  expect(inset()).toBe("0px");
  expect(document.documentElement.dataset.keyboard).toBe("true");
});

it("restores the layout after repeated keyboard transitions and a width change", () => {
  const { field, resize, inset } = setup();
  for (let i = 0; i < 20; i++) {
    field.focus();
    resize({ height: 470 });
    expect(inset()).toBe("330px");
    field.blur();
    resize({ height: 800 });
    expect(inset()).toBe("0px");
  }
  vi.stubGlobal("innerWidth", 844);
  vi.stubGlobal("innerHeight", 390);
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
    390,
  );
  resize({ height: 390 });
  expect(document.documentElement.dataset.keyboard).toBe("false");
  expect(inset()).toBe("0px");
});

it("limits page zoom gestures on app surfaces without intercepting a single touch", () => {
  setup();
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  const touch = (count: number) => {
    const event = new Event("touchstart", { bubbles: true, cancelable: true });
    Object.assign(event, {
      touches: Array.from({ length: count }, () => ({})),
    });
    root.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(touch(1)).toBe(false);
  expect(touch(2)).toBe(true);
  dispose?.();
  dispose = undefined;
  expect(touch(2)).toBe(false);
  expect(
    document.documentElement.style.getPropertyValue("--keyboard-inset"),
  ).toBe("");
});
