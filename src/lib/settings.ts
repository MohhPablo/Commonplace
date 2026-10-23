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

// Theme: system (default) | paper | dark | sepia. Applied via <html data-theme>.
export type Theme = "system" | "paper" | "dark" | "sepia";
type ResolvedTheme = Exclude<Theme, "system">;

export async function getTheme(): Promise<Theme> {
  return getSetting<Theme>("theme", "system");
}

export async function setTheme(theme: Theme): Promise<void> {
  await setSetting<Theme>("theme", theme);
  applyTheme(theme);
}

const THEME_COLORS: Record<ResolvedTheme, string> = {
  paper: "#F3F1EE",
  sepia: "#F1E9DB",
  dark: "#000000",
};
let followSystem: (() => void) | null = null;

export function applyTheme(theme: Theme): void {
  // index.html reads this copy before first paint so the boot splash matches.
  try {
    localStorage.setItem("commonplace:theme", theme);
  } catch {
    // Private browsing can refuse storage; the theme still applies now.
  }
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (followSystem) media?.removeEventListener?.("change", followSystem);
  followSystem = null;
  const paint = () => {
    const resolved: ResolvedTheme =
      theme === "system" ? (media?.matches ? "dark" : "paper") : theme;
    document.documentElement.dataset.theme = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLORS[resolved]);
  };
  paint();
  if (theme === "system" && media) {
    followSystem = paint;
    media.addEventListener?.("change", paint);
  }
}

// Onboarding: whether the first-run tour has been shown.
export async function getOnboarded(): Promise<boolean> {
  return getSetting<boolean>("onboarded", false);
}

export async function setOnboarded(value: boolean): Promise<void> {
  await setSetting<boolean>("onboarded", value);
}

export type WritingSize = "small" | "default" | "large";
export const getWritingSize = () =>
  getSetting<WritingSize>("writingSize", "default");
export function applyWritingSize(size: WritingSize) {
  document.documentElement.style.setProperty(
    "--writing-size",
    { small: "17px", default: "18px", large: "21px" }[size] ?? "18px",
  );
}
export async function setWritingSize(size: WritingSize) {
  await setSetting("writingSize", size);
  applyWritingSize(size);
}
