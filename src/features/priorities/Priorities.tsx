import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { db, type Priority, type PriorityList } from "../../lib/db";
import { Checkbox } from "../../components/Checkbox";
import { Icon } from "../../components/Icon";
import { Trash, DotsSixVertical } from "@phosphor-icons/react";
import { useUndo } from "../../lib/useUndo";
import { UndoSnackbar } from "../../components/UndoSnackbar";
import { FAB } from "../../components/FAB";
import { BottomSheet } from "../../components/BottomSheet";

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
  const { pending, arm, undo, dismiss } = useUndo(() => void load());

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const all = await db.priorities.toArray();
    setNeeds(all.filter((p) => p.list === "needs").sort((a, b) => a.order - b.order));
    setWants(all.filter((p) => p.list === "wants").sort((a, b) => a.order - b.order));
  }

  async function add() {
    const t = draft.trim();
    if (!t) return;
    const list = tab;
    const arr = list === "needs" ? needs : wants;
    await db.priorities.add({
      list,
      text: t,
      order: arr.length,
      fulfilled: false,
      fulfilledAt: null,
      createdAt: Date.now(),
    });
    setDraft("");
    setSheetOpen(false);
    await load();
  }

  async function persistOrder(items: Priority[]) {
    await db.priorities.bulkPut(items.map((p, i) => ({ ...p, order: i })));
  }

  async function toggle(p: Priority) {
    const updated: Priority = {
      ...p,
      fulfilled: !p.fulfilled,
      fulfilledAt: !p.fulfilled ? Date.now() : null,
    };
    await db.priorities.put(updated);
    await load();
  }

  async function remove(id: number) {
    const all = [...needs, ...wants];
    const target = all.find((p) => p.id === id);
    if (!target) return;
    await db.priorities.delete(id);
    await load();
    void arm(`Deleted “${target.text}”`, () => db.priorities.add({ ...target }));
  }

  const list = tab === "needs" ? needs : wants;
  const setList = tab === "needs" ? setNeeds : setWants;
  const open = list.filter((p) => !p.fulfilled);
  const fulfilled = list.filter((p) => p.fulfilled);

  return (
    <div className="screen-pad">
      <div className="mt-4 flex rounded-full border border-taupe bg-surface p-1">
        {(["needs", "wants"] as PriorityList[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className="interactive flex-1 rounded-full py-2 font-sans text-sm font-medium capitalize"
            style={{
              background: tab === k ? "#C1502D" : "transparent",
              color: tab === k ? "#FDFBF7" : "#6B6058",
            }}
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
            setList(merged.map((p, i) => ({ ...p, order: i })));
            void persistOrder(merged);
          }}
          className="space-y-2"
        >
          {open.map((p, i) => (
            <PriorityItem
              key={p.id}
              item={p}
              index={i + 1}
              onToggle={toggle}
              onDelete={remove}
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
                  <span className="flex-1 truncate font-sans text-base text-softink line-through">
                    {p.text}
                  </span>
                  <button type="button" onClick={() => remove(p.id!)} aria-label="Delete" className="tap-target">
                    <Icon as={Trash} size={18} color="#A8412A" weight="light" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <FAB onPress={() => setSheetOpen(true)} label="Add to priorities" />
      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setDraft("");
        }}
        title={`Add to ${tab}`}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={`Add to ${tab}`}
          className="w-full rounded-xl border border-taupe bg-surface px-4 py-3 font-sans text-base text-ink placeholder:text-softink focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="interactive mt-3 w-full rounded-full bg-terracotta px-4 py-3 font-sans text-base font-medium text-surface"
        >
          Add
        </button>
      </BottomSheet>

      <UndoSnackbar pending={pending} onUndo={undo} onDismiss={dismiss} />
    </div>
  );
}

interface PriorityItemProps {
  item: Priority;
  index: number;
  onToggle: (p: Priority) => void;
  onDelete: (id: number) => void;
}

function PriorityItem({ item, index, onToggle, onDelete }: PriorityItemProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      layout
      className="flex items-center gap-2 rounded-xl border border-taupe bg-surface px-3 py-3 shadow-page"
    >
      <span className="w-6 text-center font-serif text-lg font-semibold text-ochre">
        {index}
      </span>
      <Checkbox
        checked={item.fulfilled}
        onChange={() => onToggle(item)}
        label={`Mark "${item.text}" fulfilled`}
        tone="sage"
      />
      <span className="min-w-0 flex-1 truncate font-sans text-base text-ink">
        {item.text}
      </span>
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        aria-label="Reorder"
        className="touch-none"
      >
        <Icon as={DotsSixVertical} size={20} color="#6B6058" weight="light" />
      </button>
      <button type="button" onClick={() => onDelete(item.id!)} aria-label="Delete">
        <Icon as={Trash} size={18} color="#A8412A" weight="light" />
      </button>
    </Reorder.Item>
  );
}
