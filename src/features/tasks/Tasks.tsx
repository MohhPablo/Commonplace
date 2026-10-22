import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, type Task } from "../../lib/db";
import { Checkbox } from "../../components/Checkbox";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import {
  CheckSquareOffset,
  Trash,
  DotsThree,
  CaretUp,
  CaretDown,
} from "@phosphor-icons/react";
import { formatShort, fromDayKey } from "../../lib/date";
import { useToday } from "../../lib/useToday";
import { useSwipeToDelete } from "../../lib/useSwipeToDelete";
import { useUndo } from "../../lib/useUndo";
import { useQuery } from "../../lib/useQuery";
import { useAction } from "../../lib/useAction";
import { InlineError } from "../../components/InlineError";
import { UndoSnackbar } from "../../components/UndoSnackbar";
import { FAB } from "../../components/FAB";
import { BottomSheet } from "../../components/BottomSheet";

const loadTasks = () => db.tasks.orderBy("createdAt").toArray();

export function Tasks() {
  const { value: tasks, error: loadError } = useQuery(loadTasks, []);
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { pending, arm, undo, dismiss } = useUndo(() => {});
  const action = useAction();
  const today = useToday();

  function openEditor(task: Task | null) {
    setEditing(task);
    setText(task?.text ?? "");
    setDueDate(task?.dueDate ?? "");
    action.setError("");
    setSheetOpen(true);
  }
  async function save() {
    const value = text.trim();
    if (!value) return;
    await action.run(async () => {
      if (editing)
        await db.tasks.update(editing.id!, {
          text: value,
          dueDate: dueDate || null,
        });
      else
        await db.tasks.add({
          text: value,
          dueDate: dueDate || null,
          completed: false,
          completedAt: null,
          createdAt: Date.now(),
        });
      setSheetOpen(false);
    });
  }
  async function toggle(task: Task) {
    await action.run(() =>
      db.transaction("rw", db.tasks, async () => {
        const current = await db.tasks.get(task.id!);
        if (current)
          await db.tasks.update(task.id!, {
            completed: !current.completed,
            completedAt: !current.completed ? Date.now() : null,
          });
      }),
    );
  }
  async function remove(task: Task) {
    await action.run(async () => {
      await db.tasks.delete(task.id!);
      setSheetOpen(false);
      arm("Task deleted", () => db.tasks.add(task));
    });
  }
  const open = tasks
    .filter((task) => !task.completed)
    .sort(
      (a, b) =>
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
        a.createdAt - b.createdAt,
    );
  const done = tasks.filter((task) => task.completed);
  return (
    <div className="screen-pad">
      <InlineError>
        {loadError
          ? "Could not load tasks. Please reopen the app to try again."
          : !sheetOpen
            ? action.error
            : null}
      </InlineError>
      {!loadError && !tasks.length ? (
        <EmptyState
          icon={CheckSquareOffset}
          title="Make room for today"
          message="Add what needs doing. Small tasks count too."
        />
      ) : (
        <>
          {open.length > 0 && (
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-softink">
              {open.length} to do
            </p>
          )}
          <ul className="divide-y divide-taupe">
            <AnimatePresence initial={false}>
              {open.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  disabled={action.busy}
                  onToggle={toggle}
                  onEdit={openEditor}
                  onDelete={remove}
                />
              ))}
            </AnimatePresence>
          </ul>
          {done.length > 0 && (
            <section className="mt-6">
              <button
                type="button"
                onClick={() => setShowDone((value) => !value)}
                aria-expanded={showDone}
                className="flex min-h-11 w-full items-center justify-between text-sm font-medium text-softink"
              >
                Done ({done.length})
                <Icon as={showDone ? CaretUp : CaretDown} size={16} />
              </button>
              {showDone && (
                <ul className="divide-y divide-taupe">
                  {done.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      today={today}
                      disabled={action.busy}
                      onToggle={toggle}
                      onEdit={openEditor}
                      onDelete={remove}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
      <FAB onPress={() => openEditor(null)} label="Add a task" />
      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          if (!action.busy) setSheetOpen(false);
        }}
        title={editing ? "Edit task" : "Add a task"}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <InlineError>{action.error}</InlineError>
          <label className="block text-sm font-medium text-ink">
            Task
            <input
              autoFocus
              required
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="What needs doing?"
              className="mt-2 min-h-12 w-full rounded-xl border border-taupe bg-surface px-4 text-base text-ink placeholder:text-softink"
            />
          </label>
          <label className="mt-4 block text-sm text-softink">
            Due date · optional
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="mt-2 block min-h-11 w-full rounded-xl border border-taupe bg-surface px-3 text-base text-ink"
            />
          </label>
          <button
            type="submit"
            disabled={action.busy || !text.trim()}
            className="mt-5 min-h-12 w-full rounded-full bg-terracotta px-4 font-medium text-onaccent"
          >
            {action.busy ? "Saving…" : editing ? "Save changes" : "Add task"}
          </button>
          {editing && (
            <button
              type="button"
              disabled={action.busy}
              onClick={() => remove(editing)}
              className="mt-2 min-h-11 w-full text-sm text-rust"
            >
              Delete task
            </button>
          )}
        </form>
      </BottomSheet>
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

function TaskRow({
  task,
  today,
  disabled,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  today: string;
  disabled: boolean;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const swipe = useSwipeToDelete(() => onDelete(task));
  const due =
    task.dueDate === today
      ? "Due today"
      : task.dueDate
        ? `${task.dueDate < today && !task.completed ? "Overdue · " : "Due "}${formatShort(fromDayKey(task.dueDate).getTime())}`
        : null;
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-rust"
      >
        <Icon as={Trash} size={20} color="var(--color-onaccent)" />
      </div>
      <motion.div
        {...swipe.handlers}
        animate={{ x: swipe.x }}
        style={{ touchAction: "pan-y" }}
        className="relative flex items-center gap-2 bg-paper py-3"
        onClickCapture={(event) => {
          if (swipe.consumeClick()) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <Checkbox
          checked={task.completed}
          disabled={disabled}
          onChange={() => onToggle(task)}
          label={`Mark "${task.text}" ${task.completed ? "incomplete" : "done"}`}
        />
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="min-w-0 flex-1 py-1 text-left"
        >
          <span
            className={`block break-words text-base ${task.completed ? "text-softink line-through" : "text-ink"}`}
          >
            {task.text}
          </span>
          {due && (
            <span
              className={`mt-1 block text-xs ${task.dueDate! < today && !task.completed ? "text-rust" : "text-softink"}`}
            >
              {due}
            </span>
          )}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onEdit(task)}
          aria-label={`Options for ${task.text}`}
          className="tap-target flex shrink-0 items-center justify-center"
        >
          <Icon as={DotsThree} size={22} />
        </button>
      </motion.div>
    </motion.li>
  );
}
