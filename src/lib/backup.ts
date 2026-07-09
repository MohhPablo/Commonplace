import { db, type BackupData } from "./db";

/** Build a single timestamped JSON snapshot of all on-device data. */
export async function exportData(): Promise<BackupData> {
  const [entries, tasks, priorities, habits, habitLogs, moods, reflections] =
    await Promise.all([
      db.entries.toArray(),
      db.tasks.toArray(),
      db.priorities.toArray(),
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.moods.toArray(),
      db.reflections.toArray(),
    ]);
  return {
    version: 1,
    exportedAt: Date.now(),
    entries,
    tasks,
    priorities,
    habits,
    habitLogs,
    moods,
    reflections,
  };
}

/** Trigger a browser download of the backup as a JSON file. */
export function downloadBackup(data: BackupData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date(data.exportedAt).toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `commonplace-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Replace all local data with the contents of an imported backup. */
export async function importData(data: BackupData): Promise<void> {
  if (data.version !== 1) {
    throw new Error(`Unsupported backup version: ${data.version}`);
  }
  await db.transaction(
    "rw",
    [db.entries, db.tasks, db.priorities, db.habits, db.habitLogs, db.moods, db.reflections],
    async () => {
      await Promise.all([
        db.entries.clear(),
        db.tasks.clear(),
        db.priorities.clear(),
        db.habits.clear(),
        db.habitLogs.clear(),
        db.moods.clear(),
        db.reflections.clear(),
      ]);
      await Promise.all([
        db.entries.bulkAdd(data.entries),
        db.tasks.bulkAdd(data.tasks),
        db.priorities.bulkAdd(data.priorities),
        db.habits.bulkAdd(data.habits),
        db.habitLogs.bulkAdd(data.habitLogs),
        db.moods.bulkAdd(data.moods ?? []),
        db.reflections.bulkAdd(data.reflections ?? []),
      ]);
    },
  );
}
