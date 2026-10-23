import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  db,
  type Mood,
  type Entry,
  type Habit,
  type HabitLog,
} from "../../lib/db";
import { dayKey, fromDayKey } from "../../lib/date";
import { currentStreak, isDoneOn } from "../../lib/habits";
import { Icon } from "../../components/Icon";
import { useAutosave } from "../../lib/useAutosave";
import { SaveStatus } from "../../components/SaveStatus";
import { InlineError } from "../../components/InlineError";
import {
  Notebook,
  Smiley,
  ChartBar,
  Flame,
  PencilLine,
  BookOpen,
  Heart,
  type IconProps,
} from "@phosphor-icons/react";
import { ProgressRing } from "../../components/ProgressRing";
import { AnimatedNumber } from "../../components/AnimatedNumber";

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
  { score: 1, label: "Rough", color: "var(--tint-indigo)" },
  { score: 2, label: "Low", color: "var(--tint-blue)" },
  { score: 3, label: "Okay", color: "var(--tint-teal)" },
  { score: 4, label: "Good", color: "var(--tint-green)" },
  { score: 5, label: "Great", color: "var(--tint-orange)" },
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
  const [day, setDay] = useState({
    habitsDone: 0,
    habitsTotal: 0,
    tasksDone: 0,
    tasksDue: 0,
  });

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
    const [moods, reflections, entries, habits, logs, tasks] =
      await Promise.all([
        db.moods.orderBy("createdAt").reverse().toArray(),
        db.reflections.where("date").equals(today).toArray(),
        db.entries.toArray(),
        db.habits.toArray(),
        db.habitLogs.toArray(),
        db.tasks.toArray(),
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
    const active = habits.filter((h) => !h.archived);
    const tasksDone = tasks.filter(
      (t) =>
        t.completed &&
        t.completedAt &&
        dayKey(new Date(t.completedAt)) === today,
    ).length;
    setDay({
      habitsDone: active.filter((h) => isDoneOn(logs, h.id!, today)).length,
      habitsTotal: active.length,
      tasksDone,
      tasksDue:
        tasksDone +
        tasks.filter((t) => !t.completed && t.dueDate && t.dueDate <= today)
          .length,
    });
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

  const reflected = (mood ? 1 : 0) + (reflectionText.trim() ? 1 : 0);
  const rings = [
    {
      label: "Habits",
      value: day.habitsTotal ? day.habitsDone / day.habitsTotal : 0,
      color: "var(--tint-green)",
      detail: day.habitsTotal
        ? `${day.habitsDone}/${day.habitsTotal}`
        : "None yet",
    },
    {
      label: "Tasks",
      value: day.tasksDue ? day.tasksDone / day.tasksDue : 0,
      color: "var(--tint-blue)",
      detail: day.tasksDue ? `${day.tasksDone}/${day.tasksDue}` : "Nothing due",
    },
    {
      label: "Reflect",
      value: reflected / 2,
      color: "var(--tint-pink)",
      detail: `${reflected}/2`,
    },
  ];

  return (
    <div className="screen-pad">
      <InlineError>{error}</InlineError>
      {/* Today at a glance */}
      <section className="review-section card ring-card">
        <ProgressRing rings={rings} size={112} stroke={14} gap={2} />
        <div className="rings-legend">
          {rings.map((ring) => (
            <div key={ring.label}>
              <span style={{ color: ring.color }}>{ring.label}</span>
              <strong>{ring.detail}</strong>
            </div>
          ))}
        </div>
      </section>

      {/* Daily reflection */}
      <section className="review-section card p-4">
        <div className="card-heading">
          <Icon as={Notebook} size={18} color="var(--tint)" weight="fill" />
          Today's reflection
        </div>
        <p className="reflection-prompt">{prompt}</p>
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
          className="reflection-input placeholder:text-softink"
        />
        <div className="mt-2 min-h-5 text-right">
          {(dirty.current || status === "error") && (
            <SaveStatus
              status={status}
              onRetry={() => {
                void writer.flush().catch(() => {});
              }}
            />
          )}
        </div>
      </section>

      {/* Mood */}
      <section className="review-section card p-4">
        <div className="card-heading">
          <Icon as={Smiley} size={18} color="var(--tint)" weight="fill" />
          How are you feeling?
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
              className="mood-option"
              style={{ "--orb": m.color } as React.CSSProperties}
            >
              <span className="mood-orb" />
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 7-day mood chart */}
      <section className="review-section card p-4">
        <div className="card-heading">
          <Icon as={ChartBar} size={18} color="var(--tint)" weight="fill" />
          Mood · last 7 days
        </div>
        <div className="mood-chart">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const m = moodStrip.find((x) => x.date === dayKey(d));
            const info = m ? MOODS[m.score - 1] : null;
            return (
              <div key={i}>
                <motion.span
                  role="img"
                  aria-label={`${dayKey(d)}: ${info ? info.label : "No mood recorded"}`}
                  className="mood-bar"
                  initial={{ height: 6 }}
                  animate={{ height: m ? `${m.score * 18}%` : 6 }}
                  transition={{
                    type: "spring",
                    stiffness: 140,
                    damping: 18,
                    delay: i * 0.03,
                  }}
                  style={{
                    background: info
                      ? `linear-gradient(180deg, color-mix(in srgb, ${info.color} 70%, white), ${info.color})`
                      : undefined,
                  }}
                />
                <span style={i === 6 ? { color: "var(--tint)" } : undefined}>
                  {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Insights */}
      <h2 className="group-title">Insights</h2>
      <div className="stat-grid">
        <Stat
          icon={Flame}
          color="var(--tint-orange)"
          label="Top current streak"
          value={stats.bestStreak}
          suffix="d"
        />
        <Stat
          icon={PencilLine}
          color="var(--color-terracotta)"
          label="Words this week"
          value={stats.wordsThisWeek}
        />
        <Stat
          icon={BookOpen}
          color="var(--tint-indigo)"
          label="Entries · all time"
          value={stats.totalEntries}
        />
        <Stat
          icon={Heart}
          color="var(--tint-pink)"
          label="Average mood · 7 days"
          value={stats.avgMood}
          suffix="/5"
          decimals
        />
      </div>
    </div>
  );
}

function Stat({
  icon,
  color,
  label,
  value,
  suffix,
  decimals = false,
}: {
  icon: React.ComponentType<IconProps>;
  color: string;
  label: string;
  value: number | null;
  suffix?: string;
  decimals?: boolean;
}) {
  return (
    <div className="stat-tile">
      <Icon as={icon} size={20} color={color} weight="fill" />
      <strong className="mt-1.5">
        {value == null ? (
          "—"
        ) : (
          <AnimatedNumber
            value={value}
            suffix={suffix}
            format={
              decimals
                ? { minimumFractionDigits: 1, maximumFractionDigits: 1 }
                : undefined
            }
          />
        )}
      </strong>
      <span>{label}</span>
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
