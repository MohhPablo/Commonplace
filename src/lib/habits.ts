import { db, type Habit, type HabitLog } from "./db";
import { dayKey, fromDayKey } from "./date";

/** Compute the current consecutive-day streak ending today (or yesterday). */
export function currentStreak(habitId: number, logs: HabitLog[]): number {
  const done = new Set(
    logs.filter((l) => l.habitId === habitId && l.completed).map((l) => l.date),
  );
  if (done.size === 0) return 0;

  let streak = 0;
  const today = dayKey();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y);

  // Streak counts from today if done today, else from yesterday (grace).
  let cursor = done.has(today) ? today : done.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;

  while (cursor && done.has(cursor)) {
    streak += 1;
    const d = fromDayKey(cursor);
    d.setDate(d.getDate() - 1);
    cursor = dayKey(d);
  }
  return streak;
}

/** True if the habit is logged complete for the given day key. */
export function isDoneOn(logs: HabitLog[], habitId: number, key: string): boolean {
  return logs.some((l) => l.habitId === habitId && l.date === key && l.completed);
}

/** Toggle today's completion for a habit (spec §5.4 one-tap today). */
export async function toggleToday(habit: Habit, logs: HabitLog[]): Promise<boolean> {
  const key = dayKey();
  const existing = logs.find((l) => l.habitId === habit.id! && l.date === key);
  const next = !(existing?.completed ?? false);
  if (existing) {
    await db.habitLogs.update(existing.id!, { completed: next });
  } else {
    await db.habitLogs.add({ habitId: habit.id!, date: key, completed: next });
  }
  return next;
}
