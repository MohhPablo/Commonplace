import { useEffect, useMemo, useRef, useState } from "react";
import {
  db,
  type Mood,
  type Entry,
  type Habit,
  type HabitLog,
} from "../../lib/db";
import { dayKey, fromDayKey } from "../../lib/date";
import { currentStreak } from "../../lib/habits";
import { Icon } from "../../components/Icon";
import { useAutosave } from "../../lib/useAutosave";
import { SaveStatus } from "../../components/SaveStatus";
import { InlineError } from "../../components/InlineError";
import {
  Notebook,
  Sparkle,
  SmileyMeh,
  ChartLineUp,
} from "@phosphor-icons/react";

// Stable-per-day reflection prompts (index derived from day number).
const PROMPTS = [
  "What felt most alive for you today?",
  "What is one small thing you're grateful for?",
  "What would make tomorrow a little lighter?",
  "What did you notice about yourself today?",
  "What's a gentle intention for tomorrow?",
  "What surprised you today?",
  "What are you quietly proud of?",
];

const MOODS = [
  { score: 1, label: "Rough", color: "var(--color-rust)" },
  { score: 2, label: "Low", color: "var(--color-rust)" },
  { score: 3, label: "Okay", color: "var(--color-ochre)" },
  { score: 4, label: "Good", color: "#7C8A5A" },
  { score: 5, label: "Great", color: "var(--color-sage)" },
];

export function Review() {
  const [mood, setMood] = useState<Mood | null>(null);
  const dirty = useRef(false);
  const [error, setError] = useState("");
  const [moodBusy, setMoodBusy] = useState(false);
  const [reflectionText, setReflectionText] = useState("");
  const [moodStrip, setMoodStrip] = useState<Mood[]>([]);
  const [stats, setStats] = useState<{
    bestStreak: number;
    wordsThisWeek: number;
    totalEntries: number;
    avgMood: number | null;
  }>({ bestStreak: 0, wordsThisWeek: 0, totalEntries: 0, avgMood: null });

  const today = dayKey();
  const { writer, status } = useAutosave<{ date: string; content: string }>(
    async ({ date, content }) => {
      await db.transaction("rw", db.reflections, async () => {
        const existing = await db.reflections
          .where("date")
          .equals(date)
          .first();
        if (!content.trim()) {
          if (existing?.id != null) await db.reflections.delete(existing.id);
        } else
          await db.reflections.put({
            ...existing,
            date,
            content,
            createdAt: existing?.createdAt ?? Date.now(),
          });
      });
    },
  );
  const prompt = useMemo(
    () =>
      PROMPTS[
        Math.floor(fromDayKey(today).getTime() / 86400000) % PROMPTS.length
      ],
    [today],
  );

  useEffect(() => {
    void load().catch(() =>
      setError(
        "Could not load your review. Please reopen the app to try again.",
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const [moods, reflections, entries, habits, logs] = await Promise.all([
      db.moods.orderBy("createdAt").reverse().toArray(),
      db.reflections.where("date").equals(today).toArray(),
      db.entries.toArray(),
      db.habits.toArray(),
      db.habitLogs.toArray(),
    ]);

    const todayMood = moods.find((m) => m.date === today) ?? null;
    setMood(todayMood);
    const todayRefl = reflections[0] ?? null;
    if (!dirty.current) setReflectionText(todayRefl?.content ?? "");

    // Last 7 days mood strip (oldest -> newest).
    const strip: Mood[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const m = moods.find((x) => x.date === key);
      if (m) strip.push(m);
    }
    setMoodStrip(strip);

    setStats(computeStats(entries, habits, logs, moods));
  }

  async function pickMood(m: (typeof MOODS)[number]) {
    if (moodBusy) return;
    setMoodBusy(true);
    try {
      await db.transaction("rw", db.moods, async () => {
        const existing = await db.moods.where("date").equals(today).first();
        await db.moods.put({
          ...existing,
          date: today,
          score: m.score,
          label: m.label,
          createdAt: existing?.createdAt ?? Date.now(),
        });
      });
      await load();
    } catch {
      setError("Could not save your mood. Please try again.");
    } finally {
      setMoodBusy(false);
    }
  }

  return (
    <div className="screen-pad">
      <InlineError>{error}</InlineError>
      {/* Daily reflection */}
      <section className="mt-4 rounded-xl border border-taupe bg-surface p-4 shadow-page">
        <div className="flex items-center gap-2">
          <Icon
            as={Notebook}
            size={18}
            color="var(--color-terracotta)"
            weight="duotone"
          />
          <span className="font-sans text-sm font-medium text-ink">
            Today's reflection
          </span>
        </div>
        <p className="mt-2 font-serif text-lg italic text-softink">
          “{prompt}”
        </p>
        <textarea
          aria-label="Today's reflection"
          value={reflectionText}
          onChange={(e) => {
            dirty.current = true;
            setReflectionText(e.target.value);
            writer.schedule({ date: today, content: e.target.value });
          }}
          onBlur={() => {
            void writer.flush().catch(() => {});
          }}
          placeholder="A few lines, just for you…"
          rows={3}
          className="mt-3 w-full resize-none rounded-lg border border-taupe bg-paper px-3 py-2 font-sans text-sm text-ink placeholder:text-softink focus:outline-none"
        />
        <div className="mt-2 text-right">
          <SaveStatus
            status={status}
            onRetry={() => {
              void writer.flush().catch(() => {});
            }}
          />
        </div>
      </section>

      {/* Mood */}
      <section className="mt-3 rounded-xl border border-taupe bg-surface p-4 shadow-page">
        <div className="flex items-center gap-2">
          <Icon
            as={SmileyMeh}
            size={18}
            color="var(--color-terracotta)"
            weight="duotone"
          />
          <span className="font-sans text-sm font-medium text-ink">
            How are you?
          </span>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1">
          {MOODS.map((m) => (
            <button
              key={m.score}
              type="button"
              disabled={moodBusy}
              onClick={() => pickMood(m)}
              aria-label={m.label}
              aria-pressed={mood?.score === m.score}
              className="interactive flex min-h-16 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border px-1 py-2"
              style={{
                borderColor:
                  mood?.score === m.score ? m.color : "var(--color-taupe)",
                background:
                  mood?.score === m.score ? "var(--color-ink)" : "transparent",
              }}
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{ background: m.color }}
              />
              <span
                className="text-xs font-medium"
                style={{
                  color:
                    mood?.score === m.score
                      ? "var(--color-paper)"
                      : "var(--color-ink)",
                }}
              >
                {m.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 7-day mood strip */}
      <section className="mt-3 rounded-xl border border-taupe bg-surface p-4 shadow-page">
        <span className="font-sans text-sm font-medium text-ink">
          Last 7 days
        </span>
        <div className="mt-3 flex items-end justify-between gap-1">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const m = moodStrip.find((x) => x.date === dayKey(d));
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span
                  role="img"
                  aria-label={`${dayKey(d)}: ${m ? MOODS[m.score - 1].label : "No mood recorded"}`}
                  className="h-8 w-8 rounded-full"
                  style={{
                    background: m
                      ? (MOODS[m.score - 1]?.color ?? "var(--color-taupe)")
                      : "var(--color-taupe)",
                    opacity: m ? 1 : 0.4,
                  }}
                />
                <span className="font-sans text-[10px] text-softink">
                  {fromDayKey(dayKey(d))
                    .toLocaleDateString(undefined, { weekday: "short" })
                    .slice(0, 1)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Insights */}
      <section className="mt-3 rounded-xl border border-taupe bg-surface p-4 shadow-page">
        <div className="flex items-center gap-2">
          <Icon
            as={ChartLineUp}
            size={18}
            color="var(--color-terracotta)"
            weight="duotone"
          />
          <span className="font-sans text-sm font-medium text-ink">
            Past seven days
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Top current streak" value={`${stats.bestStreak}d`} />
          <Stat label="Words in new entries" value={`${stats.wordsThisWeek}`} />
          <Stat label="Entries · all time" value={`${stats.totalEntries}`} />
          <Stat
            label="Average mood · 7 days"
            value={
              stats.avgMood != null ? `${stats.avgMood.toFixed(1)}/5` : "—"
            }
          />
        </div>
      </section>

      <div className="mt-4 flex items-center gap-1.5 font-sans text-xs text-softink">
        <Icon as={Sparkle} size={14} color="var(--color-ochre)" weight="fill" />
        Small steps, gently remembered.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper px-3 py-2">
      <div className="font-serif text-xl font-semibold text-ink">{value}</div>
      <div className="font-sans text-[11px] text-softink">{label}</div>
    </div>
  );
}

function computeStats(
  entries: Entry[],
  habits: Habit[],
  logs: HabitLog[],
  moods: Mood[],
): {
  bestStreak: number;
  wordsThisWeek: number;
  totalEntries: number;
  avgMood: number | null;
} {
  const weekAgo = Date.now() - 7 * 86400000;
  const bestStreak = habits
    .filter((h) => !h.archived)
    .reduce((max, h) => Math.max(max, currentStreak(h.id!, logs)), 0);
  const wordsThisWeek = entries
    .filter((e) => e.createdAt >= weekAgo)
    .reduce((sum, e) => sum + (e.wordCount ?? 0), 0);
  const scored = moods.filter(
    (m) =>
      m.score >= 1 &&
      m.score <= 5 &&
      m.date >= dayKey(new Date(weekAgo)) &&
      m.date <= dayKey(),
  );
  const avgMood = scored.length
    ? scored.reduce((s, m) => s + m.score, 0) / scored.length
    : null;
  return {
    bestStreak,
    wordsThisWeek,
    totalEntries: entries.length,
    avgMood,
  };
}
