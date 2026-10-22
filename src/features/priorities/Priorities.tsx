import { useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { db, type Priority, type PriorityList } from "../../lib/db";
import { Checkbox } from "../../components/Checkbox";
import { Icon } from "../../components/Icon";
import { Trash, DotsSixVertical } from "@phosphor-icons/react";
import { useUndo } from "../../lib/useUndo";
import { UndoSnackbar } from "../../components/UndoSnackbar";
import { FAB } from "../../components/FAB";
import { BottomSheet } from "../../components/BottomSheet";
import { useAutosave } from "../../lib/useAutosave";
import { useAction } from "../../lib/useAction";
import { InlineError } from "../../components/InlineError";
import { SaveStatus } from "../../components/SaveStatus";

/**
 * Priorities: two independent lists (Needs / Wants). Each is drag-reorderable
 * via Framer Motion Reorder (ref §5 — pointer/touch based, NOT native HTML5 DnD,
 * which is unreliable on iOS). Checked items move to a collapsed "Fulfilled"
 * section, kept as a record (spec §5.3). Numbered like a manuscript list to
 * distinguish from Tasks.
 */
export function Priorities() {
  const [needs, setNeeds] = useState<Priority[]>([]);
  const [wants, setWants] = useState<Priority[]>([]);
  const [tab, setTab] = useState<PriorityList>("needs");
  const [draft, setDraft] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Priority | null>(null);
  const action = useAction();
  const drafts = useRef(new Map<string, string>());
  const draftKey = editing ? String(editing.id) : `new:${tab}`;
  const closeSheet = () => {
    if (action.busy) return;
    drafts.current.set(draftKey, draft);
    setSheetOpen(false);
  };
  const { writer: orderWriter, status } = useAutosave<Priority[]>(
    async (items) => {
      await db.transaction("rw", db.priorities, async () => {
        for (const [order, item] of items.entries())
          await db.priorities.update(item.id!, { order });
      });
    },
  );
  const { pending, arm, undo, dismiss } = useUndo(() => {
    void load().catch(() =>
      action.setError("Could not refresh this list. Please reopen the app."),
    );
  });

  useEffect(() => {
    void load().catch(() => action.setError("Could not load priorities."));
  }, []);

  async function load() {
    const all = await db.priorities.toArray();
    setNeeds(
      all.filter((p) => p.list === "needs").sort((a, b) => a.order - b.order),
    );
    setWants(
      all.filter((p) => p.list === "wants").sort((a, b) => a.order - b.order),
    );
  }

  async function add() {
    const text = draft.trim();
    if (!text) return;
    await action.run(async () => {
      await orderWriter.flush();
      if (editing) await db.priorities.update(editing.id!, { text });
      else
        await db.priorities.add({
          list: tab,
          text,
          order: (tab === "needs" ? needs : wants).length,
          fulfilled: false,
          fulfilledAt: null,
          createdAt: Date.now(),
        });
      drafts.current.delete(draftKey);
      setDraft("");
      setSheetOpen(false);
      setEditing(null);
      await load();
    });
  }

  function edit(item: Priority) {
    setEditing(item);
    setDraft(drafts.current.get(String(item.id)) ?? item.text);
    action.setError("");
    setSheetOpen(true);
  }

  async function toggle(item: Priority) {
    await action.run(async () => {
      await orderWriter.flush();
      await db.transaction("rw", db.priorities, async () => {
        const current = await db.priorities.get(item.id!);
        if (current)
          await db.priorities.update(item.id!, {
            fulfilled: !current.fulfilled,
            fulfilledAt: !current.fulfilled ? Date.now() : null,
          });
      });
      await load();
    });
  }

  async function remove(id: number) {
    const target = [...needs, ...wants].find((p) => p.id === id);
    if (!target) return;
    await action.run(async () => {
      await orderWriter.flush();
      await db.priorities.delete(id);
      setSheetOpen(false);
      await load();
      arm("Priority deleted", () => db.priorities.add(target));
    });
  }

  const list = tab === "needs" ? needs : wants;
  const setList = tab === "needs" ? setNeeds : setWants;
  const open = list.filter((p) => !p.fulfilled);
  const fulfilled = list.filter((p) => p.fulfilled);

  return (
    <div className="screen-pad">
      {!sheetOpen && <InlineError>{action.error}</InlineError>}
      <FAB
        onPress={() => {
          setEditing(null);
          setDraft(drafts.current.get(`new:${tab}`) ?? "");
          action.setError("");
          setSheetOpen(true);
        }}
        label="Add to priorities"
      />
      <p className="text-sm text-softink">
        Needs come first. Wants can wait for their turn.
      </p>
      <div className="segmented mt-4">
        {(["needs", "wants"] as PriorityList[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => {
              void action.run(async () => {
                await orderWriter.flush();
                setTab(k);
              });
            }}
            className="capitalize"
          >
            {k}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Reorder.Group
          axis="y"
          values={open}
          onReorder={(next) => {
            // Merge with the fulfilled section, then stamp a fresh `order`
            // onto the local array so subsequent toggles/loads stay in sync
            // and the left-margin numbers never scramble.
            const merged = [...next, ...fulfilled];
            setList(merged);
            orderWriter.schedule(merged);
          }}
          className="grouped-list divide-y divide-taupe"
        >
          {open.map((p, i) => (
            <PriorityItem
              key={p.id}
              item={p}
              index={i + 1}
              onToggle={toggle}
              onEdit={edit}
              onMove={(direction) => {
                const next = [...open];
                const target = i + direction;
                if (target < 0 || target >= next.length) return;
                [next[i], next[target]] = [next[target], next[i]];
                const merged = [...next, ...fulfilled];
                setList(merged);
                orderWriter.schedule(merged);
              }}
              onDragEnd={() => {
                void orderWriter.flush().catch(() => {});
              }}
            />
          ))}
        </Reorder.Group>

        {open.length === 0 && (
          <p className="py-8 text-center font-sans text-sm text-softink">
            Nothing here yet. Add what matters most.
          </p>
        )}

        {fulfilled.length > 0 && (
          <div className="mt-6">
            <h2 className="font-sans text-sm font-medium text-softink">
              Fulfilled ({fulfilled.length})
            </h2>
            <ul className="mt-2 space-y-2">
              {fulfilled.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-taupe bg-surface px-4 py-3 opacity-70"
                >
                  <Checkbox
                    checked
                    onChange={() => toggle(p)}
                    label={`Mark "${p.text}" unfulfilled`}
                    tone="sage"
                  />
                  <button
                    type="button"
                    onClick={() => edit(p)}
                    className="min-h-11 flex-1 break-words text-left text-base text-softink line-through"
                  >
                    {p.text}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id!)}
                    aria-label="Delete"
                    className="tap-target"
                  >
                    <Icon
                      as={Trash}
                      size={18}
                      color="var(--color-rust)"
                      weight="light"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {status !== "saved" && (
        <div className="mt-3 text-right">
          <SaveStatus
            status={status}
            onRetry={() => {
              void orderWriter.flush().catch(() => {});
            }}
          />
        </div>
      )}
      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editing ? "Edit priority" : `Add to ${tab}`}
        action={
          <button
            type="button"
            disabled={action.busy || !draft.trim()}
            onClick={add}
            className="sheet-action"
          >
            {editing ? "Save changes" : "Add priority"}
          </button>
        }
      >
        <InlineError>{action.error}</InlineError>
        <input
          aria-label="Priority"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) void add();
          }}
          placeholder={`Add to ${tab}`}
          className="form-field"
        />
        {editing && (
          <button
            type="button"
            disabled={action.busy}
            onClick={() => remove(editing.id!)}
            className="mt-2 min-h-11 w-full text-sm text-rust"
          >
            Delete priority
          </button>
        )}
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

interface PriorityItemProps {
  item: Priority;
  index: number;
  onToggle: (p: Priority) => void;
  onEdit: (item: Priority) => void;
  onMove: (direction: number) => void;
  onDragEnd: () => void;
}

function PriorityItem({
  item,
  index,
  onToggle,
  onEdit,
  onMove,
  onDragEnd,
}: PriorityItemProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      layout
      className="flex items-center gap-2 bg-surface px-3 py-2"
    >
      <span className="w-6 text-center text-sm font-medium text-softink">
        {index}
      </span>
      <Checkbox
        checked={item.fulfilled}
        onChange={() => onToggle(item)}
        label={`Mark "${item.text}" fulfilled`}
        tone="sage"
      />
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="min-h-11 min-w-0 flex-1 break-words text-left text-base text-ink"
      >
        {item.text}
      </button>
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Reorder ${item.text}. Use arrow keys to move.`}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            onMove(event.key === "ArrowUp" ? -1 : 1);
          }
        }}
        className="tap-target flex touch-none items-center justify-center"
      >
        <Icon
          as={DotsSixVertical}
          size={20}
          color="var(--color-softink)"
          weight="light"
        />
      </button>
    </Reorder.Item>
  );
}
