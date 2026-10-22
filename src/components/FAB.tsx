import type { ComponentType } from "react";
import { Icon } from "./Icon";
import { Plus, type IconProps } from "@phosphor-icons/react";

/** Compact page action; kept in normal flow rather than floating over content. */
export function FAB({
  onPress,
  label,
  icon: Glyph = Plus,
}: {
  onPress: () => void;
  label: string;
  icon?: ComponentType<IconProps>;
}) {
  return (
    <div className="page-actions">
      <button
        type="button"
        onClick={onPress}
        aria-label={label}
        className="text-action"
      >
        <Icon
          as={Glyph}
          size={21}
          color="var(--color-terracotta)"
          weight="regular"
        />
        {label}
      </button>
    </div>
  );
}
