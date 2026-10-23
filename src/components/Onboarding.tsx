import type { ComponentType, CSSProperties } from "react";
import { motion } from "framer-motion";
import { Icon } from "./Icon";
import {
  BookBookmark,
  CheckCircle,
  Repeat,
  LockSimple,
  type IconProps,
} from "@phosphor-icons/react";

const FEATURES: {
  icon: ComponentType<IconProps>;
  color: string;
  title: string;
  body: string;
}[] = [
  {
    icon: BookBookmark,
    color: "var(--tint-brand)",
    title: "A quiet place to write",
    body: "A full-page journal with gentle prompts. Your words never leave this device.",
  },
  {
    icon: CheckCircle,
    color: "var(--tint-blue)",
    title: "Tasks and priorities",
    body: "See what's due today and rank what matters most.",
  },
  {
    icon: Repeat,
    color: "var(--tint-green)",
    title: "Habits that stick",
    body: "One tap a day. Watch your streaks grow and your rings close.",
  },
  {
    icon: LockSimple,
    color: "var(--tint-indigo)",
    title: "Private by design",
    body: "No account, no cloud. Add a passcode and keep backups on your terms.",
  },
];

/** First-run welcome, in the style of Apple's "Welcome to…" screens. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="onboarding"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <motion.img
          src="/icons/icon.svg"
          alt=""
          className="mx-auto h-[84px] w-[84px] rounded-[19px] shadow-xl"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 18,
            delay: 0.1,
          }}
        />
        <motion.h1
          id="welcome-title"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          Welcome to
          <br />
          <span style={{ color: "var(--tint-brand)" }}>Commonplace</span>
        </motion.h1>
        <ul className="mt-10 space-y-7">
          {FEATURES.map((feature, index) => (
            <motion.li
              key={feature.title}
              className="feature-row"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 + index * 0.08, duration: 0.42 }}
            >
              <span
                className="icon-tile !h-11 !w-11"
                style={
                  { "--tile": feature.color, "--r": "12px" } as CSSProperties
                }
              >
                <Icon as={feature.icon} size={26} color="#fff" weight="fill" />
              </span>
              <div className="min-w-0">
                <h2>{feature.title}</h2>
                <p>{feature.body}</p>
              </div>
            </motion.li>
          ))}
        </ul>
        <div className="flex-1" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75 }}
          className="pt-8"
        >
          <p className="mb-4 text-center text-[13px] leading-snug text-softink">
            Everything is stored privately on this device.
          </p>
          <button
            type="button"
            onClick={onDone}
            className="native-primary press w-full"
            style={{ "--tint": "var(--tint-brand)" } as CSSProperties}
          >
            Continue
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
