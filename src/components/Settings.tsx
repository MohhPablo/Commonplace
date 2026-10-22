import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  Bell,
  DownloadSimple,
  UploadSimple,
  Lock,
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
  getWritingSize,
  setWritingSize,
  type WritingSize,
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
import { AppUpdate } from "./AppUpdate";
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
  const [writingSize, setWritingSizeState] = useState<WritingSize>("default");
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
    void getWritingSize()
      .then(setWritingSizeState)
      .catch(() => setError("Could not read writing preferences."));
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
      page
      title="Settings"
      onClose={() => {
        if (!pwBusy && !backupBusy) onClose();
      }}
    >
      <InlineError>{error}</InlineError>
      <section className="settings-group">
        <h3 className="section-title">Appearance</h3>
        <label className="settings-row">
          <span>Theme</span>
          <select
            aria-label="Theme"
            value={theme}
            onChange={(e) => {
              void onThemeChange(e.target.value as Theme);
            }}
            className="bg-transparent text-right text-softink"
          >
            <option value="paper">Light</option>
            <option value="sepia">Sepia</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="settings-row border-t border-taupe">
          <span>Writing size</span>
          <select
            aria-label="Writing size"
            value={writingSize}
            onChange={(e) => {
              const size = e.target.value as WritingSize;
              void setWritingSize(size)
                .then(() => setWritingSizeState(size))
                .catch(() => setError("Could not save writing size."));
            }}
            className="bg-transparent text-right text-softink"
          >
            <option value="small">Small</option>
            <option value="default">Default</option>
            <option value="large">Large</option>
          </select>
        </label>
      </section>
      <section className="settings-group">
        <h3 className="section-title flex items-center gap-2">
          <Icon as={Lock} size={17} /> Privacy
        </h3>
        {pinMode === "idle" ? (
          <>
            <div className="settings-row">
              <span>App passcode</span>
              <span className="text-sm text-softink">
                {hasPassword ? "On" : "Off"}
              </span>
            </div>
            {!hasPassword ? (
              <button
                type="button"
                disabled={pwBusy}
                onClick={startSet}
                className="settings-link"
              >
                Set
              </button>
            ) : (
              <div className="flex gap-6">
                <button
                  type="button"
                  disabled={pwBusy}
                  onClick={startChange}
                  className="settings-link"
                >
                  Change
                </button>
                <button
                  type="button"
                  disabled={pwBusy}
                  onClick={startRemove}
                  className="settings-link text-rust"
                >
                  Remove
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mt-3 text-center text-sm text-softink">
              {pinPrompt[pinMode]}
            </p>
            <div className="mt-4">
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
              className="settings-link w-full"
            >
              Cancel
            </button>
          </>
        )}
        {pwMsg && (
          <p role="status" className="mt-2 text-sm text-softink">
            {pwMsg}
          </p>
        )}
      </section>
      <section className="settings-group">
        <h3 className="section-title flex items-center gap-2">
          <Icon as={Bell} size={17} /> Reminders
        </h3>
        <label className="settings-row">
          <span>Daily reminder</span>
          <input
            aria-label="Daily reminder"
            type="time"
            value={reminderTime ?? ""}
            onChange={onTimeChange}
            className="!w-32 rounded-lg bg-paper px-2 py-2"
          />
        </label>
        <p className="mt-2 text-[13px] leading-relaxed text-softink">
          Reminders appear while Commonplace is open. They cannot wake a closed
          app.
        </p>
        <button
          type="button"
          onClick={() => {
            void testNotification().catch(() =>
              setError("Could not send a test reminder."),
            );
          }}
          className="settings-link mt-2"
        >
          Send test notification
        </button>
        {reminderTime && (
          <button
            type="button"
            className="settings-link block"
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
      <section className="settings-group">
        <h3 className="section-title">Backup</h3>
        <button
          type="button"
          disabled={backupBusy}
          onClick={doExport}
          className="settings-row text-terracotta"
        >
          <span>Export backup</span>
          <Icon as={DownloadSimple} size={20} color="var(--color-terracotta)" />
        </button>
        <button
          type="button"
          disabled={backupBusy}
          onClick={() => fileRef.current?.click()}
          className="settings-row border-t border-taupe text-terracotta"
        >
          <span>Import backup</span>
          <Icon as={UploadSimple} size={20} color="var(--color-terracotta)" />
        </button>
        <input
          ref={fileRef}
          aria-label="Choose a Commonplace backup"
          type="file"
          accept="application/json"
          className="hidden"
          onChange={onFile}
        />
        {pendingBackup && (
          <div className="mt-4 rounded-xl border border-rust p-4">
            <h3 className="text-base font-semibold">Replace current data?</h3>
            <p className="mt-2 text-sm text-softink">
              This backup has {pendingBackup.entries.length} journal entries,{" "}
              {pendingBackup.tasks.length} tasks,{" "}
              {pendingBackup.priorities.length} priorities,{" "}
              {pendingBackup.habits.length} habits, {pendingBackup.moods.length}{" "}
              moods and {pendingBackup.reflections.length} reflections.
              Importing replaces all current content. Your passcode and settings
              stay the same.
            </p>
            <button
              type="button"
              disabled={backupBusy}
              onClick={doExport}
              className="settings-link mt-2"
            >
              Export current data first
            </button>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={backupBusy}
                onClick={restoreBackup}
                className="native-primary !bg-rust"
              >
                {backupBusy ? "Restoring…" : "Replace data"}
              </button>
              <button
                type="button"
                disabled={backupBusy}
                onClick={() => setPendingBackup(null)}
                className="settings-link"
              >
                Cancel import
              </button>
            </div>
          </div>
        )}
        {importMsg && (
          <p role="status" className="mt-2 text-sm text-softink">
            {importMsg}
          </p>
        )}
      </section>
      <AppUpdate />
      <p className="mt-6 flex items-start gap-2 text-[13px] leading-relaxed text-softink">
        <Icon as={Warning} size={16} className="mt-0.5 shrink-0" />
        Stored on this device. The passcode hides the app; it does not encrypt
        your data or exported backups.
      </p>
    </BottomSheet>
  );
}
