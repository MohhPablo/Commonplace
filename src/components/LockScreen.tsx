import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { verifyPassword, resetAllData } from "../lib/auth";
import { PinPad } from "./PinPad";
import { Icon } from "./Icon";
import { LockSimple } from "@phosphor-icons/react";

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
      className="lock-screen"
    >
      <Icon as={LockSimple} size={26} color="currentColor" weight="fill" />
      {!confirmReset ? (
        <div className="mt-4 w-full max-w-xs">
          <p className="mb-8 text-center text-[20px] font-medium">
            Enter your passcode to unlock
          </p>
          <motion.div
            key={dialerKey}
            animate={error && dialerKey ? { x: [0, -16, 14, -10, 6, 0] } : {}}
            transition={{ duration: 0.42 }}
          >
            <PinPad
              length={4}
              onComplete={submit}
              disabled={busy || cooldown > 0}
            />
          </motion.div>
          <p role="alert" className="mt-6 min-h-5 text-center text-[15px]">
            {error
              ? cooldown
                ? `Try again in ${cooldown} seconds.`
                : error
              : ""}
          </p>
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="link-button"
            >
              Forgot passcode?
            </button>
          </div>
        </div>
      ) : (
        <div className="card glass mt-6 w-full max-w-sm p-5 text-center">
          <h2 className="text-[20px] font-bold">Reset Commonplace?</h2>
          <p className="mt-2 text-[15px] leading-snug opacity-80">
            Resetting wipes all journal entries, tasks, priorities, habits,
            moods, reflections, and settings. This cannot be undone.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={doReset}
            className="native-primary press mt-5 w-full"
            style={{ "--tint": "var(--color-rust)" } as React.CSSProperties}
          >
            Reset everything
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmReset(false)}
            className="link-button mt-2 w-full"
          >
            Cancel
          </button>
        </div>
      )}
    </motion.div>
  );
}
