import { lazy, Suspense, useContext, useEffect, useRef, useState } from "react";
import { WritingMode } from "../../lib/WritingMode";
import { db, type Entry } from "../../lib/db";
import { EmptyState } from "../../components/EmptyState";
import { InlineError } from "../../components/InlineError";
import { SaveStatus } from "../../components/SaveStatus";
import { UndoSnackbar } from "../../components/UndoSnackbar";
import { Icon } from "../../components/Icon";
import {
  BookOpen,
  PencilSimple,
  MagnifyingGlass,
  DotsThree,
  X,
  Trash,
} from "@phosphor-icons/react";
import { formatDateline } from "../../lib/date";
import { entryText } from "../../lib/entryText";
import { useQuery } from "../../lib/useQuery";
import { useAutosave } from "../../lib/useAutosave";
import { useUndo } from "../../lib/useUndo";

const Editor = lazy(() =>
  import("./Editor").then((module) => ({ default: module.Editor })),
);
const loadEntries = () => db.entries.orderBy("createdAt").reverse().toArray();

export function Journal() {
  const setWriting = useContext(WritingMode);
  const [current, setCurrent] = useState<Entry | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const creating = useRef(false);
  useEffect(() => {
    setWriting(current !== null);
    return () => setWriting(false);
  }, [current, setWriting]);
  const undo = useUndo(() => {});

  async function startNew() {
    if (creating.current) return;
    creating.current = true;
    setError("");
    try {
      const now = Date.now();
      const entry = {
        createdAt: now,
        updatedAt: now,
        content: "",
        wordCount: 0,
      };
      const id = await db.entries.add(entry);
      setCurrent({ ...entry, id });
    } catch {
      setError("Could not start an entry. Please try again.");
    } finally {
      creating.current = false;
    }
  }

  return (
    <>
      {current ? (
        <WriteView
          key={current.id}
          entry={current}
          onBack={() => setCurrent(null)}
          onDeleted={(entry) => {
            setCurrent(null);
            undo.arm("Entry deleted", () => db.entries.add(entry));
          }}
        />
      ) : (
        <div className="screen-pad">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={startNew}
              className="flex min-h-11 items-center gap-2 rounded-full bg-terracotta px-4 text-sm font-medium text-onaccent"
            >
              <Icon
                as={PencilSimple}
                size={18}
                color="var(--color-onaccent)"
                weight="bold"
              />{" "}
              New entry
            </button>
          </div>
          <InlineError>{error}</InlineError>
          <EntryList search={search} onSearch={setSearch} onOpen={setCurrent} />
        </div>
      )}
      <UndoSnackbar
        pending={undo.pending}
        onUndo={() => {
          void undo
            .undo()
            .catch(() =>
              setError("Could not restore this entry. Please try Undo again."),
            );
        }}
        onDismiss={undo.dismiss}
      />
    </>
  );
}

function EntryList({
  search,
  onSearch,
  onOpen,
}: {
  search: string;
  onSearch: (value: string) => void;
  onOpen: (entry: Entry) => void;
}) {
  const { value: entries, error } = useQuery(loadEntries, []);
  const query = search.trim().toLocaleLowerCase();
  const filtered = entries.filter(
    (entry) =>
      !query || entryText(entry.content).toLocaleLowerCase().includes(query),
  );
  return (
    <>
      <InlineError>
        {error
          ? "Could not load your journal. Please reopen the app to try again."
          : null}
      </InlineError>
      {!error && entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Your first blank page"
          message="Write a thought, a memory, or a few lines about today."
        />
      ) : (
        <>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-taupe bg-surface px-3">
            <Icon as={MagnifyingGlass} size={18} />
            <input
              type="search"
              aria-label="Search entries"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search your writing"
              className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-softink"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearch("")}
                aria-label="Clear search"
                className="tap-target flex items-center justify-center"
              >
                <Icon as={X} size={16} />
              </button>
            )}
          </div>
          <ul className="mt-2 divide-y divide-taupe">
            {filtered.map((entry, index) => {
              const month = new Date(entry.createdAt).toLocaleDateString(
                undefined,
                { month: "long", year: "numeric" },
              );
              const previousMonth = index
                ? new Date(filtered[index - 1].createdAt).toLocaleDateString(
                    undefined,
                    { month: "long", year: "numeric" },
                  )
                : null;
              return (
                <li key={entry.id}>
                  {month !== previousMonth && (
                    <h2 className="pt-6 pb-1 text-xs font-medium uppercase tracking-widest text-softink">
                      {month}
                    </h2>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpen(entry)}
                    className="w-full py-4 text-left"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-serif text-lg font-semibold text-ink">
                        {formatDateline(entry.createdAt)}
                      </span>
                      <span className="shrink-0 text-xs text-softink">
                        {entry.wordCount}{" "}
                        {entry.wordCount === 1 ? "word" : "words"}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-softink">
                      {entryText(entry.content) || "An unwritten page"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 && (
            <p role="status" className="py-10 text-center text-sm text-softink">
              No entries match “{search}”.
            </p>
          )}
        </>
      )}
    </>
  );
}

function WriteView({
  entry,
  onBack,
  onDeleted,
}: {
  entry: Entry;
  onBack: () => void;
  onDeleted: (entry: Entry) => void;
}) {
  const latest = useRef(entry);
  const [words, setWords] = useState(entry.wordCount);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { writer, status } = useAutosave<Entry>(async (value) => {
    // update never recreates an entry deleted by another view or tab.
    if (!(await db.entries.update(entry.id!, value)))
      throw new Error("Entry no longer exists.");
  });
  async function leave() {
    setBusy(true);
    try {
      await writer.flush();
      onBack();
    } catch {
      setError(
        "Your latest changes are still here. Retry saving before leaving.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await writer.discard();
      await db.entries.delete(entry.id!);
      onDeleted(latest.current);
    } catch {
      writer.schedule(latest.current);
      setError("Could not delete this entry. Your draft is still here.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="writer">
      <header className="writer-header glass-toolbar">
        <button
          type="button"
          disabled={busy}
          onClick={leave}
          className="writer-back"
        >
          ← Entries
        </button>
        <SaveStatus
          status={status}
          onRetry={() => {
            void writer.flush().catch(() => {});
          }}
        />
        <div className="flex items-center gap-1">
          <details className="entry-menu">
            <summary
              aria-label="Entry options"
              className="tap-target flex list-none items-center justify-center"
            >
              <Icon as={DotsThree} size={24} />
            </summary>
            <div className="entry-menu-panel glass-sheet">
              <button
                type="button"
                disabled={busy}
                onClick={remove}
                aria-label="Delete entry"
                className="flex min-h-12 items-center gap-3 px-4 text-sm text-rust"
              >
                <Icon as={Trash} size={18} color="var(--color-rust)" />
                Delete entry
              </button>
            </div>
          </details>
          <button
            type="button"
            disabled={busy}
            onClick={leave}
            className="writer-done"
          >
            Done
          </button>
        </div>
      </header>
      <InlineError>{error}</InlineError>
      <div className="writer-body">
        <Suspense
          fallback={
            <p role="status" className="p-6 text-sm text-softink">
              Opening your page…
            </p>
          }
        >
          <Editor
            initialContent={entry.content}
            heading={formatDateline(entry.createdAt)}
            wordCount={words}
            onChange={(content, wordCount) => {
              latest.current = {
                ...latest.current,
                content,
                wordCount,
                updatedAt: Date.now(),
              };
              setWords(wordCount);
              writer.schedule(latest.current);
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
