import { expect, it, vi } from "vitest";
import {
  configureReminder,
  onReminderFire,
  requestReminderPermission,
  showForegroundReminder,
} from "../src/lib/notifications";
import { setSetting } from "../src/lib/settings";
import { db } from "../src/lib/db";

it("handles a saved reminder when the system notification API is absent", async () => {
  const existing = Object.getOwnPropertyDescriptor(globalThis, "Notification");
  Object.defineProperty(globalThis, "Notification", {
    value: undefined,
    configurable: true,
  });
  try {
    await setSetting("reminderTime", "20:00");
    await expect(configureReminder()).resolves.toBeUndefined();
    expect(await requestReminderPermission()).toBe("denied");
    expect(showForegroundReminder("Test", "Test")).toBe(false);
  } finally {
    if (existing) Object.defineProperty(globalThis, "Notification", existing);
    else Reflect.deleteProperty(globalThis, "Notification");
  }
});

it("uses the local habit date when a reminder fires around midnight", async () => {
  const originalZone = process.env.TZ;
  process.env.TZ = "Africa/Lagos";
  const now = new Date("2026-10-21T23:10:00Z");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  const id = await db.habits.add({
    name: "Already done locally",
    createdAt: 1,
    archived: false,
  });
  await db.habitLogs.add({ habitId: id, date: "2026-10-22", completed: true });
  await setSetting("reminderTime", "00:11");
  let fire: (() => Promise<void>) | undefined;
  const timeout = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
    callback: () => Promise<void>,
    delay: number,
  ) => {
    if (delay === 60_000) fire = callback;
    return 1;
  }) as typeof setTimeout);
  const listener = vi.fn();
  const unsubscribe = onReminderFire(listener);
  try {
    await configureReminder();
    expect(fire).toBeTypeOf("function");
    await fire!();
    expect(listener).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
    timeout.mockRestore();
    vi.useRealTimers();
    if (originalZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalZone;
  }
});
