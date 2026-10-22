import { db, type BackupData } from "./db";
import { dayKey, fromDayKey } from "./date";
import { flushPendingSaves } from "./autosave";

type Row = Record<string, unknown>;
const fail = (): never => {
  throw new Error("This backup contains invalid or incomplete data.");
};
const record = (value: unknown): Row =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : fail();
const number = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fail();
const integer = (value: unknown): number =>
  Number.isSafeInteger(number(value)) ? (value as number) : fail();
const id = (value: unknown): number =>
  integer(value) > 0 ? (value as number) : fail();
const text = (value: unknown): string =>
  typeof value === "string" ? value : fail();
const bool = (value: unknown): boolean =>
  typeof value === "boolean" ? value : fail();
const nullableTime = (value: unknown): number | null =>
  value === null ? null : number(value);
const date = (value: unknown): string => {
  const key = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && dayKey(fromDayKey(key)) === key
    ? key
    : fail();
};

/** Copy supported editor structure only; never carry arbitrary DOM attributes. */
function documentNode(value: unknown, depth = 0): Row {
  if (depth > 64) fail();
  const node = record(value);
  const type = text(node.type);
  if (
    ![
      "doc",
      "paragraph",
      "text",
      "heading",
      "bulletList",
      "orderedList",
      "listItem",
      "blockquote",
      "horizontalRule",
      "hardBreak",
      "codeBlock",
    ].includes(type)
  )
    fail();
  const result: Row = { type };
  if (type === "text") result.text = text(node.text);
  if (node.content !== undefined) {
    if (!Array.isArray(node.content)) return fail();
    result.content = node.content.map((child) =>
      documentNode(child, depth + 1),
    );
  }
  if (node.marks !== undefined) {
    if (!Array.isArray(node.marks)) return fail();
    result.marks = node.marks.map((mark) => {
      const kind = text(record(mark).type);
      if (!["bold", "italic", "strike", "code"].includes(kind)) fail();
      return { type: kind };
    });
  }
  if (node.attrs !== undefined) {
    const attrs = record(node.attrs);
    if (type === "heading") {
      if (![1, 2, 3, 4, 5, 6].includes(integer(attrs.level))) fail();
      result.attrs = { level: attrs.level };
    } else if (type === "orderedList")
      result.attrs = { start: id(attrs.start ?? 1) };
    else if (type === "codeBlock")
      result.attrs = {
        language: attrs.language == null ? null : text(attrs.language),
      };
  }
  return result;
}

export function validateBackup(value: unknown): BackupData {
  const input = record(value);
  if (input.version !== 1)
    throw new Error("This backup version is not supported.");
  function rows<T>(
    name: string,
    parse: (row: Row) => T,
    optional = false,
  ): T[] {
    const values = input[name] ?? (optional ? [] : fail());
    if (!Array.isArray(values)) return fail();
    const ids = new Set<number>();
    return values.map((item: unknown) => {
      const row = record(item);
      const key = id(row.id);
      if (ids.has(key)) fail();
      ids.add(key);
      return parse(row);
    });
  }
  const entries = rows("entries", (r) => {
    const content = r.content === "" ? "" : documentNode(r.content);
    if (content !== "" && content.type !== "doc") fail();
    return {
      id: id(r.id),
      createdAt: number(r.createdAt),
      updatedAt: number(r.updatedAt),
      wordCount: integer(r.wordCount),
      content,
    };
  });
  const tasks = rows("tasks", (r) => ({
    id: id(r.id),
    text: text(r.text),
    dueDate: r.dueDate === null ? null : date(r.dueDate),
    completed: bool(r.completed),
    completedAt: nullableTime(r.completedAt),
    createdAt: number(r.createdAt),
  }));
  const priorities = rows("priorities", (r) => {
    if (r.list !== "needs" && r.list !== "wants") fail();
    return {
      id: id(r.id),
      list: r.list as "needs" | "wants",
      text: text(r.text),
      order: integer(r.order),
      fulfilled: bool(r.fulfilled),
      fulfilledAt: nullableTime(r.fulfilledAt),
      createdAt: number(r.createdAt),
    };
  });
  const habits = rows("habits", (r) => ({
    id: id(r.id),
    name: text(r.name),
    createdAt: number(r.createdAt),
    archived: bool(r.archived),
  }));
  const habitIds = new Set(habits.map((h) => h.id));
  const habitLogs = rows("habitLogs", (r) => {
    if (!habitIds.has(id(r.habitId))) fail();
    return {
      id: id(r.id),
      habitId: id(r.habitId),
      date: date(r.date),
      completed: bool(r.completed),
    };
  });
  const moods = rows(
    "moods",
    (r) => {
      const score = integer(r.score);
      if (score < 1 || score > 5) fail();
      return {
        id: id(r.id),
        date: date(r.date),
        score,
        ...(r.label == null ? {} : { label: text(r.label) }),
        createdAt: number(r.createdAt),
      };
    },
    true,
  );
  const reflections = rows(
    "reflections",
    (r) => ({
      id: id(r.id),
      date: date(r.date),
      content: text(r.content),
      createdAt: number(r.createdAt),
    }),
    true,
  );
  // Older backups may predate the unique daily indexes. Last record wins.
  const unique = <T>(items: T[], key: (item: T) => string): T[] => [
    ...new Map(items.map((item) => [key(item), item])).values(),
  ];
  return {
    version: 1,
    exportedAt: number(input.exportedAt),
    entries,
    tasks,
    priorities,
    habits,
    habitLogs: unique(habitLogs, (r) => `${r.habitId}:${r.date}`),
    moods: unique(moods, (r) => r.date),
    reflections: unique(reflections, (r) => r.date),
  };
}

/** Build a single timestamped JSON snapshot of all on-device data. */
export async function exportData(): Promise<BackupData> {
  await flushPendingSaves();
  return db.transaction(
    "r",
    [
      db.entries,
      db.tasks,
      db.priorities,
      db.habits,
      db.habitLogs,
      db.moods,
      db.reflections,
    ],
    async () => {
      const [
        entries,
        tasks,
        priorities,
        habits,
        habitLogs,
        moods,
        reflections,
      ] = await Promise.all([
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
    },
  );
}

/** Trigger a browser download of the backup as a JSON file. */
export function downloadBackup(data: BackupData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = dayKey(new Date(data.exportedAt));
  const a = document.createElement("a");
  a.href = url;
  a.download = `commonplace-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Replace all local data with the contents of an imported backup. */
export async function importData(value: unknown): Promise<void> {
  const data = validateBackup(value);
  await flushPendingSaves();
  await db.transaction(
    "rw",
    [
      db.entries,
      db.tasks,
      db.priorities,
      db.habits,
      db.habitLogs,
      db.moods,
      db.reflections,
    ],
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
