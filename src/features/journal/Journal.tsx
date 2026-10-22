import {
  lazy,
  Suspense,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { WritingMode } from "../../lib/WritingMode";
import { db, type Entry } from "../../lib/db";
import { EmptyState } from "../../components/EmptyState";
import { InlineError } from "../../components/InlineError";
import { SaveStatus } from "../../components/SaveStatus";
import { UndoSnackbar } from "../../components/UndoSnackbar";
import { Icon } from "../../components/Icon";
import {
  BookOpen,
  CaretLeft,
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

const loadEditor = () =>
  import("./Editor").then((module) => ({ default: module.Editor }));
const Editor = lazy(loadEditor);
const loadEntries = () => db.entries.orderBy("createdAt").reverse().toArray();

export function Journal() {
  const setWriting = useContext(WritingMode);
  const [current, setCurrent] = useState<Entry | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const creating = useRef(false);
  useLayoutEffect(() => {
    setWriting(current !== null);
    return () => setWriting(false);
  }, [current, setWriting]);
  const undo = useUndo(() => {});

  async function startNew() {
    if (creating.current) return;
    creating.current = true;
    void loadEditor();
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
          <div className="page-actions">
            <button
              type="button"
              onClick={startNew}
              onPointerEnter={() => {
                void loadEditor();
              }}
              onFocus={() => {
                void loadEditor();
              }}
              className="text-action"
            >
              <Icon
                as={PencilSimple}
                size={18}
                color="var(--color-terracotta)"
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
          title="Your journal starts here"
          message="A thought, a memory, a few lines about today."
        />
      ) : (
        <>
          <div className="search-field">
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
          <ul className="entry-list">
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
                    <h2 className="entry-month">{month}</h2>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpen(entry)}
                    onPointerEnter={() => {
                      void loadEditor();
                    }}
                    className="entry-row"
                  >
                    <span className="entry-title">
                      {entryText(entry.content).trim().slice(0, 80) ||
                        "New entry"}
                    </span>
                    <span className="entry-meta">
                      <span>
                        {new Date(entry.createdAt).toLocaleDateString(
                          undefined,
                          { day: "numeric", month: "short" },
                        )}
                      </span>
                      <span>
                        {entry.wordCount}{" "}
                        {entry.wordCount === 1 ? "word" : "words"}
                      </span>
                    </span>
                    {entryText(entry.content).trim().length > 80 && (
                      <p className="entry-excerpt line-clamp-2">
                        {entryText(entry.content).trim().slice(80)}
                      </p>
                    )}
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
          <Icon as={CaretLeft} size={22} color="var(--color-terracotta)" />{" "}
          Entries
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
