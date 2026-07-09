import { db } from "./db";
import { getReminderTime, setReminderTime, type ReminderTime } from "./settings";

/**
 * Reminders per technical ref §4 — fully offline, no backend.
 *
 * We do NOT use Notification Triggers API (never shipped in WebKit) or any
 * scheduled-background mechanism (Background Sync / Periodic Sync unsupported).
 * Instead we offer:
 *   1. In-app "today" banner (rendered in the Habits tab / home).
 *   2. Badge API count of incomplete habits (set elsewhere).
 *   3. An opt-in Notification, fired by a foreground scheduler at the user's
 *      chosen daily time while the app/tab is open.
 *
 * `requestReminderPermission` must follow a direct user tap (§1 table / §4).
 *
 * NOTE: A PWA installed to the home screen keeps running in the background on
 * many platforms, so a foreground scheduler is the honest, WebKit-safe way to
 * deliver a daily reminder without a server. It cannot fire if the page is
 * fully closed — use the in-app banner + badge as the always-available backup.
 */

// Keep a reference so the GC doesn't drop the Notification object, and so we
// can close it programmatically.
let activeNotification: Notification | null = null;

export async function requestReminderPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/**
 * Show a persistent notification. `requireInteraction: true` keeps it on screen
 * until the user dismisses or taps it (supported on desktop + Android; iOS
 * honors it where available). Returns true if it was shown.
 */
export function showForegroundReminder(
  title: string,
  body: string,
  opts: { persistent?: boolean; tag?: string } = {},
): boolean {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }
  try {
    if (activeNotification) activeNotification.close();
    const n = new Notification(title, {
      body,
      tag: opts.tag ?? "commonplace-reminder",
      requireInteraction: opts.persistent ?? true,
    });
    activeNotification = n;
    n.onclose = () => {
      if (activeNotification === n) activeNotification = null;
    };
    return true;
  } catch {
    return false;
  }
}

// ---- Daily reminder scheduler ----------------------------------------------

let timer: ReturnType<typeof setTimeout> | null = null;
let listener: ((title: string, body: string) => void) | null = null;

/**
 * Configure the daily reminder. Reads the saved HH:MM time and arms a timer
 * that fires at that time today (or tomorrow if it already passed), then
 * re-arms for the next day. No-op when permission is missing or time is null.
 */
export async function configureReminder(): Promise<void> {
  stopReminder();
  const time = await getReminderTime();
  if (!time || Notification.permission !== "granted") return;

  const arm = () => {
    const ms = msUntilNext(time);
    timer = setTimeout(async () => {
      const [habits, logs] = await Promise.all([
        db.habits.toArray(),
        db.habitLogs.toArray(),
      ]);
      const active = habits.filter((h) => !h.archived);
      const today = new Date().toISOString().slice(0, 10);
      const left = active.filter(
        (h) => !logs.some((l) => l.habitId === h.id && l.date === today && l.completed),
      );
      if (left.length > 0) {
        const body = `${left.length} ${left.length === 1 ? "habit" : "habits"} left today: ${left
          .map((h) => h.name)
          .join(", ")}`;
        if (listener) listener("Commonplace", body);
        else showForegroundReminder("Commonplace", body);
      }
      arm(); // schedule next day
    }, ms);
  };
  arm();
}

export function stopReminder(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Register a callback invoked when the scheduled reminder fires. */
export function onReminderFire(cb: (title: string, body: string) => void): void {
  listener = cb;
}

function msUntilNext(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

/** Save the chosen time and (re)configure the scheduler. */
export async function saveReminderTime(time: ReminderTime): Promise<void> {
  await setReminderTime(time);
  await configureReminder();
}
