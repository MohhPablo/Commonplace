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
    <div className="empty-state">
      <Icon
        as={Glyph}
        size={38}
        color="var(--color-softink)"
        weight="regular"
      />
      <h2>{title}</h2>
      <p>{message}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
