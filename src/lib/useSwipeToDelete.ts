import { useRef, useState } from "react";

/**
 * Horizontal swipe-to-delete gesture (spec §5.2). Pointer-based (not the native
 * HTML5 DnD API, which is unreliable on iOS touch — ref §1/§5). Reveals a
 * destructive "Delete" action beneath the row; releasing past the threshold
 * fires onDelete. Returns props to spread on the row + the translateX value.
 */
export function useSwipeToDelete(onDelete: () => void) {
  const [x, setX] = useState(0);
  const [armed, setArmed] = useState(false);
  const startX = useRef<number | null>(null);
  const THRESHOLD = 88;

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    if (dx < 0) {
      setX(Math.max(dx, -THRESHOLD * 1.3));
      setArmed(Math.abs(dx) > THRESHOLD);
    }
  }
  function onPointerUp() {
    if (armed) {
      onDelete();
    }
    setX(0);
    setArmed(false);
    startX.current = null;
  }

  return {
    x,
    armed,
    threshold: THRESHOLD,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
