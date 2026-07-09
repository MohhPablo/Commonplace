import { useCallback, useEffect, useRef, useState } from "react";

interface PendingUndo {
  label: string;
  undo: () => Promise<void> | void;
}

/**
 * Arms a short-lived undo after a destructive action. The caller deletes the
 * record immediately (so the list updates), then calls `arm` with the captured
 * record and a function that restores it. If the user doesn't undo within the
 * window, the deletion is finalized.
 */
export function useUndo(afterChange: () => void, timeoutMs = 5000) {
  const [pending, setPending] = useState<PendingUndo | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const arm = useCallback(
    (label: string, undo: () => Promise<unknown> | unknown) => {
      window.clearTimeout(timer.current);
      setPending({ label, undo: undo as () => Promise<void> | void });
      timer.current = window.setTimeout(() => {
        setPending(null);
        afterChange();
      }, timeoutMs);
    },
    [afterChange, timeoutMs],
  );

  const undo = useCallback(async () => {
    if (!pending) return;
    window.clearTimeout(timer.current);
    await pending.undo();
    setPending(null);
    afterChange();
  }, [pending, afterChange]);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setPending(null);
    afterChange();
  }, [afterChange]);

  return { pending, arm, undo, dismiss };
}
