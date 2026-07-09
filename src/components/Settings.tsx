import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./Icon";
import {
  Bell,
  DownloadSimple,
  UploadSimple,
  Lock,
  LockKey,
  Warning,
} from "@phosphor-icons/react";
import {
  isPasswordSet,
  setPassword,
  clearPassword,
  verifyPassword,
} from "../lib/auth";
import {
  requestReminderPermission,
  showForegroundReminder,
  saveReminderTime,
} from "../lib/notifications";
import { getReminderTime, getTheme, setTheme, type ReminderTime, type Theme } from "../lib/settings";
import { exportData, downloadBackup, importData } from "../lib/backup";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onPasswordChanged: () => void;
}

export function Settings({ open, onClose, onPasswordChanged }: SettingsProps) {
  const [hasPassword, setHasPassword] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [reminderTime, setReminderTimeState] = useState<ReminderTime>(null);
  const [theme, setThemeState] = useState<Theme>("paper");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPwMsg("");
    setImportMsg("");
    setCurrent("");
    setNext("");
    setConfirm("");
    void isPasswordSet().then(setHasPassword);
    void getReminderTime().then(setReminderTimeState);
    void getTheme().then(setThemeState);
  }, [open]);

  async function applyPassword() {
    setPwBusy(true);
    setPwMsg("");
    try {
      if (hasPassword && !(await verifyPassword(current))) {
        setPwMsg("Current password is incorrect.");
        return;
      }
      if (next.length < 4) {
        setPwMsg("Use at least 4 characters.");
        return;
      }
      if (next !== confirm) {
        setPwMsg("New password and confirmation don't match.");
        return;
      }
      await setPassword(next);
      setHasPassword(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setPwMsg("Password saved.");
      onPasswordChanged();
    } finally {
      setPwBusy(false);
    }
  }

  async function removePassword() {
    setPwBusy(true);
    setPwMsg("");
    try {
      if (hasPassword && !(await verifyPassword(current))) {
        setPwMsg("Current password is incorrect.");
        return;
      }
      await clearPassword();
      setHasPassword(false);
      setCurrent("");
      setPwMsg("Password removed.");
      onPasswordChanged();
    } finally {
      setPwBusy(false);
    }
  }

  async function testNotification() {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      const perm = await requestReminderPermission();
      if (perm !== "granted") return;
    }
    showForegroundReminder("Commonplace", "This is a test reminder.");
  }

  async function onTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value || null; // "HH:MM" or ""
    if (value) {
      const perm = await requestReminderPermission();
      if (perm !== "granted") {
        setReminderTimeState(null);
        return;
      }
    }
    setReminderTimeState(value);
    await saveReminderTime(value); // re-arms the scheduler
  }

  async function onThemeChange(t: Theme) {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    await setTheme(t);
  }

  async function doExport() {
    const data = await exportData();
    downloadBackup(data);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg("Importing…");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importData(data);
      setImportMsg("Backup restored.");
    } catch {
      setImportMsg("Could not import that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <AnimatePresence>
      <AnimatedSheet open={open} onClose={onClose}>
        <h2 className="font-serif text-xl font-semibold text-ink">Settings</h2>

      <section className="mt-4 rounded-xl border border-taupe bg-surface p-4 shadow-page">
        <div className="flex items-center gap-2">
          <Icon as={hasPassword ? Lock : LockKey} size={18} color="#C1502D" weight="duotone" />
          <span className="font-sans text-sm font-medium text-ink">
            {hasPassword ? "App password" : "Set app password"}
          </span>
        </div>
        {hasPassword && (
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Current password"
            className="mt-3 w-full rounded-lg border border-taupe bg-paper px-3 py-2 font-sans text-sm text-ink placeholder:text-softink focus:outline-none"
          />
        )}
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={hasPassword ? "New password" : "Password"}
          className="mt-2 w-full rounded-lg border border-taupe bg-paper px-3 py-2 font-sans text-sm text-ink placeholder:text-softink focus:outline-none"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="mt-2 w-full rounded-lg border border-taupe bg-paper px-3 py-2 font-sans text-sm text-ink placeholder:text-softink focus:outline-none"
        />
        {pwMsg && <p className="mt-2 font-sans text-xs text-terracotta">{pwMsg}</p>}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pwBusy}
            onClick={applyPassword}
            className="interactive flex-1 rounded-full bg-terracotta px-3 py-2 font-sans text-sm font-medium text-surface disabled:opacity-50"
          >
            {hasPassword ? "Change" : "Set"}
          </button>
          {hasPassword && (
            <button
              type="button"
              disabled={pwBusy}
              onClick={removePassword}
              className="interactive rounded-full border border-taupe px-3 py-2 font-sans text-sm font-medium text-softink disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-taupe bg-surface p-4 shadow-page">
        <div className="flex items-center gap-2">
          <Icon as={Bell} size={18} color="#C1502D" weight="duotone" />
          <span className="font-sans text-sm font-medium text-ink">Notifications</span>
        </div>
        <label className="mt-3 flex items-center justify-between gap-3">
          <span className="font-sans text-sm text-softink">Daily reminder</span>
          <input
            type="time"
            value={reminderTime ?? ""}
            onChange={onTimeChange}
            className="rounded-lg border border-taupe bg-paper px-3 py-1.5 font-sans text-sm text-ink focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={testNotification}
          className="interactive mt-3 w-full rounded-full border border-taupe px-3 py-2 font-sans text-sm font-medium text-softink"
        >
          Send test notification
        </button>
      </section>

      <section className="mt-3 rounded-xl border border-taupe bg-surface p-4 shadow-page">
        <div className="flex items-center gap-2">
          <Icon as={Warning} size={18} color="#C1502D" weight="duotone" />
          <span className="font-sans text-sm font-medium text-ink">Theme</span>
        </div>
        <div className="mt-3 flex gap-2">
          {(["paper", "sepia", "dark"] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onThemeChange(t)}
              aria-pressed={theme === t}
              className="interactive flex-1 rounded-full border px-3 py-2 font-sans text-sm font-medium capitalize"
              style={{
                borderColor: theme === t ? "#C1502D" : "#E4DCCB",
                color: theme === t ? "#C1502D" : "#6B6058",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-taupe bg-surface p-4 shadow-page">
        <div className="flex items-center gap-2">
          <Icon as={DownloadSimple} size={18} color="#C1502D" weight="duotone" />
          <span className="font-sans text-sm font-medium text-ink">Backup</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={doExport}
            className="interactive flex flex-1 items-center justify-center gap-1.5 rounded-full border border-taupe px-3 py-2 font-sans text-sm font-medium text-softink"
          >
            <Icon as={DownloadSimple} size={15} color="#6B6058" weight="bold" /> Export
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="interactive flex flex-1 items-center justify-center gap-1.5 rounded-full border border-taupe px-3 py-2 font-sans text-sm font-medium text-softink"
          >
            <Icon as={UploadSimple} size={15} color="#6B6058" weight="bold" /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={onFile}
          />
        </div>
        {importMsg && <p className="mt-2 font-sans text-xs text-terracotta">{importMsg}</p>}
      </section>

      <div className="mt-4 flex items-center gap-1.5 font-sans text-xs text-softink">
        <Icon as={Warning} size={14} color="#6B6058" weight="fill" />
        Local-only. Resetting the app from the lock screen erases all data.
      </div>
      </AnimatedSheet>
    </AnimatePresence>
  );
}

function AnimatedSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[9990] bg-ink/30"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        />
      )}
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className="fixed inset-x-0 bottom-0 z-[9991] mx-auto max-w-md rounded-t-3xl border-t border-taupe bg-paper p-5 pb-8 shadow-lift"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
        >
          {children}
        </motion.div>
      )}
    </>
  );
}
