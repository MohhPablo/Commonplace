import { useEffect, useMemo, useRef, useState } from "react";
import { db, type Entry } from "../../lib/db";
import { Editor } from "./Editor";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import {
  BookOpen,
  PencilSimple,
  MagnifyingGlass,
  X,
  Trash,
} from "@phosphor-icons/react";
import { formatDateline } from "../../lib/date";

type View = "list" | "write" | "read";

export function Journal() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [view, setView] = useState<View>("list");
  const [current, setCurrent] = useState<Entry | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const all = await db.entries.orderBy("createdAt").reverse().toArray();
    setEntries(all);
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter((e) => {
      const text = JSON.stringify(e.content).toLowerCase();
      return text.includes(q);
    });
  }, [entries, query]);

  async function startNew() {
    const now = Date.now();
    const entry: Entry = {
      createdAt: now,
      updatedAt: now,
      content: "",
      wordCount: 0,
    };
    const id = await db.entries.add(entry);
    const saved = { ...entry, id: id as number };
    setCurrent(saved);
    setView("write");
  }

  async function openEntry(e: Entry) {
    setCurrent(e);
    setView("write");
  }

  async function saveEntry(content: unknown, wordCount: number) {
    if (!current) return;
    setSaving(true);
    const updated: Entry = {
      ...current,
      content,
      wordCount,
      updatedAt: Date.now(),
    };
    setCurrent(updated);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await db.entries.put(updated);
      setSaving(false);
      await load();
    }, 500);
  }

  async function deleteEntry(id: number) {
    await db.entries.delete(id);
    if (current?.id === id) {
      setCurrent(null);
      setView("list");
    }
    await load();
  }

  if (view === "write" && current) {
    return (
      <WriteView
        entry={current}
        saving={saving}
        onChange={saveEntry}
        onBack={() => {
          setCurrent(null);
          setView("list");
        }}
        onDelete={() => deleteEntry(current.id!)}
      />
    );
  }

  return (
    <div className="screen-pad">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={startNew}
          className="interactive flex items-center gap-1.5 rounded-full bg-terracotta px-3.5 py-2 font-sans text-sm font-medium text-surface"
        >
          <Icon as={PencilSimple} size={16} color="#FDFBF7" weight="bold" />
          New
        </button>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No entries yet"
          message="Your journal is a quiet place to write each day. The first blank page is waiting."
        />
      ) : (
        <>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-taupe bg-surface px-3 py-2">
            <Icon as={MagnifyingGlass} size={18} color="#6B6058" weight="light" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setQuery(search)}
              placeholder="Search entries"
              className="flex-1 bg-transparent font-sans text-sm text-ink placeholder:text-softink focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setQuery("");
                }}
                aria-label="Clear search"
              >
                <Icon as={X} size={16} color="#6B6058" weight="bold" />
              </button>
            )}
          </div>

          <ul className="mt-2 divide-y divide-taupe">
            {filtered.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => openEntry(e)}
                  className="interactive flex w-full items-baseline justify-between gap-4 py-4 text-left"
                >
                  <span className="font-serif text-lg font-semibold text-ink">
                    {formatDateline(e.createdAt)}
                  </span>
                  <span className="shrink-0 font-sans text-xs text-softink">
                    {e.wordCount} {e.wordCount === 1 ? "word" : "words"}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="pt-8 text-center font-sans text-sm text-softink">
                No entries match “{query}”.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

interface WriteViewProps {
  entry: Entry;
  saving: boolean;
  onChange: (content: unknown, wordCount: number) => void;
  onBack: () => void;
  onDelete: () => void;
}

function WriteView({ entry, saving, onChange, onBack, onDelete }: WriteViewProps) {
  return (
    <div className="screen-pad">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="interactive font-sans text-sm font-medium text-softink"
        >
          ← Entries
        </button>
        <div className="flex items-center gap-3">
          <span className="font-sans text-xs text-softink">
            {saving ? "Saving…" : "Saved"}
          </span>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete entry"
            className="interactive"
          >
            <Icon as={Trash} size={18} color="#A8412A" weight="light" />
          </button>
        </div>
      </header>

      <div className="mt-3 font-serif text-xl font-semibold text-ink">
        {formatDateline(entry.createdAt)}
      </div>

      <div className="mt-4">
        <Editor
          initialContent={entry.content}
          onChange={onChange}
        />
      </div>

      <div className="mt-6 text-center font-sans text-xs text-softink">
        {entry.wordCount} {entry.wordCount === 1 ? "word" : "words"}
      </div>
    </div>
  );
}
