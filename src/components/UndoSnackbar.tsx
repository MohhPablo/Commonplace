import { AnimatePresence, motion } from "framer-motion";

/**
 * Bottom-anchored undo snackbar. Sits above the fixed TabBar so it never
 * collides with the nav. Reachable by keyboard (the Undo button is a real
 * button) and announced via aria-live.
 */
export function UndoSnackbar({
  pending,
  onUndo,
  onDismiss,
}: {
  pending: { label: string } | null;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 z-50 mx-auto flex max-w-md justify-center px-5"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}
        >
          <div className="pointer-events-auto flex items-center gap-5 rounded-xl border border-taupe bg-surface px-5 py-3 shadow-lift">
            <span className="font-sans text-sm text-ink">{pending.label}</span>
            <button
              type="button"
              onClick={onUndo}
              className="interactive min-h-11 font-sans text-sm font-semibold text-terracotta"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="tap-target interactive text-softink"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
