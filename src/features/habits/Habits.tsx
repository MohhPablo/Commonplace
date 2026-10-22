import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { db, type Habit, type HabitLog } from "../../lib/db";
import { currentStreak, isDoneOn, toggleToday } from "../../lib/habits";
import { setBadge } from "../../lib/badge";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import {
  Repeat,
  Trash,
  Check,
  Flame,
  CaretLeft,
  CaretRight,
  CaretDown,
} from "@phosphor-icons/react";
import { dayKey } from "../../lib/date";
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

  return (
    <div className="screen-pad">
      <FAB onPress={() => setSheetOpen(true)} label="New habit" />
      {!sheetOpen && <InlineError>{action.error}</InlineError>}
      {habits.length > 0 && (
        <p className="text-sm text-softink">
          {habits.filter((h) => isDoneOn(logs, h.id!, today)).length} of{" "}
          {habits.length} done today
        </p>
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
              <li key={h.id} className="native-card px-3 py-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    disabled={action.busy}
                    onClick={() => onToggleToday(h)}
                    aria-pressed={doneToday}
                    aria-label={`Mark ${h.name} ${doneToday ? "not done" : "done"} today`}
                    className="tap-target mr-2 flex shrink-0 items-center justify-center"
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2"
                      style={{
                        borderColor: doneToday
                          ? "var(--color-sage)"
                          : "var(--color-taupe)",
                        background: doneToday
                          ? "var(--color-sage)"
                          : "transparent",
                      }}
                    >
                      {doneToday && (
                        <Icon
                          as={Check}
                          size={18}
                          color="var(--color-onaccent)"
                          weight="bold"
                        />
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((id) => (id === h.id ? null : h.id!))
                    }
                    aria-expanded={expandedId === h.id}
                    className="interactive flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="min-w-0 flex-1 break-words text-base font-medium text-ink">
                      {h.name}
                    </span>
                    <Icon
                      as={CaretDown}
                      size={16}
                      color="var(--color-softink)"
                      weight="bold"
                      className="ml-1 transition-transform"
                      style={{
                        transform:
                          expandedId === h.id ? "rotate(180deg)" : "none",
                      }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(h.id!)}
                    aria-label="Archive habit"
                    disabled={action.busy}
                    className="tap-target"
                  >
                    <Icon
                      as={Trash}
                      size={18}
                      color="var(--color-rust)"
                      weight="light"
                    />
                  </button>
                </div>

                <div className="mb-2 ml-14 flex items-center gap-1.5">
                  <Icon
                    as={Flame}
                    size={15}
                    color="var(--color-ochre)"
                    weight="fill"
                  />
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
                            className="interactive tap-target flex items-center justify-center"
                          >
                            <Icon
                              as={CaretLeft}
                              size={16}
                              color="var(--color-softink)"
                              weight="bold"
                            />
                          </button>
                          <span className="font-sans text-xs font-medium text-softink">
                            {monthLabel(month.getFullYear(), month.getMonth())}
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
                            className="interactive tap-target flex items-center justify-center"
                          >
                            <Icon
                              as={CaretRight}
                              size={16}
                              color="var(--color-softink)"
                              weight="bold"
                            />
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
          placeholder="New habit"
          className="form-field"
        />
      </BottomSheet>

      <p className="mt-6 border-t border-taupe pt-4 text-xs text-softink">
        Manage your daily reminder in Settings.
      </p>
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
