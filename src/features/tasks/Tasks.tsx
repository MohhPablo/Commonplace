import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, type Task } from "../../lib/db";
import { Checkbox } from "../../components/Checkbox";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { CheckSquareOffset, Plus, Trash, Calendar, CaretUp, CaretDown } from "@phosphor-icons/react";
import { formatShort, toDateInputValue } from "../../lib/date";
import { useSwipeToDelete } from "../../lib/useSwipeToDelete";

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const all = await db.tasks.orderBy("createdAt").toArray();
    setTasks(all);
  }

  async function add() {
    const t = text.trim();
    if (!t) return;
    await db.tasks.add({
      text: t,
      dueDate,
      completed: false,
      completedAt: null,
      createdAt: Date.now(),
    });
    setText("");
    setDueDate(null);
    await load();
  }

  async function toggle(task: Task) {
    const updated: Task = {
      ...task,
      completed: !task.completed,
      completedAt: !task.completed ? Date.now() : null,
    };
    await db.tasks.put(updated);
    await load();
  }

  async function remove(id: number) {
    await db.tasks.delete(id);
    await load();
  }

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  return (
    <div className="px-5 pt-20">
      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquareOffset}
          title="No tasks yet"
          message="A simple, flat list of things to do. Add one when you're ready."
        />
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {open.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={toggle} onDelete={remove} />
              ))}
            </AnimatePresence>
          </ul>

          {done.length > 0 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowDone((s) => !s)}
                className="interactive flex w-full items-center justify-between font-sans text-sm font-medium text-softink"
              >
                <span>Done ({done.length})</span>
                <Icon
                  as={showDone ? CaretUp : CaretDown}
                  size={16}
                  color="#6B6058"
                  weight="bold"
                />
              </button>
              <AnimatePresence initial={false}>
                {showDone &&
                  done.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onToggle={toggle}
                      onDelete={remove}
                      done
                    />
                  ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      <div className="mt-6 rounded-xl border border-taupe bg-surface p-3 shadow-page">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a task"
          className="w-full bg-transparent font-sans text-base text-ink placeholder:text-softink focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-1.5 font-sans text-xs text-softink">
            <Icon as={Calendar} size={15} color="#6B6058" weight="light" />
            <input
              type="date"
              value={toDateInputValue(dueDate)}
              onChange={(e) => setDueDate(e.target.value || null)}
              className="bg-transparent text-softink focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={add}
            className="interactive flex items-center gap-1 rounded-full bg-terracotta px-3 py-1.5 font-sans text-sm font-medium text-surface"
          >
            <Icon as={Plus} size={16} color="#FDFBF7" weight="bold" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (id: number) => void;
  done?: boolean;
}

function TaskRow({ task, onToggle, onDelete, done }: TaskRowProps) {
  const swipe = useSwipeToDelete(() => onDelete(task.id!));

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="relative overflow-hidden rounded-xl"
    >
      <div className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-rust">
        <Icon as={Trash} size={20} color="#FDFBF7" weight="light" />
      </div>
      <motion.div
        {...swipe.handlers}
        animate={{ x: swipe.x }}
        transition={{ type: "spring", stiffness: 500, damping: 40 }}
        className="relative flex items-center gap-3 rounded-xl border border-taupe bg-surface px-4 py-3 shadow-page"
      >
        <Checkbox
          checked={task.completed}
          onChange={() => onToggle(task)}
          label={`Mark "${task.text}" ${task.completed ? "incomplete" : "done"}`}
        />
        <div className="min-w-0 flex-1">
          <div
            className={[
              "truncate font-sans text-base",
              done ? "text-softink line-through" : "text-ink",
            ].join(" ")}
          >
            {task.text}
          </div>
          {task.dueDate && (
            <div className="font-sans text-xs text-softink">
              Due {formatShort(new Date(task.dueDate).getTime())}
            </div>
          )}
        </div>
      </motion.div>
    </motion.li>
  );
}
