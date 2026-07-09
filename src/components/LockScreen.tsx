import { useState } from "react";
import { motion } from "framer-motion";
import { verifyPassword, resetAllData } from "../lib/auth";
import { PinPad } from "./PinPad";

const MAX_ATTEMPTS = 5;

/** Full-screen gate shown when an app password is set. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  // Bumped on each wrong attempt to remount PinPad and clear the entered digits.
  const [dialerKey, setDialerKey] = useState(0);

  async function submit(pin: string) {
    const ok = await verifyPassword(pin);
    if (ok) {
      onUnlock();
      return;
    }
    const next = attempts + 1;
    setAttempts(next);
    setError(
      next >= MAX_ATTEMPTS
        ? "Too many attempts. You can reset the app below."
        : "Incorrect PIN.",
    );
    setDialerKey((k) => k + 1);
  }

  async function doReset() {
    await resetAllData();
    location.reload();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-paper px-8"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="mb-10 font-serif text-3xl font-semibold"
        style={{ color: "var(--color-ink)" }}
      >
        Commonplace<span style={{ color: "var(--color-terracotta)" }}>.</span>
      </div>

      {!confirmReset ? (
        <div className="w-full max-w-xs">
          <p
            className="mb-6 text-center font-sans text-sm"
            style={{ color: "var(--color-softink)" }}
          >
            Enter your passcode to unlock
          </p>
          <PinPad key={dialerKey} length={4} onComplete={submit} disabled={!!error && attempts >= MAX_ATTEMPTS} />
          {error && (
            <p
              className="mt-5 text-center font-sans text-sm"
              style={{ color: "var(--color-rust)" }}
            >
              {error}
            </p>
          )}
          {attempts >= MAX_ATTEMPTS && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="interactive mt-5 w-full font-sans text-sm text-softink underline"
            >
              Forgot password? Reset app
            </button>
          )}
        </div>
      ) : (
        <div className="w-full max-w-xs text-center">
          <p className="font-sans text-sm text-ink">
            Resetting wipes all local journal, tasks, priorities, and habits. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={doReset}
            className="interactive mt-4 w-full rounded-full bg-rust px-4 py-3 font-sans text-base font-medium text-surface"
          >
            Reset everything
          </button>
          <button
            type="button"
            onClick={() => setConfirmReset(false)}
            className="interactive mt-3 w-full font-sans text-sm text-softink underline"
          >
            Cancel
          </button>
        </div>
      )}
    </motion.div>
  );
}
