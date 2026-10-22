import type { SaveState } from "../lib/autosave";

export function SaveStatus({
  status,
  onRetry,
}: {
  status: SaveState;
  onRetry: () => void;
}) {
  return (
    <span className="font-sans text-xs text-softink" role="status">
      {status === "error" ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 text-rust underline"
        >
          Couldn't save. Retry
        </button>
      ) : status === "saving" ? (
        "Saving…"
      ) : (
        "Saved"
      )}
    </span>
  );
}
