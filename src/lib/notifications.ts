import { db } from "./db";
import { dayKey } from "./date";
import {
  getReminderTime,
  setReminderTime,
  type ReminderTime,
} from "./settings";

/** Local reminders run only while the app is open; there is no background push. */

// Keep a reference so the GC doesn't drop the Notification object, and so we
// can close it programmatically.
let activeNotification: Notification | null = null;

export async function requestReminderPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
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
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
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
let generation = 0;

/**
 * Configure the daily reminder. Reads the saved HH:MM time and arms a timer
 * that fires at that time today (or tomorrow if it already passed), then
 * re-arms for the next day. The in-app reminder works without system permission.
 */
export async function configureReminder(): Promise<void> {
  stopReminder();
  const run = generation;
  const time = await getReminderTime();
  if (run !== generation || !time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
    return;

  const arm = () => {
    if (run !== generation) return;
    const ms = msUntilNext(time);
    timer = setTimeout(async () => {
      try {
        const [habits, logs] = await Promise.all([
          db.habits.toArray(),
          db.habitLogs.toArray(),
        ]);
        const active = habits.filter((h) => !h.archived);
        if (run !== generation) return;
        const today = dayKey();
        const left = active.filter(
          (h) =>
            !logs.some(
              (l) => l.habitId === h.id && l.date === today && l.completed,
            ),
        );
        if (left.length > 0) {
          const body = `${left.length} ${left.length === 1 ? "habit" : "habits"} left today: ${left
            .map((h) => h.name)
            .join(", ")}`;
          listener?.("Commonplace", body);
          showForegroundReminder("Commonplace", body);
        }
      } catch {
        /* A temporary storage failure must not stop tomorrow’s reminder. */
      } finally {
        arm();
      }
    }, ms);
  };
  arm();
}

export function stopReminder(): void {
  generation += 1;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Register a callback invoked when the scheduled reminder fires. */
export function onReminderFire(
  cb: (title: string, body: string) => void,
): () => void {
  listener = cb;
  return () => {
    if (listener === cb) listener = null;
  };
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
