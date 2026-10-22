import { useState } from "react";
import { Icon } from "./Icon";
import { Backspace } from "@phosphor-icons/react";

/**
 * Custom numeric keypad (spec §2) — replaces the native password <input> on
 * the lock screen so the OS keyboard never slides up and breaks the layout.
 * Calls `onComplete` automatically once `length` digits are entered.
 */
export function PinPad({
  length = 4,
  onComplete,
  disabled = false,
}: {
  length?: number;
  onComplete: (pin: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function press(d: string) {
    if (disabled || value.length >= length) return;
    const next = value + d;
    setValue(next);
    if (next.length === length) onComplete(next);
  }

  function del() {
    if (disabled) return;
    setValue((v) => v.slice(0, -1));
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div
      role="group"
      aria-label="Passcode keypad"
      onKeyDown={(event) => {
        if (/^\d$/.test(event.key)) {
          event.preventDefault();
          press(event.key);
        } else if (event.key === "Backspace") {
          event.preventDefault();
          del();
        }
      }}
    >
      <span className="sr-only" role="status">
        {value.length} of {length} digits entered
      </span>
      <div className="flex justify-center gap-3">
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className="h-3.5 w-3.5 rounded-full border-2 transition-transform"
            style={{
              borderColor: "var(--color-taupe)",
              background:
                i < value.length ? "var(--color-terracotta)" : "transparent",
              transform: i < value.length ? "scale(1.2)" : "scale(1)",
            }}
          />
        ))}
      </div>

      <div className="mx-auto mt-6 grid w-full max-w-[280px] grid-cols-3 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            aria-label={`Digit ${k}`}
            onClick={() => press(k)}
            className="interactive flex h-[4.5rem] items-center justify-center rounded-2xl bg-surface font-serif text-2xl font-semibold text-ink shadow-page transition-transform active:scale-95"
          >
            {k}
          </button>
        ))}
        <span />
        <button
          type="button"
          disabled={disabled}
          aria-label="Digit 0"
          onClick={() => press("0")}
          className="interactive flex h-[4.5rem] items-center justify-center rounded-2xl bg-surface font-serif text-2xl font-semibold text-ink shadow-page transition-transform active:scale-95"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label="Delete"
          onClick={del}
          className="interactive flex h-[4.5rem] items-center justify-center rounded-2xl bg-surface transition-transform active:scale-95"
        >
          <Icon
            as={Backspace}
            size={24}
            color="var(--color-softink)"
            weight="light"
          />
        </button>
      </div>
    </div>
  );
}
