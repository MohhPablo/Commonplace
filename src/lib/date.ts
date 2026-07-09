/** Date helpers — all local-time, day-granularity for habit logs. */

/** Local day key: YYYY-MM-DD (not UTC, so "today" matches the user's clock). */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD key back into a local Date at midnight. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Editorial "dateline" style: e.g. "Wednesday, 9 July 2026". */
export function formatDateline(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Short date for list rows: e.g. "9 Jul 2026". */
export function formatShort(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Relative-ish, friendly timestamp for metadata: "Today", "Yesterday", or date. */
export function formatRelative(ts: number): string {
  const today = dayKey();
  const that = dayKey(new Date(ts));
  if (today === that) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (dayKey(y) === that) return "Yesterday";
  return formatShort(ts);
}

/** ISO date string (YYYY-MM-DD) for an optional due date input value. */
export function toDateInputValue(key: string | null): string {
  return key ?? "";
}

/** Number of days between two day keys (b - a), positive if b is later. */
export function daysBetween(a: string, b: string): number {
  const ms = fromDayKey(b).getTime() - fromDayKey(a).getTime();
  return Math.round(ms / 86_400_000);
}
