import type { ComponentType } from "react";
import { Icon } from "./Icon";
import {
  BookOpen,
  CheckSquareOffset,
  ListNumbers,
  Repeat,
  Pulse,
  type IconProps,
} from "@phosphor-icons/react";

export type TabKey = "journal" | "tasks" | "priorities" | "habits" | "review";

interface TabDef {
  key: TabKey;
  label: string;
  Icon: ComponentType<IconProps>;
}

export const TABS: TabDef[] = [
  { key: "journal", label: "Journal", Icon: BookOpen },
  { key: "tasks", label: "Tasks", Icon: CheckSquareOffset },
  { key: "priorities", label: "Priorities", Icon: ListNumbers },
  { key: "habits", label: "Habits", Icon: Repeat },
  { key: "review", label: "Review", Icon: Pulse },
];

interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tab-bar glass-toolbar" aria-label="Primary">
      <ul className="flex">
        {TABS.map(({ key, label, Icon: Glyph }) => {
          const isActive = key === active;
          return (
            <li key={key} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(key)}
                aria-current={isActive ? "page" : undefined}
                className={`tab-item tap-target flex w-full flex-col items-center gap-1 py-2.5 ${isActive ? "is-active" : ""}`}
              >
                <Icon as={Glyph} active={isActive} size={24} />
                <span
                  className={[
                    "font-sans text-[11px] font-medium tracking-wide",
                    isActive ? "text-terracotta" : "text-softink",
                  ].join(" ")}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
