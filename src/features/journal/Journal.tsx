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
  NotePencil,
  MagnifyingGlass,
  DotsThree,
  XCircle,
  Trash,
  ArrowRight,
} from "@phosphor-icons/react";
import { dayKey } from "../../lib/date";
import { entryPreview, entryText } from "../../lib/entryText";
import { HeaderAction } from "../../components/FAB";
import { AnimatedNumber } from "../../components/AnimatedNumber";
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
          <HeaderAction>
            <button
              type="button"
              onClick={startNew}
              onPointerEnter={() => {
                void loadEditor();
              }}
              onFocus={() => {
                void loadEditor();
              }}
              aria-label="New entry"
              title="New entry"
              className="header-button is-primary press"
            >
              <Icon
                as={NotePencil}
                size={22}
                color="currentColor"
                weight="bold"
              />
            </button>
          </HeaderAction>
          <InlineError>{error}</InlineError>
          <EntryList
            search={search}
            onSearch={setSearch}
            onOpen={setCurrent}
            onStart={startNew}
          />
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

const WRITING_PROMPTS = [
  "What happened today that you want to remember?",
  "What's been on your mind lately?",
  "Describe a small moment from today.",
  "What are you looking forward to?",
  "What did today teach you?",
];

function journalStats(entries: Entry[], today: string) {
  const days = new Set(
    entries.map((entry) => dayKey(new Date(entry.createdAt))),
  );
  const cursor = new Date();
  // A streak survives until the end of today, so start from yesterday if needed.
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const weekAgo = Date.now() - 7 * 86_400_000;
  const words = entries
    .filter((entry) => entry.createdAt >= weekAgo)
    .reduce((sum, entry) => sum + (entry.wordCount ?? 0), 0);
  return { streak, words, writtenToday: days.has(today) };
}

function EntryList({
  search,
  onSearch,
  onOpen,
  onStart,
}: {
  search: string;
  onSearch: (value: string) => void;
  onOpen: (entry: Entry) => void;
  onStart: () => void;
}) {
  const { value: entries, error, loading } = useQuery(loadEntries, []);
  if (loading)
    return (
      <div className="h-24" role="status" aria-label="Loading entries">
        <span className="sr-only">Loading entries…</span>
      </div>
    );
  const today = dayKey();
  const stats = journalStats(entries, today);
  const query = search.trim().toLocaleLowerCase();
  const filtered = entries.filter(
    (entry) =>
      !query || entryText(entry.content).toLocaleLowerCase().includes(query),
  );
  const monthOf = (entry: Entry) =>
    new Date(entry.createdAt).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  const months: { label: string; entries: Entry[] }[] = [];
  for (const entry of filtered) {
    const label = monthOf(entry);
    const last = months[months.length - 1];
    if (last?.label === label) last.entries.push(entry);
    else months.push({ label, entries: [entry] });
  }
  const prompt =
    WRITING_PROMPTS[
      Math.floor(Date.now() / 86_400_000) % WRITING_PROMPTS.length
    ];
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
          message="A thought, a memory, a few lines about today. Everything stays on this device."
          action={
            <button
              type="button"
              onClick={onStart}
              className="native-primary press"
            >
              Write your first entry
            </button>
          }
        />
      ) : (
        <>
          <div className="summary-row">
            <div className="stat-tile">
              <strong>
                <AnimatedNumber value={entries.length} />
              </strong>
              <span>{entries.length === 1 ? "Entry" : "Entries"}</span>
            </div>
            <div className="stat-tile">
              <strong>
                <AnimatedNumber value={stats.streak} />
              </strong>
              <span>Day streak</span>
            </div>
            <div className="stat-tile">
              <strong>
                <AnimatedNumber value={stats.words} />
              </strong>
              <span>Words this week</span>
            </div>
          </div>
          {!stats.writtenToday && !query && (
            <div className="prompt-card card">
              <span className="eyebrow">Today's prompt</span>
              <p>{prompt}</p>
              <button type="button" onClick={onStart} className="press">
                Write about today
                <ArrowRightIcon />
              </button>
            </div>
          )}
          <div className="search-field mt-4">
            <Icon as={MagnifyingGlass} size={18} />
            <input
              type="search"
              aria-label="Search entries"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search your writing"
              className="min-h-10 min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-softink [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearch("")}
                aria-label="Clear search"
                className="tap-target flex items-center justify-center"
              >
                <Icon as={XCircle} size={18} weight="fill" />
              </button>
            )}
          </div>
          <div className="entry-list">
            {months.map((month) => (
              <section key={month.label}>
                <h2 className="entry-month">{month.label}</h2>
                <ul className="entry-group">
                  {month.entries.map((entry) => {
                    const { title, excerpt } = entryPreview(entry.content);
                    const created = new Date(entry.createdAt);
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(entry)}
                          onPointerEnter={() => {
                            void loadEditor();
                          }}
                          className="entry-card press"
                        >
                          <span className="entry-date" aria-hidden="true">
                            <span className="entry-weekday">
                              {created.toLocaleDateString(undefined, {
                                weekday: "short",
                              })}
                            </span>
                            <span className="entry-day">
                              {created.getDate()}
                            </span>
                          </span>
                          <span className="entry-body">
                            <span className="entry-title">
                              {title || "New entry"}
                            </span>
                            {excerpt && (
                              <span className="entry-excerpt line-clamp-2 block">
                                {excerpt}
                              </span>
                            )}
                            <span className="entry-meta">
                              <span>
                                {created.toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                })}
                                {" · "}
                                {created.toLocaleTimeString(undefined, {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {entry.wordCount}{" "}
                                {entry.wordCount === 1 ? "word" : "words"}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
          {filtered.length === 0 && (
            <p
              role="status"
              className="py-10 text-center text-[15px] text-softink"
            >
              No entries match “{search}”.
            </p>
          )}
        </>
      )}
    </>
  );
}

function ArrowRightIcon() {
  return <Icon as={ArrowRight} size={16} color="currentColor" weight="bold" />;
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
      <header className="writer-header">
        <button
          type="button"
          disabled={busy}
          onClick={leave}
          className="writer-back glass press"
        >
          <Icon as={CaretLeft} size={20} color="currentColor" weight="bold" />
          Entries
        </button>
        <SaveStatus
          status={status}
          onRetry={() => {
            void writer.flush().catch(() => {});
          }}
        />
        <div className="flex items-center gap-2">
          <details className="entry-menu">
            <summary
              aria-label="Entry options"
              className="header-button glass flex list-none items-center justify-center"
            >
              <Icon
                as={DotsThree}
                size={24}
                color="var(--color-ink)"
                weight="bold"
              />
            </summary>
            <div className="entry-menu-panel glass">
              <button
                type="button"
                disabled={busy}
                onClick={remove}
                aria-label="Delete entry"
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-[17px] text-rust"
              >
                Delete entry
                <Icon as={Trash} size={20} color="var(--color-rust)" />
              </button>
            </div>
          </details>
          <button
            type="button"
            disabled={busy}
            onClick={leave}
            className="writer-done press"
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
            heading={new Date(entry.createdAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
            })}
            eyebrow={`${new Date(entry.createdAt).toLocaleDateString(
              undefined,
              {
                weekday: "long",
              },
            )}, ${new Date(entry.createdAt).getFullYear()}`}
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
