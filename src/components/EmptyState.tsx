import type { ComponentType } from "react";
import { Icon } from "./Icon";
import type { IconProps } from "@phosphor-icons/react";

interface EmptyStateProps {
  icon: ComponentType<IconProps>;
  title: string;
  message: string;
  action?: React.ReactNode;
}

/**
 * Shared empty-state used across tabs (spec §11: empty states must use the
 * palette, not look like a generic component-library demo).
 */
export function EmptyState({
  icon: Glyph,
  title,
  message,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface shadow-page">
        <Icon
          as={Glyph}
          size={30}
          color="var(--color-terracotta)"
          weight="duotone"
        />
      </div>
      <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 max-w-xs font-sans text-sm leading-relaxed text-softink">
        {message}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
