import { useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { ModalAvailability } from "../lib/ModalAvailability";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useDragControls,
  useReducedMotion,
} from "framer-motion";
import { Icon } from "./Icon";
import { shouldDismissSheet } from "../lib/sheetGesture";
import { X } from "@phosphor-icons/react";

export function BottomSheet({
  open,
  onClose,
  title = "Add",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const available = useContext(ModalAvailability);
  const visible = open && available;
  const previousOpen = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  if (visible && !previousOpen.current)
    returnFocus.current = document.activeElement as HTMLElement | null;
  previousOpen.current = visible;
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const reduced = useReducedMotion();
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const content = useRef<HTMLDivElement>(null);
  const isVisible = useRef(visible);
  isVisible.current = visible;

  useEffect(() => {
    if (!visible || !content.current) return;
    const node = content.current;
    let gesture: {
      x: number;
      y: number;
      distance: number;
      started: number;
      dragging: boolean;
    } | null = null;
    const start = (event: TouchEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.touches.length !== 1 ||
        node.scrollTop > 0 ||
        target.closest(
          'input, textarea, button, a, select, [contenteditable="true"]',
        )
      )
        return;
      gesture = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        distance: 0,
        started: performance.now(),
        dragging: false,
      };
    };
    const move = (event: TouchEvent) => {
      if (!gesture || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - gesture.x;
      const dy = event.touches[0].clientY - gesture.y;
      if (!gesture.dragging && (dy < -8 || Math.abs(dx) > Math.abs(dy))) {
        gesture = null;
        return;
      }
      if (dy > 12 && node.scrollTop <= 0) gesture.dragging = true;
      if (!gesture.dragging) return;
      if (event.cancelable) event.preventDefault();
      gesture.distance = Math.max(0, dy);
      y.set(gesture.distance * 0.65);
    };
    const reset = () => {
      gesture = null;
      void animate(y, 0, { type: "spring", stiffness: 400, damping: 38 });
    };
    const end = () => {
      if (!gesture?.dragging) {
        gesture = null;
        return;
      }
      const velocity =
        (gesture.distance / Math.max(1, performance.now() - gesture.started)) *
        1000;
      const dismiss = shouldDismissSheet(
        gesture.distance,
        velocity,
        panel.current?.offsetHeight,
      );
      gesture = null;
      if (dismiss) close.current();
      queueMicrotask(() => {
        if (isVisible.current) reset();
      });
    };
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchmove", move, { passive: false });
    node.addEventListener("touchend", end);
    node.addEventListener("touchcancel", reset);
    return () => {
      node.removeEventListener("touchstart", start);
      node.removeEventListener("touchmove", move);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", reset);
    };
  }, [visible, y]);

  useEffect(() => {
    if (!visible) return;
    const previous = returnFocus.current;
    const overflow = document.body.style.overflow;
    const root = document.getElementById("root");
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      [
        ...(panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled):not([type="hidden"]), textarea:not(:disabled), select:not(:disabled), [href], [tabindex="0"]',
        ) ?? []),
      ].filter((el) => !el.closest("[hidden], .hidden"));
    if (!panel.current?.contains(document.activeElement))
      panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0],
        last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        panel.current?.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target)
      )
        panel.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.body.style.overflow = overflow;
      if (root) root.inert = wasInert;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      if (previous?.isConnected) previous.focus();
    };
  }, [visible]);

  return createPortal(
    <AnimatePresence>
      {visible && (
        <div className="sheet-viewport">
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close.current()}
            className="sheet-backdrop absolute inset-0"
          />
          <motion.div
            ref={panel}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            dragMomentum={false}
            dragSnapToOrigin
            onDragEnd={(_event, info) => {
              if (
                shouldDismissSheet(
                  info.offset.y,
                  info.velocity.y,
                  panel.current?.offsetHeight,
                )
              )
                close.current();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ y: reduced ? 0 : "100%" }}
            animate={{ y: 0 }}
            exit={{ y: reduced ? 0 : "100%" }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 320, damping: 34 }
            }
            className="sheet-panel glass-sheet"
            style={{
              y,
              paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
            }}
          >
            <button
              type="button"
              aria-label="Drag down to close"
              className="sheet-grabber"
              onClick={() => close.current()}
              onPointerDown={(event) => dragControls.start(event)}
            >
              <span />
            </button>
            <div
              className="sheet-heading"
              onPointerDown={(event) => {
                if (!(event.target as HTMLElement).closest("button"))
                  dragControls.start(event);
              }}
            >
              <h2
                id={titleId}
                className="text-xl font-semibold tracking-tight text-ink"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={() => close.current()}
                aria-label="Close"
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full"
              >
                <Icon as={X} size={20} weight="bold" />
              </button>
            </div>
            <div
              ref={content}
              className="sheet-content min-h-0 overflow-y-auto overscroll-contain"
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
