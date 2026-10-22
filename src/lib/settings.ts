import { db } from "./db";

/** Key/value settings persisted in the meta table (IndexedDB). */
const PREFIX = "setting:";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta
    .where("key")
    .equals(PREFIX + key)
    .first();
  if (!row) return fallback;
  return row.value as T;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.transaction("rw", db.meta, async () => {
    const existing = await db.meta
      .where("key")
      .equals(PREFIX + key)
      .first();
    if (existing?.id != null) {
      await db.meta.update(existing.id, { value });
    } else {
      await db.meta.put({ key: PREFIX + key, value });
    }
  });
}

// Daily reminder at a user-chosen "HH:MM" local time, or null when disabled.
export type ReminderTime = string | null;

export async function getReminderTime(): Promise<ReminderTime> {
  return getSetting<ReminderTime>("reminderTime", null);
}

export async function setReminderTime(time: ReminderTime): Promise<void> {
  await setSetting<ReminderTime>("reminderTime", time);
}

// Theme: paper (default) | dark | sepia. Applied via <html data-theme>.
export type Theme = "paper" | "dark" | "sepia";

export async function getTheme(): Promise<Theme> {
  return getSetting<Theme>("theme", "paper");
}

export async function setTheme(theme: Theme): Promise<void> {
  await setSetting<Theme>("theme", theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    {
      paper: "#F2F2F5",
      sepia: "#F1E4CF",
      dark: "#101218",
    }[theme],
  );
}

// Onboarding: whether the first-run tour has been shown.
export async function getOnboarded(): Promise<boolean> {
  return getSetting<boolean>("onboarded", false);
}

export async function setOnboarded(value: boolean): Promise<void> {
  await setSetting<boolean>("onboarded", value);
}
