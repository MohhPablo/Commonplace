import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { Icon } from "./Icon";
import {
  BookBookmark,
  CheckCircle,
  Star,
  Repeat,
  Sparkle,
  type IconProps,
} from "@phosphor-icons/react";

export type TabKey = "journal" | "tasks" | "priorities" | "habits" | "review";

interface TabDef {
  key: TabKey;
  label: string;
  Icon: ComponentType<IconProps>;
}

export const TABS: TabDef[] = [
  { key: "journal", label: "Journal", Icon: BookBookmark },
  { key: "tasks", label: "Tasks", Icon: CheckCircle },
  { key: "priorities", label: "Priorities", Icon: Star },
  { key: "habits", label: "Habits", Icon: Repeat },
  { key: "review", label: "Review", Icon: Sparkle },
];

interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
}

/** A floating glass capsule; the selection lozenge glides between tabs. */
export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tab-bar glass" aria-label="Primary">
      <ul>
        {TABS.map(({ key, label, Icon: Glyph }) => {
          const isActive = key === active;
          return (
            <li key={key} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(key)}
                aria-current={isActive ? "page" : undefined}
                className={`tab-item tap-target ${isActive ? "is-active" : ""}`}
              >
                {isActive && (
                  <motion.span
                    layoutId="tab-pill"
                    className="tab-pill"
                    transition={{ type: "spring", stiffness: 520, damping: 40 }}
                  />
                )}
                <Icon
                  as={Glyph}
                  active={isActive}
                  color={isActive ? "var(--tint)" : "var(--color-ink)"}
                  size={25}
                />
                <span>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
