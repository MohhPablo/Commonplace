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
