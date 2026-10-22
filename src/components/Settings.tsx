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
import {
  getReminderTime,
  getTheme,
  setTheme,
  type ReminderTime,
  type Theme,
} from "../lib/settings";
import {
  exportData,
  downloadBackup,
  importData,
  validateBackup,
} from "../lib/backup";
import { BottomSheet } from "./BottomSheet";
import { PinPad } from "./PinPad";
import type { BackupData } from "../lib/db";
import { InlineError } from "./InlineError";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onPasswordChanged: () => void;
  onDataRestored?: () => void;
}

type PinMode =
  | "idle"
  | "create"
  | "createConfirm"
  | "current"
  | "next"
  | "nextConfirm"
  | "verifyRemove";

export function Settings({
  open,
  onClose,
  onPasswordChanged,
  onDataRestored,
}: SettingsProps) {
  const [hasPassword, setHasPassword] = useState(false);
  const [pinMode, setPinMode] = useState<PinMode>("idle");
  const [pinDraft, setPinDraft] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [error, setError] = useState("");
  const [notificationMsg, setNotificationMsg] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [reminderTime, setReminderTimeState] = useState<ReminderTime>(null);
  const [theme, setThemeState] = useState<Theme>("paper");
  const fileRef = useRef<HTMLInputElement>(null);
  // Bumped to remount PinPad and clear its digits between steps / wrong pins.
  const [pinKey, setPinKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPwMsg("");
    setPendingBackup(null);
    setError("");
    setImportMsg("");
    setPinDraft("");
    setPinMode("idle");
    void isPasswordSet()
      .then(setHasPassword)
      .catch(() => setError("Could not read passcode settings."));
    void getReminderTime()
      .then(setReminderTimeState)
      .catch(() => setError("Could not read reminders."));
    void getTheme()
      .then(setThemeState)
      .catch(() => setError("Could not read appearance settings."));
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
          setPinKey((k) => k + 1);
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
          setPinKey((k) => k + 1);
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
    } catch {
      failPin("Could not save the passcode. Please try again.");
      setPinMode("idle");
    } finally {
      setPwBusy(false);
    }
  }

  async function testNotification() {
    const perm = await requestReminderPermission();
    const shown =
      perm === "granted" &&
      showForegroundReminder("Commonplace", "This is a test reminder.");
    setNotificationMsg(
      shown
        ? "Test notification sent."
        : "System notifications are unavailable here. Your reminder will still appear while Commonplace is open.",
    );
  }

  async function onTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value || null;
    try {
      await saveReminderTime(value);
      setReminderTimeState(value);
    } catch {
      setError("Could not save the reminder time.");
    }
  }

  async function onThemeChange(t: Theme) {
    try {
      await setTheme(t);
      setThemeState(t);
    } catch {
      setError("Could not save your theme. Please try again.");
    }
  }

  async function doExport() {
    setBackupBusy(true);
    try {
      downloadBackup(await exportData());
      setImportMsg("Backup downloaded. Keep it somewhere safe.");
    } catch {
      setError("Could not export your data. Please try again.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg("");
    setError("");
    try {
      if (file.size > 25 * 1024 * 1024)
        throw new Error("Choose a backup smaller than 25 MB.");
      setPendingBackup(validateBackup(JSON.parse(await file.text())));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not read that backup.",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function restoreBackup() {
    if (!pendingBackup || backupBusy) return;
    setBackupBusy(true);
    try {
      await importData(pendingBackup);
      setPendingBackup(null);
      setImportMsg("Backup restored.");
      onDataRestored?.();
    } catch {
      setError("Could not restore this backup. Your existing data was kept.");
    } finally {
      setBackupBusy(false);
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
    <BottomSheet
      open={open}
      onClose={() => {
        if (!pwBusy && !backupBusy) onClose();
      }}
      title="Settings"
    >
      <div>
        <InlineError>{error}</InlineError>
        <section className="rounded-xl border border-taupe bg-surface p-4 shadow-page">
          <div className="flex items-center gap-2">
            <Icon
              as={hasPassword ? Lock : LockKey}
              size={18}
              color="var(--color-terracotta)"
              weight="duotone"
            />
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
                  className="interactive flex-1 rounded-full bg-terracotta px-3 py-2 font-sans text-sm font-medium text-onaccent disabled:opacity-50"
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
                    className="interactive flex-1 rounded-full bg-terracotta px-3 py-2 font-sans text-sm font-medium text-onaccent disabled:opacity-50"
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
                <PinPad
                  key={pinKey}
                  length={4}
                  onComplete={onPin}
                  disabled={pwBusy}
                />
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

          {pwMsg && (
            <p role="status" className="mt-2 font-sans text-xs text-terracotta">
              {pwMsg}
            </p>
          )}
        </section>

        <section className="mt-3 rounded-xl border border-taupe bg-surface p-4 shadow-page">
          <div className="flex items-center gap-2">
            <Icon
              as={Bell}
              size={18}
              color="var(--color-terracotta)"
              weight="duotone"
            />
            <span className="font-sans text-sm font-medium text-ink">
              Reminders
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-softink">
            Reminders work while this app is open. They cannot wake a closed
            app.
          </p>
          <label className="mt-3 flex items-center justify-between gap-3">
            <span className="font-sans text-sm text-softink">
              Daily reminder
            </span>
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
          {reminderTime && (
            <button
              type="button"
              className="mt-2 min-h-11 text-sm text-softink underline"
              onClick={() => {
                void saveReminderTime(null)
                  .then(() => setReminderTimeState(null))
                  .catch(() => setError("Could not turn off reminders."));
              }}
            >
              Turn off reminder
            </button>
          )}
          {notificationMsg && (
            <p role="status" className="mt-2 text-sm text-softink">
              {notificationMsg}
            </p>
          )}
        </section>

        <section className="mt-3 rounded-xl border border-taupe bg-surface p-4 shadow-page">
          <div className="flex items-center gap-2">
            <Icon
              as={Warning}
              size={18}
              color="var(--color-terracotta)"
              weight="duotone"
            />
            <span className="font-sans text-sm font-medium text-ink">
              Theme
            </span>
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
                  borderColor:
                    theme === t
                      ? "var(--color-terracotta)"
                      : "var(--color-taupe)",
                  background:
                    theme === t ? "var(--color-terracotta)" : "transparent",
                  color:
                    theme === t
                      ? "var(--color-onaccent)"
                      : "var(--color-softink)",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3 rounded-xl border border-taupe bg-surface p-4 shadow-page">
          <div className="flex items-center gap-2">
            <Icon
              as={DownloadSimple}
              size={18}
              color="var(--color-terracotta)"
              weight="duotone"
            />
            <span className="font-sans text-sm font-medium text-ink">
              Backup
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={backupBusy}
              onClick={doExport}
              className="interactive flex flex-1 items-center justify-center gap-1.5 rounded-full border border-taupe px-3 py-2 font-sans text-sm font-medium text-softink"
            >
              <Icon
                as={DownloadSimple}
                size={15}
                color="var(--color-softink)"
                weight="bold"
              />{" "}
              Export
            </button>
            <button
              type="button"
              disabled={backupBusy}
              onClick={() => fileRef.current?.click()}
              className="interactive flex flex-1 items-center justify-center gap-1.5 rounded-full border border-taupe px-3 py-2 font-sans text-sm font-medium text-softink"
            >
              <Icon
                as={UploadSimple}
                size={15}
                color="var(--color-softink)"
                weight="bold"
              />{" "}
              Import
            </button>
            <input
              ref={fileRef}
              aria-label="Choose a Commonplace backup"
              type="file"
              accept="application/json"
              className="hidden"
              onChange={onFile}
            />
          </div>
          {pendingBackup && (
            <div className="mt-4 rounded-xl border border-rust/40 p-4">
              <h3 className="font-serif text-lg text-ink">
                Replace current data?
              </h3>
              <p className="mt-2 text-sm text-softink">
                This backup has {pendingBackup.entries.length} journal entries,{" "}
                {pendingBackup.tasks.length} tasks,{" "}
                {pendingBackup.priorities.length} priorities,{" "}
                {pendingBackup.habits.length} habits,{" "}
                {pendingBackup.moods.length} moods and{" "}
                {pendingBackup.reflections.length} reflections. Importing
                replaces all current content. Your passcode and settings stay
                the same.
              </p>
              <button
                type="button"
                disabled={backupBusy}
                onClick={doExport}
                className="mt-3 min-h-11 text-sm text-softink underline"
              >
                Export current data first
              </button>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  disabled={backupBusy}
                  onClick={restoreBackup}
                  className="min-h-11 rounded-full bg-rust px-4 text-sm font-medium text-onaccent"
                >
                  {backupBusy ? "Restoring…" : "Replace data"}
                </button>
                <button
                  type="button"
                  disabled={backupBusy}
                  onClick={() => setPendingBackup(null)}
                  className="min-h-11 px-3 text-sm text-softink"
                >
                  Cancel import
                </button>
              </div>
            </div>
          )}
          {importMsg && (
            <p className="mt-2 font-sans text-xs text-terracotta">
              {importMsg}
            </p>
          )}
        </section>

        <div className="mt-4 flex items-center gap-1.5 font-sans text-xs text-softink">
          <Icon
            as={Warning}
            size={14}
            color="var(--color-softink)"
            weight="fill"
          />
          Stored on this device. The passcode hides the app; it does not encrypt
          your data or exported backups.
        </div>
      </div>
    </BottomSheet>
  );
}
