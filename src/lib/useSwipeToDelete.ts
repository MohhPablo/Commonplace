import { useRef, useState } from "react";

/** Commit only a completed horizontal swipe. Native scroll cancellation is safe. */
export function useSwipeToDelete(onDelete: () => void) {
  const [x, setX] = useState(0);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    horizontal: boolean;
    dx: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const threshold = 88;
  function cancel() {
    gesture.current = null;
    setX(0);
  }
  return {
    x,
    consumeClick() {
      const value = suppressClick.current;
      suppressClick.current = false;
      return value;
    },
    handlers: {
      onPointerDown(event: React.PointerEvent) {
        if (!event.isPrimary || event.button !== 0) return;
        suppressClick.current = false;
        gesture.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          horizontal: false,
          dx: 0,
        };
      },
      onPointerMove(event: React.PointerEvent) {
        const current = gesture.current;
        if (!current || current.id !== event.pointerId) return;
        const dx = event.clientX - current.x,
          dy = event.clientY - current.y;
        if (!current.horizontal) {
          if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
            cancel();
            return;
          }
          if (dx > -10 || Math.abs(dx) <= Math.abs(dy)) return;
          current.horizontal = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }
        current.dx = Math.min(0, dx);
        suppressClick.current = true;
        setX(Math.max(current.dx, -threshold * 1.3));
      },
      onPointerUp(event: React.PointerEvent) {
        const current = gesture.current;
        if (current?.id !== event.pointerId) return;
        const remove = current.horizontal && current.dx < -threshold;
        cancel();
        if (remove) onDelete();
      },
      onPointerCancel: cancel,
      onLostPointerCapture: cancel,
    },
  };
}
