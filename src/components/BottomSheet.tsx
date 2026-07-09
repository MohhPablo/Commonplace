import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./Icon";
import { X } from "@phosphor-icons/react";

/**
 * Native-feel slide-up bottom sheet. Used for inline "add" flows so the text
 * field rides above the virtual keyboard in a focused popover instead of being
 * pinned to the bottom of a scroll view (spec §4). `interactive-widget` in the
 * meta tag resizes the layout viewport on focus so the sheet stays unobscured.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9990] bg-ink/40"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-[9991] mx-auto max-w-md rounded-t-3xl border-t border-taupe bg-paper p-5 shadow-lift"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-ink">
                {title ?? "Add"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="interactive -mr-2 flex h-10 w-10 items-center justify-center rounded-full"
              >
                <Icon as={X} size={20} color="#6B6058" weight="bold" />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
