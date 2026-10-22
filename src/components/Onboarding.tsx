import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./Icon";
import { BookOpen, Repeat, Pulse, ArrowRight } from "@phosphor-icons/react";

const CARDS = [
  {
    icon: BookOpen,
    title: "A quiet place to write",
    body: "Capture the day in your Journal. Everything stays on your device — no accounts, no cloud.",
  },
  {
    icon: Repeat,
    title: "Small habits, gentle streaks",
    body: "Tap a habit done for today, watch your streak grow, and set a daily reminder that fits you.",
  },
  {
    icon: Pulse,
    title: "Reflect & review",
    body: "Answer one prompt each evening, note your mood, and see warm insights about your week.",
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const card = CARDS[step];
  const last = step === CARDS.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-paper px-8"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center text-center"
        >
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface shadow-lift">
            <Icon
              as={card.icon}
              size={40}
              color="var(--color-terracotta)"
              weight="duotone"
            />
          </div>
          <h2 className="font-serif text-2xl font-semibold text-ink">
            {card.title}
          </h2>
          <p className="mt-3 max-w-xs font-sans text-sm text-softink">
            {card.body}
          </p>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center gap-2">
        {CARDS.map((_, i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full"
            style={{
              background:
                i === step ? "var(--color-terracotta)" : "var(--color-taupe)",
            }}
          />
        ))}
      </div>

      <div className="mt-8 flex w-full max-w-xs items-center justify-between">
        <button
          type="button"
          onClick={onDone}
          className="interactive font-sans text-sm text-softink underline"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => (last ? onDone() : setStep((s) => s + 1))}
          className="interactive flex items-center gap-1.5 rounded-full bg-terracotta px-5 py-2.5 font-sans text-sm font-medium text-onaccent"
        >
          {last ? "Get started" : "Next"}
          {!last && (
            <Icon
              as={ArrowRight}
              size={16}
              color="var(--color-onaccent)"
              weight="bold"
            />
          )}
        </button>
      </div>
    </motion.div>
  );
}
