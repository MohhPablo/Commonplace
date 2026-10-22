import { motion } from "framer-motion";
import { Icon } from "./Icon";
import { Check } from "@phosphor-icons/react";
import { tap } from "../lib/haptics";

interface CheckboxProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  /** Accessible label for screen readers. */
  label?: string;
  tone?: "terracotta" | "sage";
  size?: number;
}

/**
 * Custom checkbox (spec §3: never use default browser input styling).
 * A drawn checkmark springs in via SVG path animation + a small scale bounce,
 * satisfying the "checkmark that draws itself" requirement (§3 motion notes).
 * No Vibration API (unsupported on iOS — ref §1) and no haptics.
 */
export function Checkbox({
  checked,
  disabled = false,
  onChange,
  label,
  tone = "terracotta",
  size = 24,
}: CheckboxProps) {
  const color =
    tone === "sage" ? "var(--color-sage)" : "var(--color-terracotta)";
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
      className="interactive flex items-center justify-center rounded-full"
      style={{ width: Math.max(44, size), height: Math.max(44, size) }}
    >
      <motion.span
        className="flex items-center justify-center rounded-full border-2"
        animate={{
          borderColor: checked ? color : "var(--color-taupe)",
          backgroundColor: checked ? color : "rgba(0,0,0,0)",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{ width: size, height: size }}
      >
        <motion.span
          initial={false}
          animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 22 }}
        >
          <Icon
            as={Check}
            weight="bold"
            size={size * 0.62}
            color="var(--color-onaccent)"
          />
        </motion.span>
      </motion.span>
    </button>
  );
}
