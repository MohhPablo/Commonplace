import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { verifyPassword, resetAllData } from "../lib/auth";
import { PinPad } from "./PinPad";

const MAX_ATTEMPTS = 5;

/** Full-screen gate shown when an app password is set. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  // Bumped on each wrong attempt to remount PinPad and clear the entered digits.
  const [dialerKey, setDialerKey] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown]);

  async function submit(pin: string) {
    if (busy || cooldown) return;
    setBusy(true);
    try {
      if (await verifyPassword(pin)) {
        onUnlock();
        return;
      }
      const next = attempts + 1;
      if (next >= MAX_ATTEMPTS) {
        setCooldown(30);
        setAttempts(0);
      } else setAttempts(next);
      setError("Incorrect PIN.");
    } catch {
      setError("Could not verify the passcode. Please try again.");
    } finally {
      setDialerKey((value) => value + 1);
      setBusy(false);
    }
  }

  async function doReset() {
    setBusy(true);
    try {
      await resetAllData();
      location.reload();
    } catch {
      setError("Could not reset the app. Please try again.");
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-paper px-8"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
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
          <PinPad
            key={dialerKey}
            length={4}
            onComplete={submit}
            disabled={busy || cooldown > 0}
          />
          {error && (
            <p
              className="mt-5 text-center font-sans text-sm"
              style={{ color: "var(--color-rust)" }}
            >
              {cooldown ? `Try again in ${cooldown} seconds.` : error}
            </p>
          )}
          {
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="interactive mt-5 w-full font-sans text-sm text-softink underline"
            >
              Forgot passcode?
            </button>
          }
        </div>
      ) : (
        <div className="w-full max-w-xs text-center">
          <p className="font-sans text-sm text-ink">
            Resetting wipes all journal entries, tasks, priorities, habits,
            moods, reflections, and settings. This cannot be undone.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={doReset}
            className="interactive mt-4 w-full rounded-full bg-rust px-4 py-3 font-sans text-base font-medium text-onaccent"
          >
            Reset everything
          </button>
          <button
            type="button"
            disabled={busy}
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
