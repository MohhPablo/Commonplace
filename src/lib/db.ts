import Dexie, { type Table } from "dexie";

export interface Entry {
  id?: number;
  createdAt: number;
  updatedAt: number;
  content: unknown; // Tiptap JSON
  wordCount: number;
}

export interface Task {
  id?: number;
  text: string;
  dueDate: string | null; // ISO date or null
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
}

export type PriorityList = "needs" | "wants";

export interface Priority {
  id?: number;
  list: PriorityList;
  text: string;
  order: number;
  fulfilled: boolean;
  fulfilledAt: number | null;
  createdAt: number;
}

export interface Habit {
  id?: number;
  name: string;
  createdAt: number;
  archived: boolean;
}

export interface HabitLog {
  id?: number;
  habitId: number;
  date: string; // day granularity: YYYY-MM-DD
  completed: boolean;
}

export interface Mood {
  id?: number;
  date: string; // day granularity: YYYY-MM-DD
  score: number; // 1-5
  label?: string; // optional descriptor, e.g. "calm"
  createdAt: number;
}

export interface Reflection {
  id?: number;
  date: string; // day granularity: YYYY-MM-DD
  content: string;
  createdAt: number;
}

export interface MetaRow {
  id?: number;
  key: string;
  value: unknown;
}

export interface BackupData {
  version: 1;
  exportedAt: number;
  entries: Entry[];
  tasks: Task[];
  priorities: Priority[];
  habits: Habit[];
  habitLogs: HabitLog[];
  moods: Mood[];
  reflections: Reflection[];
}

export class CommonplaceDB extends Dexie {
  entries!: Table<Entry, number>;
  tasks!: Table<Task, number>;
  priorities!: Table<Priority, number>;
  habits!: Table<Habit, number>;
  habitLogs!: Table<HabitLog, number>;
  moods!: Table<Mood, number>;
  reflections!: Table<Reflection, number>;
  meta!: Table<MetaRow, number>;

  constructor() {
    super("commonplace");
    this.version(1).stores({
      entries: "++id, createdAt, updatedAt",
      tasks: "++id, completed, dueDate, createdAt",
      priorities: "++id, list, order, fulfilled, createdAt",
      habits: "++id, archived, createdAt",
      habitLogs: "++id, habitId, date, [habitId+date]",
    });
    this.version(2).stores({
      entries: "++id, createdAt, updatedAt",
      tasks: "++id, completed, dueDate, createdAt",
      priorities: "++id, list, order, fulfilled, createdAt",
      habits: "++id, archived, createdAt",
      habitLogs: "++id, habitId, date, [habitId+date]",
      meta: "++id, key",
    });
    this.version(3).stores({
      entries: "++id, createdAt, updatedAt",
      tasks: "++id, completed, dueDate, createdAt",
      priorities: "++id, list, order, fulfilled, createdAt",
      habits: "++id, archived, createdAt",
      habitLogs: "++id, habitId, date, [habitId+date]",
      meta: "++id, key",
      moods: "++id, date, createdAt",
      reflections: "++id, date, createdAt",
    });
    // Repair older installations before adding unique indexes. Keep the
    // credential that previously unlocked the app; other settings use latest.
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        for (const [name, key] of [
          ["meta", "key"],
          ["habitLogs", "daily"],
          ["moods", "date"],
          ["reflections", "date"],
        ]) {
          const rows = await tx.table(name).toArray();
          const kept = new Map<string, { id: number }>();
          const remove: number[] = [];
          for (const row of rows) {
            const value =
              key === "daily" ? `${row.habitId}:${row.date}` : String(row[key]);
            const previous = kept.get(value);
            if (previous) {
              if (name === "meta" && value === "authHash") {
                remove.push(row.id);
                continue;
              }
              remove.push(previous.id);
            }
            kept.set(value, row);
          }
          await tx.table(name).bulkDelete(remove);
        }
      });
    this.version(5).stores({
      meta: "++id, &key",
      habitLogs: "++id, habitId, date, &[habitId+date]",
      moods: "++id, &date, createdAt",
      reflections: "++id, &date, createdAt",
    });
  }
}

export const db = new CommonplaceDB();

/**
 * Request persistent storage once on first load (spec §6 / technical ref §3).
 * Best-effort: Safari usually grants for installed apps but is not guaranteed.
 * Guards so a rejection never crashes the app.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore — storage still works as best-effort */
  }
  return false;
}
