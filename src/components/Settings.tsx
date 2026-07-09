import { useEffect, useRef, useState } from "react";
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
import { BottomSheet } from "./BottomSheet";
import { PinPad } from "./PinPad";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onPasswordChanged: () => void;
}

type PinMode = "idle" | "create" | "createConfirm" | "current" | "next" | "nextConfirm" | "verifyRemove";

export function Settings({ open, onClose, onPasswordChanged }: SettingsProps) {
  const [hasPassword, setHasPassword] = useState(false);
  const [pinMode, setPinMode] = useState<PinMode>("idle");
  const [pinDraft, setPinDraft] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [reminderTime, setReminderTimeState] = useState<ReminderTime>(null);
  const [theme, setThemeState] = useState<Theme>("paper");
  const fileRef = useRef<HTMLInputElement>(null);
  // Bumped to remount PinPad and clear its digits between steps / wrong pins.
  const [pinKey, setPinKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPwMsg("");
    setImportMsg("");
    setPinDraft("");
    setPinMode("idle");
    void isPasswordSet().then(setHasPassword);
    void getReminderTime().then(setReminderTimeState);
    void getTheme().then(setThemeState);
  }, [open]);

  function resetPin() {
    setPinDraft("");
    setPinKey((k) => k + 1);
  }

  function failPin(msg: string) {
    setPinDraft("");
    setPinKey((k) => k + 1);
    setPwMsg(msg);
  }

  function startSet() {
    setPwMsg("");
    setPinMode("create");
    resetPin();
  }

  function startChange() {
    setPwMsg("");
    setPinMode("current");
    resetPin();
  }

  function startRemove() {
    setPwMsg("");
    setPinMode("verifyRemove");
    resetPin();
  }

  async function onPin(pin: string) {
    setPwBusy(true);
    try {
      switch (pinMode) {
        case "create":
          setPinDraft(pin);
          setPinMode("createConfirm");
          resetPin();
          return;
        case "createConfirm": {
          if (pin !== pinDraft) {
            failPin("PINs don't match. Try again.");
            setPinMode("create");
            return;
          }
          await setPassword(pin);
          setHasPassword(true);
          setPinMode("idle");
          setPwMsg("Passcode saved.");
          onPasswordChanged();
          return;
        }
        case "current": {
          if (!(await verifyPassword(pin))) {
            failPin("Current passcode is incorrect.");
            return;
          }
          setPinMode("next");
          resetPin();
          return;
        }
        case "next":
          setPinDraft(pin);
          setPinMode("nextConfirm");
          resetPin();
          return;
        case "nextConfirm": {
          if (pin !== pinDraft) {
            failPin("PINs don't match. Try again.");
            setPinMode("next");
            return;
          }
          await setPassword(pin);
          setHasPassword(true);
          setPinMode("idle");
          setPwMsg("Passcode saved.");
          onPasswordChanged();
          return;
        }
        case "verifyRemove": {
          if (!(await verifyPassword(pin))) {
            failPin("Current passcode is incorrect.");
            return;
          }
          await clearPassword();
          setHasPassword(false);
          setPinMode("idle");
          setPwMsg("Passcode removed.");
          onPasswordChanged();
          return;
        }
      }
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

  const pinPrompt: Record<PinMode, string | null> = {
    idle: null,
    create: "Enter a new passcode",
    createConfirm: "Re-enter your new passcode",
    current: "Enter your current passcode",
    next: "Enter a new passcode",
    nextConfirm: "Re-enter your new passcode",
    verifyRemove: "Enter your passcode to remove it",
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Settings">
      <div className="max-h-[72vh] overflow-y-auto">
        <section className="rounded-xl border border-taupe bg-surface p-4 shadow-page">
          <div className="flex items-center gap-2">
            <Icon as={hasPassword ? Lock : LockKey} size={18} color="#C1502D" weight="duotone" />
            <span className="font-sans text-sm font-medium text-ink">
              {hasPassword ? "App passcode" : "Set app passcode"}
            </span>
          </div>

          {pinMode === "idle" ? (
            <div className="mt-3 flex gap-2">
              {!hasPassword && (
                <button
                  type="button"
                  disabled={pwBusy}
                  onClick={startSet}
                  className="interactive flex-1 rounded-full bg-terracotta px-3 py-2 font-sans text-sm font-medium text-surface disabled:opacity-50"
                >
                  Set
                </button>
              )}
              {hasPassword && (
                <>
                  <button
                    type="button"
                    disabled={pwBusy}
                    onClick={startChange}
                    className="interactive flex-1 rounded-full bg-terracotta px-3 py-2 font-sans text-sm font-medium text-surface disabled:opacity-50"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    disabled={pwBusy}
                    onClick={startRemove}
                    className="interactive rounded-full border border-taupe px-3 py-2 font-sans text-sm font-medium text-softink disabled:opacity-50"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {pinPrompt[pinMode] && (
                <p className="mt-3 text-center font-sans text-sm text-softink">
                  {pinPrompt[pinMode]}
                </p>
              )}
              <div className="mt-2">
                <PinPad key={pinKey} length={4} onComplete={onPin} disabled={pwBusy} />
              </div>
              <button
                type="button"
                onClick={() => {
                  setPinMode("idle");
                  setPwMsg("");
                  resetPin();
                }}
                className="interactive mt-2 w-full font-sans text-sm text-softink underline"
              >
                Cancel
              </button>
            </>
          )}

          {pwMsg && <p className="mt-2 font-sans text-xs text-terracotta">{pwMsg}</p>}
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
                  borderColor: theme === t ? "#2B2420" : "#E4DCCB",
                  color: theme === t ? "#2B2420" : "#6B6058",
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
      </div>
    </BottomSheet>
  );
}
