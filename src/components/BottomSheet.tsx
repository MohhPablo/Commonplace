import { useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { ModalAvailability } from "../lib/ModalAvailability";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Icon } from "./Icon";
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
        <div className="fixed inset-0 z-[9990]">
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close.current()}
            className="absolute inset-0 bg-black/45"
          />
          <motion.div
            ref={panel}
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
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] max-w-md flex-col rounded-t-3xl border-t border-taupe bg-paper p-5 shadow-lift outline-none"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
            }}
          >
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <h2
                id={titleId}
                className="font-serif text-xl font-semibold text-ink"
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
            <div className="min-h-0 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
