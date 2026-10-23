import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  Bell,
  BellRinging,
  DownloadSimple,
  UploadSimple,
  Lock,
  ShieldCheck,
  TextAa,
  Check,
  CaretUpDown,
  BellSlash,
  type IconProps,
} from "@phosphor-icons/react";
import type { ComponentType, CSSProperties } from "react";
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
  const [theme, setThemeState] = useState<Theme>("system");
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
      <section className="settings-group settings-hero">
        <img src="/icons/icon.svg" alt="" />
        <div className="min-w-0">
          <h3 className="text-[20px] font-bold tracking-tight">
            Commonplace<span className="wordmark-dot">.</span>
          </h3>
          <p className="text-[15px] leading-snug text-softink">
            Journal, tasks and habits. Kept on this device.
          </p>
        </div>
      </section>

      <h3 className="settings-label">Appearance</h3>
      <section className="settings-group">
        <div className="theme-options" role="group" aria-label="Theme">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={theme === option.value}
              onClick={() => {
                void onThemeChange(option.value);
              }}
              className="theme-option"
            >
              <span
                className="theme-preview"
                style={{ background: option.preview }}
              >
                <i
                  style={{ top: "22%", background: option.ink, opacity: 0.85 }}
                />
                <i
                  style={{
                    top: "36%",
                    right: "40%",
                    background: option.ink,
                    opacity: 0.35,
                  }}
                />
                <i style={{ top: "50%", background: option.card }} />
                <i style={{ top: "62%", background: option.card }} />
              </span>
              {option.label}
              <span className="theme-check" aria-hidden="true">
                {theme === option.value && (
                  <Icon
                    as={Check}
                    size={12}
                    color="currentColor"
                    weight="bold"
                  />
                )}
              </span>
            </button>
          ))}
        </div>
        <label className="settings-row">
          <Tile icon={TextAa} color="var(--tint-orange)" />
          <span className="row-label">Writing size</span>
          <span className="settings-value">
            <select
              aria-label="Writing size"
              value={writingSize}
              onChange={(e) => {
                const size = e.target.value as WritingSize;
                void setWritingSize(size)
                  .then(() => setWritingSizeState(size))
                  .catch(() => setError("Could not save writing size."));
              }}
              className="settings-select"
            >
              <option value="small">Small</option>
              <option value="default">Default</option>
              <option value="large">Large</option>
            </select>
            <Icon as={CaretUpDown} size={14} weight="bold" />
          </span>
        </label>
      </section>

      <h3 className="settings-label">Privacy</h3>
      <section className="settings-group">
        {pinMode === "idle" ? (
          <div className="settings-row">
            <Tile icon={Lock} color="var(--tint-blue)" />
            <span className="row-label">
              Passcode
              <span className="block text-[13px] text-softink">
                {hasPassword ? "On · locks when you leave" : "Off"}
              </span>
            </span>
            {!hasPassword ? (
              <button
                type="button"
                disabled={pwBusy}
                onClick={startSet}
                className="settings-link press"
              >
                Set
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pwBusy}
                  onClick={startChange}
                  className="settings-link press"
                >
                  Change
                </button>
                <button
                  type="button"
                  disabled={pwBusy}
                  onClick={startRemove}
                  className="settings-link press"
                  style={{ "--tint": "var(--color-rust)" } as CSSProperties}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="settings-block">
            <p className="mt-2 text-center text-[17px] font-semibold">
              {pinPrompt[pinMode]}
            </p>
            <div className="mt-5">
              <PinPad
                key={pinKey}
                length={4}
                onComplete={onPin}
                disabled={pwBusy}
              />
            </div>
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setPinMode("idle");
                  setPwMsg("");
                  resetPin();
                }}
                className="link-button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
      {pwMsg && (
        <p role="status" className="settings-note">
          {pwMsg}
        </p>
      )}

      <h3 className="settings-label">Reminders</h3>
      <section className="settings-group">
        <label className="settings-row">
          <Tile icon={Bell} color="var(--tint-red)" />
          <span className="row-label">Daily reminder</span>
          <input
            aria-label="Daily reminder"
            type="time"
            value={reminderTime ?? ""}
            onChange={onTimeChange}
            className="time-field"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            void testNotification().catch(() =>
              setError("Could not send a test reminder."),
            );
          }}
          className="settings-row"
        >
          <Tile icon={BellRinging} color="var(--tint-orange)" />
          <span className="row-label">Send test notification</span>
        </button>
        {reminderTime && (
          <button
            type="button"
            className="settings-row text-rust"
            onClick={() => {
              void saveReminderTime(null)
                .then(() => setReminderTimeState(null))
                .catch(() => setError("Could not turn off reminders."));
            }}
          >
            <Tile icon={BellSlash} color="var(--tint-gray)" />
            <span className="row-label">Turn off reminder</span>
          </button>
        )}
      </section>
      <p className="settings-note">
        {notificationMsg ||
          "Reminders appear while Commonplace is open. They cannot wake a closed app."}
      </p>

      <h3 className="settings-label">Backup</h3>
      <section className="settings-group">
        <button
          type="button"
          disabled={backupBusy}
          onClick={doExport}
          className="settings-row"
        >
          <Tile icon={DownloadSimple} color="var(--tint-green)" />
          <span className="row-label">Export backup</span>
        </button>
        <button
          type="button"
          disabled={backupBusy}
          onClick={() => fileRef.current?.click()}
          className="settings-row"
        >
          <Tile icon={UploadSimple} color="var(--tint-teal)" />
          <span className="row-label">Import backup</span>
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
          <div className="settings-block">
            <h3 className="text-[17px] font-semibold">Replace current data?</h3>
            <p className="mt-2 text-[15px] leading-snug text-softink">
              This backup has {pendingBackup.entries.length} journal entries,{" "}
              {pendingBackup.tasks.length} tasks,{" "}
              {pendingBackup.priorities.length} priorities,{" "}
              {pendingBackup.habits.length} habits, {pendingBackup.moods.length}{" "}
              moods and {pendingBackup.reflections.length} reflections.
              Importing replaces all current content. Your passcode and settings
              stay the same.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={backupBusy}
                onClick={restoreBackup}
                className="native-primary press !min-h-11 !py-2"
                style={{ "--tint": "var(--color-rust)" } as CSSProperties}
              >
                {backupBusy ? "Restoring…" : "Replace data"}
              </button>
              <button
                type="button"
                disabled={backupBusy}
                onClick={doExport}
                className="settings-link press !min-h-11"
              >
                Export current data first
              </button>
              <button
                type="button"
                disabled={backupBusy}
                onClick={() => setPendingBackup(null)}
                className="link-button"
              >
                Cancel import
              </button>
            </div>
          </div>
        )}
      </section>
      {importMsg && (
        <p role="status" className="settings-note">
          {importMsg}
        </p>
      )}
      <AppUpdate />
      <p className="mx-4 mt-8 flex items-start gap-2 text-[13px] leading-relaxed text-softink">
        <Icon as={ShieldCheck} size={16} className="mt-0.5 shrink-0" />
        Stored on this device. The passcode hides the app; it does not encrypt
        your data or exported backups.
      </p>
    </BottomSheet>
  );
}

const THEMES: {
  value: Theme;
  label: string;
  preview: string;
  ink: string;
  card: string;
}[] = [
  {
    value: "system",
    label: "System",
    preview: "linear-gradient(115deg, #f3f1ee 50%, #000 50%)",
    ink: "#8e8e93",
    card: "rgb(142 142 147 / 45%)",
  },
  {
    value: "paper",
    label: "Light",
    preview: "#f3f1ee",
    ink: "#1d1d1f",
    card: "#fff",
  },
  {
    value: "sepia",
    label: "Sepia",
    preview: "#f1e9db",
    ink: "#3c332b",
    card: "#fff9ef",
  },
  {
    value: "dark",
    label: "Dark",
    preview: "#000",
    ink: "#f5f5f7",
    card: "#2c2c2e",
  },
];

/** A Settings-style rounded square icon. */
function Tile({
  icon,
  color,
}: {
  icon: ComponentType<IconProps>;
  color: string;
}) {
  return (
    <span className="icon-tile" style={{ "--tile": color } as CSSProperties}>
      <Icon as={icon} size={18} color="#fff" weight="fill" />
    </span>
  );
}
