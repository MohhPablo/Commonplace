import { describe, expect, it } from "vitest";
import Dexie from "dexie";
import { db, type BackupData } from "../src/lib/db";
import {
  setPassword,
  verifyPassword,
  clearPassword,
  isPasswordSet,
  resetAllData,
} from "../src/lib/auth";
import { exportData, importData, validateBackup } from "../src/lib/backup";
import { toggleToday } from "../src/lib/habits";
import { getSetting, setSetting } from "../src/lib/settings";
import { dayKey } from "../src/lib/date";
import { createAutosave } from "../src/lib/autosave";

function backup(): BackupData {
  return {
    version: 1,
    exportedAt: Date.now(),
    entries: [
      {
        id: 1,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "A real entry" }],
            },
          ],
        },
        createdAt: 1,
        updatedAt: 2,
        wordCount: 3,
      },
    ],
    tasks: [
      {
        id: 1,
        text: "Read",
        dueDate: null,
        completed: false,
        completedAt: null,
        createdAt: 1,
      },
    ],
    priorities: [
      {
        id: 1,
        list: "needs",
        text: "A desk",
        order: 0,
        fulfilled: false,
        fulfilledAt: null,
        createdAt: 1,
      },
    ],
    habits: [{ id: 1, name: "Read", createdAt: 1, archived: false }],
    habitLogs: [{ id: 1, habitId: 1, date: "2026-10-22", completed: true }],
    moods: [{ id: 1, date: "2026-10-22", score: 4, createdAt: 1 }],
    reflections: [
      { id: 1, date: "2026-10-22", content: "A quiet day", createdAt: 1 },
    ],
  };
}

describe("PIN storage", () => {
  it("changes and removes the only credential", async () => {
    await setPassword("2468");
    await setPassword("8642");
    expect(await verifyPassword("2468")).toBe(false);
    expect(await verifyPassword("8642")).toBe(true);
    expect(await db.meta.where("key").equals("authHash").count()).toBe(1);
    await clearPassword();
    expect(await isPasswordSet()).toBe(false);
  });
  it("serializes simultaneous writes to the same setting", async () => {
    await Promise.all([
      setSetting("theme", "dark"),
      setSetting("theme", "sepia"),
    ]);
    expect(await db.meta.where("key").equals("setting:theme").count()).toBe(1);
    expect(await getSetting("theme", "paper")).toBe("sepia");
  });
});

describe("backup and reset", () => {
  it("roundtrips every content table without clearing device settings", async () => {
    await setSetting("theme", "dark");
    await importData(backup());
    const result = await exportData();
    expect({ ...result, exportedAt: 0 }).toEqual({
      ...backup(),
      exportedAt: 0,
    });
    expect(await getSetting("theme", "paper")).toBe("dark");
  });
  it("flushes current writing into an exported backup", async () => {
    await importData(backup());
    const writer = createAutosave<string>((content) =>
      db.reflections.update(1, { content }),
    );
    writer.schedule("Latest writing");
    expect((await exportData()).reflections[0].content).toBe("Latest writing");
  });
  it.each([
    [
      "missing entry fields",
      (data: BackupData) => {
        data.entries = [{ id: 8, content: "broken" }] as never;
      },
    ],
    [
      "invalid date",
      (data: BackupData) => {
        data.habitLogs[0].date = "2026-02-31";
      },
    ],
    [
      "orphan log",
      (data: BackupData) => {
        data.habitLogs[0].habitId = 999;
      },
    ],
    [
      "out of range mood",
      (data: BackupData) => {
        data.moods[0].score = 6;
      },
    ],
    [
      "duplicate IDs",
      (data: BackupData) => {
        data.tasks.push({ ...data.tasks[0] });
      },
    ],
  ])("rejects %s without replacing existing data", async (_label, mutate) => {
    await importData(backup());
    const invalid = backup();
    mutate(invalid);
    await expect(importData(invalid)).rejects.toThrow();
    expect((await db.entries.get(1))?.wordCount).toBe(3);
    expect(await db.habits.count()).toBe(1);
  });
  it("supports older version-one backups without review tables", () => {
    const old = backup() as unknown as Record<string, unknown>;
    delete old.moods;
    delete old.reflections;
    expect(validateBackup(old).moods).toEqual([]);
  });
  it("copies only supported editor attributes", () => {
    const data = backup();
    data.entries[0].content = JSON.parse(
      '{"type":"doc","content":[{"type":"heading","attrs":{"level":2,"onerror":"unsafe","__proto__":{"src":"unsafe"}},"content":[{"type":"text","text":"Heading"}]}]}',
    );
    expect(validateBackup(data).entries[0].content).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Heading" }],
        },
      ],
    });
  });
  it("clears all tables and cancels pending writes before reset", async () => {
    await importData(backup());
    await setPassword("2468");
    const writer = createAutosave<string>((content) =>
      db.reflections.put({ id: 1, date: "2026-10-22", content, createdAt: 1 }),
    );
    writer.schedule("Must not reappear");
    await resetAllData();
    await writer.flush();
    expect(await Promise.all(db.tables.map((table) => table.count()))).toEqual(
      db.tables.map(() => 0),
    );
  });
});

describe("daily completion", () => {
  it("serializes two toggles into one daily log with the final state off", async () => {
    const id = await db.habits.add({
      name: "Read",
      createdAt: 1,
      archived: false,
    });
    const habit = (await db.habits.get(id))!;
    expect(await Promise.all([toggleToday(habit), toggleToday(habit)])).toEqual(
      [true, false],
    );
    expect(await db.habitLogs.toArray()).toEqual([
      expect.objectContaining({
        habitId: id,
        date: dayKey(),
        completed: false,
      }),
    ]);
  });
});

it("upgrades v3 data, preserving the effective PIN and repairing duplicates before uniqueness", async () => {
  await setPassword("2468");
  const originalCredential = (await db.meta.toArray())[0];
  await setPassword("8642");
  const replacementCredential = (await db.meta.toArray())[0];
  await db.delete();
  const old = new Dexie("commonplace");
  old
    .version(3)
    .stores({
      entries: "++id, createdAt, updatedAt",
      tasks: "++id, completed, dueDate, createdAt",
      priorities: "++id, list, order, fulfilled, createdAt",
      habits: "++id, archived, createdAt",
      habitLogs: "++id, habitId, date, [habitId+date]",
      meta: "++id, key",
      moods: "++id, date, createdAt",
      reflections: "++id, date, createdAt",
    });
  await old.open();
  await old.table("meta").bulkAdd([
    { key: "authHash", value: originalCredential.value },
    { key: "authHash", value: replacementCredential.value },
    { key: "setting:theme", value: "paper" },
    { key: "setting:theme", value: "dark" },
  ]);
  await old.table("habitLogs").bulkAdd([
    { habitId: 7, date: "2026-10-22", completed: false },
    { habitId: 7, date: "2026-10-22", completed: true },
  ]);
  await old.table("entries").add(backup().entries[0]);
  old.close();
  await db.open();
  expect(await verifyPassword("2468")).toBe(true);
  expect(await db.meta.where("key").equals("authHash").count()).toBe(1);
  expect(await getSetting("theme", "paper")).toBe("dark");
  expect(await db.habitLogs.count()).toBe(1);
  expect((await db.habitLogs.toArray())[0].completed).toBe(true);
  expect((await db.entries.get(1))?.wordCount).toBe(3);
  await expect(
    db.habitLogs.add({ habitId: 7, date: "2026-10-22", completed: false }),
  ).rejects.toThrow();
});
