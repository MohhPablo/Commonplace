import type { ComponentType } from "react";
import { Icon } from "./Icon";
import type { IconProps } from "@phosphor-icons/react";

interface EmptyStateProps {
  icon: ComponentType<IconProps>;
  title: string;
  message: string;
  action?: React.ReactNode;
}

/** Shared empty state: a lit, tinted symbol tile above a short invitation. */
export function EmptyState({
  icon: Glyph,
  title,
  message,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="icon-tile">
        <Icon as={Glyph} size={34} color="#fff" weight="fill" />
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
