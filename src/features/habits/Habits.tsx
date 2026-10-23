import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { db, type Habit, type HabitLog } from "../../lib/db";
import { currentStreak, isDoneOn, toggleToday } from "../../lib/habits";
import { setBadge } from "../../lib/badge";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import {
  Repeat,
  Archive,
  Check,
  Flame,
  CaretLeft,
  CaretRight,
  CaretDown,
  Bell,
} from "@phosphor-icons/react";
import { dayKey } from "../../lib/date";
import { ProgressRing } from "../../components/ProgressRing";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { tap } from "../../lib/haptics";
import { MonthGrid, monthLabel } from "./MonthGrid";
import { useUndo } from "../../lib/useUndo";
import { UndoSnackbar } from "../../components/UndoSnackbar";
import { FAB } from "../../components/FAB";
import { useAction } from "../../lib/useAction";
import { InlineError } from "../../components/InlineError";
import { BottomSheet } from "../../components/BottomSheet";

export function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [name, setName] = useState("");
  const [month, setMonth] = useState(() => new Date());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const action = useAction();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { pending, arm, undo, dismiss } = useUndo(() => {
    void load().catch(() =>
      action.setError("Could not refresh this list. Please reopen the app."),
    );
  });

  const load = async () => {
    const [h, l] = await Promise.all([
      db.habits.toArray(),
      db.habitLogs.toArray(),
    ]);
    const active = h.filter((x) => !x.archived);
    setHabits(active);
    setLogs(l);
    await updateBadge(active, l);
  };

  useEffect(() => {
    void load().catch(() => action.setError("Could not load habits."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateBadge(h: Habit[], l: HabitLog[]) {
    const today = dayKey();
    const incomplete = h.filter(
      (habit) => !isDoneOn(l, habit.id!, today),
    ).length;
    await setBadge(incomplete);
  }

  async function add() {
    const value = name.trim();
    if (!value) return;
    await action.run(async () => {
      await db.habits.add({
        name: value,
        createdAt: Date.now(),
        archived: false,
      });
      setName("");
      setSheetOpen(false);
      await load();
    });
  }

  async function remove(id: number) {
    await action.run(async () => {
      await db.habits.update(id, { archived: true });
      await load();
      arm("Habit archived", () => db.habits.update(id, { archived: false }));
    });
  }

  async function onToggleToday(habit: Habit) {
    tap();
    await action.run(async () => {
      await toggleToday(habit);
      await load();
    });
  }

  const today = dayKey();
  const doneCount = habits.filter((h) => isDoneOn(logs, h.id!, today)).length;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      key: dayKey(d),
      letter: d.toLocaleDateString(undefined, { weekday: "narrow" }),
    };
  });

  return (
    <div className="screen-pad">
      <FAB onPress={() => setSheetOpen(true)} label="New habit" />
      {!sheetOpen && <InlineError>{action.error}</InlineError>}
      {habits.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          message="Start a small habit and watch its streak grow, one day at a time."
          action={
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="native-primary press"
            >
              Start a habit
            </button>
          }
        />
      ) : (
        <>
          <section className="card ring-card">
            <ProgressRing
              size={76}
              stroke={11}
              rings={[
                {
                  label: "Habits done today",
                  value: doneCount / habits.length,
                  color: "var(--tint)",
                },
              ]}
            >
              <span className="rounded-num text-[17px] font-bold">
                <AnimatedNumber value={doneCount} />/{habits.length}
              </span>
            </ProgressRing>
            <div className="min-w-0">
              <h2>
                {doneCount === habits.length
                  ? "All done today"
                  : doneCount === 0
                    ? "A fresh start"
                    : "Keep going"}
              </h2>
              <p>
                {doneCount} of {habits.length} done today
              </p>
            </div>
          </section>
          <ul className="mt-3 space-y-3">
            {habits.map((h) => {
              const doneToday = isDoneOn(logs, h.id!, today);
              const streak = currentStreak(h.id!, logs);
              const doneSet = new Set(
                logs
                  .filter((l) => l.habitId === h.id! && l.completed)
                  .map((l) => l.date),
              );
              const weekDone = week.filter((d) => doneSet.has(d.key)).length;
              return (
                <li key={h.id} className="card habit-card">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={action.busy}
                      onClick={() => onToggleToday(h)}
                      aria-pressed={doneToday}
                      aria-label={`Mark ${h.name} ${doneToday ? "not done" : "done"} today`}
                      className="tap-target flex shrink-0 items-center justify-center px-1.5"
                    >
                      <motion.span
                        className="habit-check"
                        data-done={doneToday}
                        animate={{ scale: doneToday ? [1, 1.18, 1] : 1 }}
                        transition={{ duration: 0.36 }}
                      >
                        <AnimatePresence initial={false}>
                          {doneToday && (
                            <motion.span
                              initial={{ scale: 0, rotate: -30 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 600,
                                damping: 22,
                              }}
                              className="flex"
                            >
                              <Icon
                                as={Check}
                                size={20}
                                color="#fff"
                                weight="bold"
                              />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId((id) => (id === h.id ? null : h.id!))
                      }
                      aria-expanded={expandedId === h.id}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <span className="min-w-0 break-words text-[17px] font-semibold text-ink">
                        {h.name}
                      </span>
                      <Icon
                        as={CaretDown}
                        size={13}
                        weight="bold"
                        className="shrink-0 transition-transform"
                        style={{
                          transform:
                            expandedId === h.id ? "rotate(180deg)" : "none",
                        }}
                      />
                    </button>
                    <span
                      className="pill mr-1 shrink-0"
                      style={
                        {
                          "--pill": streak
                            ? "var(--tint-orange)"
                            : "var(--tint-gray)",
                        } as React.CSSProperties
                      }
                      aria-label={`${streak} day streak`}
                    >
                      <Icon
                        as={Flame}
                        size={14}
                        color="currentColor"
                        weight="fill"
                      />
                      <span className="rounded-num">
                        <AnimatedNumber value={streak} />
                      </span>
                    </span>
                  </div>

                  <div
                    className="week-strip"
                    role="img"
                    aria-label={`Done ${weekDone} of the last 7 days`}
                  >
                    {week.map((d) => (
                      <span key={d.key}>
                        <i
                          data-done={doneSet.has(d.key)}
                          data-today={d.key === today}
                        />
                        {d.letter}
                      </span>
                    ))}
                  </div>

                  <AnimatePresence initial={false}>
                    {expandedId === h.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          duration: 0.26,
                          ease: [0.3, 0.7, 0.4, 1],
                        }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="mx-2 mt-4 border-t border-[var(--hairline)] pt-3">
                          <div className="mb-2 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setMonth(
                                  (m) =>
                                    new Date(
                                      m.getFullYear(),
                                      m.getMonth() - 1,
                                      1,
                                    ),
                                )
                              }
                              aria-label="Previous month"
                              className="tap-target flex items-center justify-center"
                            >
                              <Icon
                                as={CaretLeft}
                                size={18}
                                color="var(--tint)"
                                weight="bold"
                              />
                            </button>
                            <span className="text-[15px] font-semibold">
                              {monthLabel(
                                month.getFullYear(),
                                month.getMonth(),
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setMonth(
                                  (m) =>
                                    new Date(
                                      m.getFullYear(),
                                      m.getMonth() + 1,
                                      1,
                                    ),
                                )
                              }
                              aria-label="Next month"
                              className="tap-target flex items-center justify-center"
                            >
                              <Icon
                                as={CaretRight}
                                size={18}
                                color="var(--tint)"
                                weight="bold"
                              />
                            </button>
                          </div>
                          <MonthGrid
                            year={month.getFullYear()}
                            month={month.getMonth()}
                            doneDates={doneSet}
                          />
                          <button
                            type="button"
                            onClick={() => remove(h.id!)}
                            aria-label="Archive habit"
                            disabled={action.busy}
                            className="destructive-row press"
                          >
                            <Icon as={Archive} size={18} color="currentColor" />
                            Archive habit
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          if (action.busy) return;
          setSheetOpen(false);
        }}
        title="New habit"
        action={
          <button
            type="button"
            disabled={action.busy || !name.trim()}
            onClick={add}
            className="sheet-action"
          >
            Add
          </button>
        }
      >
        <InlineError>{action.error}</InlineError>
        <input
          aria-label="Habit name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) void add();
          }}
          placeholder="e.g. Read 20 pages"
          className="form-field"
        />
        <p className="mt-3 px-1 text-[13px] leading-snug text-softink">
          Small and specific works best. You can set a daily reminder in
          Settings.
        </p>
      </BottomSheet>

      {habits.length > 0 && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-[13px] text-softink">
          <Icon as={Bell} size={14} />
          Manage your daily reminder in Settings.
        </p>
      )}
      <UndoSnackbar
        pending={pending}
        onUndo={() => {
          void action.run(undo);
        }}
        onDismiss={dismiss}
      />
    </div>
  );
}
