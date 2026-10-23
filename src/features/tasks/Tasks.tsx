import { useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, type Task } from "../../lib/db";
import { Checkbox } from "../../components/Checkbox";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import {
  ListChecks,
  Trash,
  DotsThree,
  CaretDown,
  CalendarBlank,
  CalendarDots,
  Tray,
  Check,
  type IconProps,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
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
import { AnimatedNumber } from "../../components/AnimatedNumber";

const loadTasks = () => db.tasks.orderBy("createdAt").toArray();

type Filter = "today" | "scheduled" | "all" | "completed";
const SMART_LISTS: {
  key: Filter;
  label: string;
  icon: ComponentType<IconProps>;
  tile: string;
}[] = [
  {
    key: "today",
    label: "Today",
    icon: CalendarBlank,
    tile: "var(--tint-blue)",
  },
  {
    key: "scheduled",
    label: "Scheduled",
    icon: CalendarDots,
    tile: "var(--tint-red)",
  },
  { key: "all", label: "All", icon: Tray, tile: "var(--all-tile)" },
  {
    key: "completed",
    label: "Completed",
    icon: Check,
    tile: "var(--tint-gray)",
  },
];

export function Tasks() {
  const { value: tasks, error: loadError, loading } = useQuery(loadTasks, []);
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { pending, arm, undo, dismiss } = useUndo(() => {});
  const action = useAction();
  const today = useToday();
  const formId = useId();
  const drafts = useRef(new Map<string, { text: string; dueDate: string }>());
  const draftKey = (task: Task | null) => (task ? String(task.id) : "new");
  function closeSheet() {
    if (action.busy) return;
    drafts.current.set(draftKey(editing), { text, dueDate });
    setSheetOpen(false);
  }

  function openEditor(task: Task | null) {
    setEditing(task);
    const draft = drafts.current.get(draftKey(task));
    setText(draft?.text ?? task?.text ?? "");
    setDueDate(draft?.dueDate ?? task?.dueDate ?? "");
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
      drafts.current.delete(draftKey(editing));
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
      drafts.current.delete(draftKey(task));
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
  const done = tasks
    .filter((task) => task.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const dueBy = (task: Task) => task.dueDate !== null && task.dueDate <= today;
  const counts: Record<Filter, number> = {
    today: open.filter(dueBy).length,
    scheduled: open.filter((task) => task.dueDate).length,
    all: open.length,
    completed: done.length,
  };
  const sections: { title: string; color?: string; tasks: Task[] }[] =
    filter === "completed"
      ? [{ title: "Completed", tasks: done }]
      : filter === "today"
        ? [
            {
              title: "Overdue",
              color: "var(--color-rust)",
              tasks: open.filter((t) => t.dueDate! < today && dueBy(t)),
            },
            {
              title: "Today",
              color: "var(--tint)",
              tasks: open.filter((t) => t.dueDate === today),
            },
          ]
        : [
            {
              title: "Overdue",
              color: "var(--color-rust)",
              tasks: open.filter(
                (t) => t.dueDate !== null && t.dueDate < today,
              ),
            },
            {
              title: "Today",
              color: "var(--tint)",
              tasks: open.filter((t) => t.dueDate === today),
            },
            {
              title: "Upcoming",
              tasks: open.filter(
                (t) => t.dueDate !== null && t.dueDate > today,
              ),
            },
            ...(filter === "all"
              ? [
                  {
                    title: open.some((t) => t.dueDate) ? "Anytime" : "To do",
                    tasks: open.filter((t) => !t.dueDate),
                  },
                ]
              : []),
          ];
  const visible = sections.filter((section) => section.tasks.length);
  const rowProps = {
    today,
    disabled: action.busy,
    onToggle: toggle,
    onEdit: openEditor,
    onDelete: remove,
  };
  return (
    <div className="screen-pad">
      <FAB onPress={() => openEditor(null)} label="Add a task" />
      <InlineError>
        {loadError
          ? "Could not load tasks. Please reopen the app to try again."
          : !sheetOpen
            ? action.error
            : null}
      </InlineError>
      {!loading && !loadError && !tasks.length ? (
        <EmptyState
          icon={ListChecks}
          title="Make room for today"
          message="Add what needs doing. Small tasks count too."
          action={
            <button
              type="button"
              onClick={() => openEditor(null)}
              className="native-primary press"
            >
              Add your first task
            </button>
          }
        />
      ) : (
        <>
          <div className="smart-lists">
            {SMART_LISTS.map((list) => (
              <button
                key={list.key}
                type="button"
                aria-pressed={filter === list.key}
                onClick={() => {
                  setFilter(list.key);
                  setShowDone(false);
                }}
                className="smart-list press"
                style={{ "--tile": list.tile } as React.CSSProperties}
              >
                <span className="smart-icon">
                  <Icon
                    as={list.icon}
                    size={18}
                    color="currentColor"
                    weight="fill"
                  />
                </span>
                <strong>
                  <AnimatedNumber value={counts[list.key]} />
                </strong>
                <span>{list.label}</span>
              </button>
            ))}
          </div>
          {visible.map((section) => (
            <section key={section.title}>
              <div
                className="list-section-title"
                style={{ "--heading": section.color } as React.CSSProperties}
              >
                <h2>{section.title}</h2>
                <span>{section.tasks.length}</span>
              </div>
              <ul className="grouped-list row-divided">
                <AnimatePresence initial={false}>
                  {section.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} {...rowProps} />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
          {!visible.length && (
            <p
              role="status"
              className="py-12 text-center text-[15px] text-softink"
            >
              {filter === "completed"
                ? "Nothing completed yet."
                : "Nothing here. Enjoy the space."}
            </p>
          )}
          {filter === "all" && done.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowDone((value) => !value)}
                aria-expanded={showDone}
                className="disclosure"
              >
                Completed ({done.length})
                <Icon
                  as={CaretDown}
                  size={16}
                  weight="bold"
                  className="transition-transform"
                  style={{ transform: showDone ? "rotate(180deg)" : "none" }}
                />
              </button>
              {showDone && (
                <ul className="grouped-list row-divided">
                  {done.map((task) => (
                    <TaskRow key={task.id} task={task} {...rowProps} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editing ? "Edit task" : "New task"}
        action={
          <button
            type="submit"
            form={formId}
            disabled={action.busy || !text.trim()}
            className="sheet-action"
          >
            {action.busy ? "Saving…" : editing ? "Save changes" : "Add task"}
          </button>
        }
      >
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <InlineError>{action.error}</InlineError>
          <label className="form-section">
            Task
            <input
              autoFocus
              required
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="What needs doing?"
              className="form-field"
            />
          </label>
          <label className="form-section">
            Due date · optional
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="form-field"
            />
          </label>
          {editing && (
            <button
              type="button"
              disabled={action.busy}
              onClick={() => remove(editing)}
              className="destructive-row press"
            >
              <Icon as={Trash} size={18} color="currentColor" />
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
  const overdue =
    task.dueDate !== null && task.dueDate < today && !task.completed;
  const due =
    task.dueDate === today
      ? "Today"
      : task.dueDate
        ? `${overdue ? "Overdue · " : ""}${formatShort(fromDayKey(task.dueDate).getTime())}`
        : null;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: [0.3, 0.7, 0.4, 1] }}
      className="relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-rust"
      >
        <Icon as={Trash} size={22} color="#fff" weight="fill" />
      </div>
      <motion.div
        {...swipe.handlers}
        animate={{ x: swipe.x }}
        style={{ touchAction: "pan-y" }}
        className="task-row"
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
          className="min-w-0 flex-1 py-2 text-left"
        >
          <span
            className={`block break-words text-[17px] leading-snug transition-colors ${task.completed ? "text-softink line-through" : "text-ink"}`}
          >
            {task.text}
          </span>
          {due && (
            <span
              className="task-due"
              style={overdue ? { color: "var(--color-rust)" } : undefined}
            >
              <Icon
                as={CalendarBlank}
                size={13}
                color="currentColor"
                weight="bold"
              />
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
          <Icon as={DotsThree} size={22} weight="bold" />
        </button>
      </motion.div>
    </motion.li>
  );
}
