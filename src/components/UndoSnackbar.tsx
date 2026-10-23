import { createContext, useContext, useEffect, useId, useRef } from "react";
import { Toaster, toast } from "sonner";

/** True once the app shell has mounted its shared toaster. */
export const ToasterMounted = createContext(false);

/** One toaster for the whole app, floating just above the tab bar. */
export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      theme="light"
      gap={8}
      offset={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
      mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
      toastOptions={{
        className: "cp-toast",
        style: {
          background: "var(--glass-strong)",
          color: "var(--color-ink)",
          border: "none",
        },
      }}
    />
  );
}

/**
 * Bridges a pending undo into a Sonner toast. The toast lasts as long as the
 * undo window, and swiping it away finalises the deletion. Screens rendered
 * on their own (tests, previews) get a private toaster.
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
  const shared = useContext(ToasterMounted);
  const id = useId();
  const handlers = useRef({ onUndo, onDismiss });
  handlers.current = { onUndo, onDismiss };

  useEffect(() => {
    if (!pending) {
      toast.dismiss(id);
      return;
    }
    let acted = false;
    toast(pending.label, {
      id,
      duration: Infinity,
      action: {
        label: "Undo",
        onClick: () => {
          acted = true;
          handlers.current.onUndo();
        },
      },
      onDismiss: () => {
        if (!acted) handlers.current.onDismiss();
      },
    });
  }, [pending, id]);
  useEffect(() => () => void toast.dismiss(id), [id]);

  return shared ? null : <AppToaster />;
}
