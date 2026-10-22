import {
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ModalAvailability } from "../lib/ModalAvailability";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { Icon } from "./Icon";
import { shouldDismissSheet } from "../lib/sheetGesture";
import { CaretLeft, X } from "@phosphor-icons/react";

export function BottomSheet({
  open,
  onClose,
  title = "Add",
  children,
  action,
  page = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  page?: boolean;
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
  const y = useMotionValue(0);
  const content = useRef<HTMLDivElement>(null);
  const isVisible = useRef(visible);
  isVisible.current = visible;

  const suppressClick = useRef(false);
  useEffect(() => {
    if (visible) y.set(0);
  }, [visible, y]);
  const headerGesture = useRef<{
    pointer: number;
    start: number;
    last: number;
    time: number;
  } | null>(null);
  const reset = () => {
    headerGesture.current = null;
    void animate(
      y,
      0,
      reduced
        ? { duration: 0 }
        : { type: "spring", stiffness: 400, damping: 38 },
    );
  };
  const startHeader = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary) {
      suppressClick.current = true;
      reset();
      return;
    }
    if (page || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button:not(.sheet-grabber)"))
      return;
    suppressClick.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    headerGesture.current = {
      pointer: event.pointerId,
      start: event.clientY,
      last: event.clientY,
      time: performance.now(),
    };
    y.stop();
  };
  const moveHeader = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = headerGesture.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    gesture.last = event.clientY;
    if (Math.abs(event.clientY - gesture.start) > 8)
      suppressClick.current = true;
    y.set(Math.max(0, event.clientY - gesture.start) * 0.8);
  };
  const endHeader = () => {
    const gesture = headerGesture.current;
    if (!gesture) return;
    const distance = gesture.last - gesture.start;
    const velocity =
      (distance / Math.max(1, performance.now() - gesture.time)) * 1000;
    headerGesture.current = null;
    if (shouldDismissSheet(distance, velocity, panel.current?.offsetHeight))
      close.current();
    reset();
  };

  useEffect(() => {
    if (!visible || page || !content.current) return;
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
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      if (
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
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      if (!gesture) return;
      const dx = event.touches[0].clientX - gesture.x;
      const dy = event.touches[0].clientY - gesture.y;
      if (!gesture.dragging && (dy < -8 || Math.abs(dx) > Math.abs(dy))) {
        gesture = null;
        return;
      }
      if (dy > 12 && node.scrollTop <= 0) gesture.dragging = true;
      if (!gesture.dragging) return;
      if (!event.cancelable) {
        reset();
        return;
      }
      event.preventDefault();
      gesture.distance = Math.max(0, dy);
      y.set(gesture.distance * 0.65);
    };
    const reset = () => {
      gesture = null;
      void animate(
        y,
        0,
        reduced
          ? { duration: 0 }
          : { type: "spring", stiffness: 400, damping: 38 },
      );
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
  }, [visible, page, reduced, y]);

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
        <div className={`sheet-viewport ${page ? "sheet-page" : ""}`}>
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close.current()}
            className="sheet-backdrop"
          />
          <motion.div
            className="sheet-position"
            initial={{ y: reduced || page ? 0 : "100%", opacity: page ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduced || page ? 0 : "100%", opacity: page ? 0 : 1 }}
            transition={{
              duration: reduced ? 0 : 0.24,
              ease: [0.2, 0.8, 0.2, 1],
            }}
          >
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className="sheet-panel glass-sheet"
              style={{ y }}
            >
              {!page && (
                <button
                  type="button"
                  aria-label="Drag down to close"
                  className="sheet-grabber"
                  onClick={() => {
                    if (!suppressClick.current) close.current();
                    suppressClick.current = false;
                  }}
                  onPointerDown={startHeader}
                  onPointerMove={moveHeader}
                  onPointerUp={endHeader}
                  onPointerCancel={reset}
                  onLostPointerCapture={reset}
                >
                  <span />
                </button>
              )}
              <div
                className="sheet-heading"
                onPointerDown={startHeader}
                onPointerMove={moveHeader}
                onPointerUp={endHeader}
                onPointerCancel={reset}
                onLostPointerCapture={reset}
              >
                {page && (
                  <button
                    type="button"
                    className="text-action !px-0"
                    onClick={() => close.current()}
                    aria-label="Close Settings"
                  >
                    <Icon
                      as={CaretLeft}
                      size={21}
                      color="var(--color-terracotta)"
                    />{" "}
                    Back
                  </button>
                )}
                {!page && action && (
                  <button
                    type="button"
                    onClick={() => close.current()}
                    aria-label="Close"
                    className="text-action !px-0 !font-normal"
                  >
                    Cancel
                  </button>
                )}
                <h2
                  id={titleId}
                  className={page || action ? "text-center" : ""}
                >
                  {title}
                </h2>
                {action ?? (
                  <button
                    type="button"
                    onClick={() => close.current()}
                    aria-label="Close"
                    className="sheet-close"
                  >
                    {page ? "Done" : <Icon as={X} size={20} />}
                  </button>
                )}
              </div>
              <div ref={content} className="sheet-content">
                {children}
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
