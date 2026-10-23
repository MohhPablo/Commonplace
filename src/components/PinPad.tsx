import { useState } from "react";

const LETTERS: Record<string, string> = {
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
};

/**
 * Custom numeric keypad (spec §2) — replaces the native password <input> on
 * the lock screen so the OS keyboard never slides up and breaks the layout.
 * Laid out like the iPhone passcode screen. Calls `onComplete` automatically
 * once `length` digits are entered.
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

  const key = (digit: string) => (
    <button
      key={digit}
      type="button"
      disabled={disabled}
      aria-label={`Digit ${digit}`}
      onClick={() => press(digit)}
      className="pin-key"
    >
      <b>{digit}</b>
      {digit !== "0" && <small>{LETTERS[digit] ?? "\u00a0"}</small>}
    </button>
  );

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
      <div className="pin-dots" aria-hidden="true">
        {Array.from({ length }).map((_, i) => (
          <span key={i} data-filled={i < value.length} />
        ))}
      </div>

      <div className="pin-grid">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(key)}
        <span />
        {key("0")}
        <button
          type="button"
          disabled={disabled || !value}
          aria-label="Delete"
          onClick={del}
          className="pin-key is-plain"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
