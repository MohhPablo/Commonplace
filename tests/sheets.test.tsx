import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BottomSheet } from "../src/components/BottomSheet";
import { shouldDismissSheet } from "../src/lib/sheetGesture";

function setup() {
  const close = vi.fn();
  render(
    <BottomSheet open onClose={close} title="Details">
      <p>Pull here</p>
      <input aria-label="Draft" />
    </BottomSheet>,
  );
  const surface = screen.getByText("Pull here");
  const content = surface.parentElement!;
  const pull = (target: Element, from: number, to: number, cancel = false) => {
    fireEvent.touchStart(target, {
      touches: [{ clientX: 100, clientY: from }],
    });
    fireEvent.touchMove(target, { touches: [{ clientX: 100, clientY: to }] });
    if (cancel) fireEvent.touchCancel(target);
    else fireEvent.touchEnd(target, { touches: [] });
  };
  return { close, surface, content, pull };
}

it("dismisses a sheet with a downward pull from the top of its content", () => {
  const { close, surface, pull } = setup();
  pull(surface, 100, 260);
  expect(close).toHaveBeenCalledOnce();
});

it("keeps a sheet open during upward scrolling, text input, or a cancelled gesture", () => {
  const { close, surface, pull } = setup();
  pull(surface, 200, 40);
  pull(screen.getByLabelText("Draft"), 100, 260);
  pull(surface, 100, 260, true);
  expect(close).not.toHaveBeenCalled();
});

it("scrolls content back to the top before allowing a pull to dismiss", () => {
  const { close, surface, content, pull } = setup();
  content.scrollTop = 200;
  pull(surface, 100, 260);
  expect(close).not.toHaveBeenCalled();
  content.scrollTop = 0;
  pull(surface, 100, 260);
  expect(close).toHaveBeenCalledOnce();
});

it("provides an accessible alternative to dragging", () => {
  const { close } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Drag down to close" }));
  expect(close).toHaveBeenCalledOnce();
});

it("requires deliberate downward movement even for fast flicks", () => {
  expect(shouldDismissSheet(-150, 1200, 500)).toBe(false);
  expect(shouldDismissSheet(10, 1200, 500)).toBe(false);
  expect(shouldDismissSheet(50, 0, 500)).toBe(false);
  expect(shouldDismissSheet(50, 1000, 500)).toBe(true);
  expect(shouldDismissSheet(130, 0, 500)).toBe(true);
});
