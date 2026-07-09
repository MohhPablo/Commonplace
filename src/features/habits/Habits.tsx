import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { db, type Habit, type HabitLog } from "../../lib/db";
import {
  currentStreak,
  isDoneOn,
  toggleToday,
} from "../../lib/habits";
import { setBadge } from "../../lib/badge";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { Repeat, Plus, Trash, Bell, Check, Flame, CaretLeft, CaretRight, CaretDown } from "@phosphor-icons/react";
import { dayKey } from "../../lib/date";
import { requestReminderPermission, showForegroundReminder, saveReminderTime } from "../../lib/notifications";
import { getReminderTime, type ReminderTime } from "../../lib/settings";
import { tap } from "../../lib/haptics";
import { MonthGrid, monthLabel } from "./MonthGrid";
import { useUndo } from "../../lib/useUndo";
import { UndoSnackbar } from "../../components/UndoSnackbar";

export function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [name, setName] = useState("");
  const [month, setMonth] = useState(() => new Date());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reminderTime, setReminderTimeState] = useState<ReminderTime>(null);
  const { pending, arm, undo, dismiss } = useUndo(() => void load());

  const load = async () => {
    const [h, l] = await Promise.all([
      db.habits.toArray(),
      db.habitLogs.toArray(),
    ]);
    const active = h.filter((x) => !x.archived);
    setHabits(active);
    setLogs(l);
    await updateBadge(h, l);
  };

  useEffect(() => {
    void load();
    void getReminderTime().then(setReminderTimeState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateBadge(h: Habit[], l: HabitLog[]) {
    const today = dayKey();
    const incomplete = h.filter((habit) => !isDoneOn(l, habit.id!, today)).length;
    await setBadge(incomplete);
  }

  async function add() {
    const n = name.trim();
    if (!n) return;
    await db.habits.add({ name: n, createdAt: Date.now(), archived: false });
    setName("");
    await load();
  }

  async function remove(id: number) {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    const relatedLogs = logs.filter((l) => l.habitId === id);
    await db.habits.delete(id);
    await db.habitLogs.where("habitId").equals(id).delete();
    await load();
    void arm(`Deleted “${habit.name}”`, async () => {
      const restoredId = await db.habits.add({ ...habit });
      if (relatedLogs.length) {
        await db.habitLogs.bulkAdd(relatedLogs.map((l) => ({ ...l, habitId: restoredId as number })));
      }
    });
  }

  async function onToggleToday(habit: Habit) {
    tap();
    await toggleToday(habit, logs);
    await load();
  }

  // In-app "today" banner: which habits still undone (ref §4.1).
  const today = dayKey();
  const undoneToday = useMemo(
    () => habits.filter((h) => !isDoneOn(logs, h.id!, today)),
    [habits, logs, today],
  );

  async function enableReminders() {
    const perm = await requestReminderPermission();
    if (perm === "granted" && !reminderTime) {
      const def = "20:00";
      setReminderTimeState(def);
      await saveReminderTime(def);
    }
  }

  async function testReminder() {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      const perm = await requestReminderPermission();
      if (perm !== "granted") return;
    }
    showForegroundReminder("Commonplace", "This is a test reminder.");
  }

  async function onTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value || null;
    setReminderTimeState(value);
    await saveReminderTime(value);
  }

  return (
    <div className="px-5 pt-20">
      {undoneToday.length > 0 && (
        <div className="mt-4 rounded-xl border border-taupe bg-surface px-4 py-3 shadow-page">
          <p className="font-sans text-sm text-ink">
            Still to do today:{" "}
            <span className="text-ink font-medium">{undoneToday.map((h) => h.name).join(", ")}</span>
          </p>
        </div>
      )}

      {habits.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          message="Start a small habit and watch its streak grow, one day at a time."
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {habits.map((h) => {
            const doneToday = isDoneOn(logs, h.id!, today);
            const streak = currentStreak(h.id!, logs);
            const doneSet = new Set(
              logs
                .filter((l) => l.habitId === h.id! && l.completed)
                .map((l) => l.date),
            );
            return (
              <li
                key={h.id}
                className="rounded-xl border border-taupe bg-surface p-4 shadow-page"
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((id) => (id === h.id ? null : h.id!))
                    }
                    aria-expanded={expandedId === h.id}
                    className="interactive flex flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2"
                      style={{
                        borderColor: doneToday ? "#4B5D45" : "#E4DCCB",
                        background: doneToday ? "#4B5D45" : "transparent",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onToggleToday(h);
                      }}
                      aria-pressed={doneToday}
                      aria-label={`Mark ${h.name} ${doneToday ? "not done" : "done"} today`}
                    >
                      {doneToday && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 600, damping: 20 }}
                        >
                          <Icon as={Check} size={18} color="#FDFBF7" weight="bold" />
                        </motion.span>
                      )}
                    </span>
                    <span className="font-serif text-lg font-semibold text-ink">
                      {h.name}
                    </span>
                    <Icon
                      as={CaretDown}
                      size={16}
                      color="#6B6058"
                      weight="bold"
                      className="ml-1 transition-transform"
                      style={{
                        transform:
                          expandedId === h.id ? "rotate(180deg)" : "none",
                      }}
                    />
                  </button>
                  <button type="button" onClick={() => remove(h.id!)} aria-label="Delete habit" className="tap-target">
                    <Icon as={Trash} size={18} color="#A8412A" weight="light" />
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  <Icon as={Flame} size={15} color="#C89B3C" weight="fill" />
                  <span className="font-sans text-sm font-medium text-ochre">
                    {streak} {streak === 1 ? "day" : "days"}
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {expandedId === h.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="mt-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                            }
                            aria-label="Previous month"
                            className="interactive"
                          >
                            <Icon as={CaretLeft} size={16} color="#6B6058" weight="bold" />
                          </button>
                          <span className="font-sans text-xs font-medium text-softink">
                            {monthLabel(month.getFullYear(), month.getMonth())}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
                            }
                            aria-label="Next month"
                            className="interactive"
                          >
                            <Icon as={CaretRight} size={16} color="#6B6058" weight="bold" />
                          </button>
                        </div>
                        <MonthGrid
                          year={month.getFullYear()}
                          month={month.getMonth()}
                          doneDates={doneSet}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-taupe bg-surface p-3 shadow-page">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New habit"
          className="flex-1 bg-transparent font-sans text-base text-ink placeholder:text-softink focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="interactive flex items-center gap-1 rounded-full bg-terracotta px-3 py-1.5 font-sans text-sm font-medium text-surface"
        >
          <Icon as={Plus} size={16} color="#FDFBF7" weight="bold" />
          Add
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-taupe pt-4">
        <button
          type="button"
          onClick={enableReminders}
          className="interactive flex items-center gap-1.5 font-sans text-xs font-medium"
          style={{ color: reminderTime ? "#2B2420" : "#6B6058" }}
        >
          <Icon as={Bell} size={15} color={reminderTime ? "#2B2420" : "#6B6058"} weight={reminderTime ? "fill" : "light"} />
          {reminderTime ? `Reminders at ${reminderTime}` : "Enable reminders"}
        </button>
        {reminderTime && (
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={reminderTime ?? ""}
              onChange={onTimeChange}
              aria-label="Daily reminder time"
              className="rounded-full border border-taupe bg-surface px-3 py-1.5 font-sans text-xs text-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={testReminder}
              className="interactive flex items-center gap-1.5 rounded-full border border-taupe px-3 py-1.5 font-sans text-xs font-medium text-softink"
            >
              <Icon as={Bell} size={15} color="#6B6058" weight="light" />
              Test
            </button>
          </div>
        )}
      </div>
      <UndoSnackbar pending={pending} onUndo={undo} onDismiss={dismiss} />
    </div>
  );
}
