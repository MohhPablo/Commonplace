import { motion } from "framer-motion";
import { tap } from "../lib/haptics";

interface CheckboxProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  /** Accessible label for screen readers. */
  label?: string;
  /** Fill colour; defaults to the current section tint. */
  color?: string;
  size?: number;
}

/**
 * Reminders-style round checkbox. The ring fills with the tint and the
 * checkmark draws itself; the hit area stays 44pt regardless of size.
 */
export function Checkbox({
  checked,
  disabled = false,
  onChange,
  label,
  color = "var(--tint)",
  size = 24,
}: CheckboxProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        tap();
        onChange(!checked);
      }}
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: Math.max(44, size), height: Math.max(44, size) }}
    >
      <motion.span
        className="flex items-center justify-center rounded-full"
        initial={false}
        animate={{
          boxShadow: checked
            ? `inset 0 0 0 ${size}px ${color}`
            : "inset 0 0 0 1.75px var(--color-taupe)",
          scale: checked ? [1, 1.15, 1] : 1,
        }}
        transition={{ duration: 0.32, ease: [0.3, 0.7, 0.4, 1] }}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.62}
          height={size * 0.62}
          aria-hidden="true"
        >
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="#fff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.28, delay: checked ? 0.08 : 0 }}
          />
        </svg>
      </motion.span>
    </button>
  );
}
