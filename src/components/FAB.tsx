import type { ComponentType } from "react";
import { Icon } from "./Icon";
import { Plus, type IconProps } from "@phosphor-icons/react";

/**
 * Floating action button for "add" affordances. Sits above the fixed TabBar
 * (spec §4) so it never collides with the nav or the home indicator.
 */
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
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="interactive fixed right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-terracotta text-surface shadow-lift"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" }}
    >
      <Icon as={Glyph} size={26} color="#FDFBF7" weight="bold" />
    </button>
  );
}
