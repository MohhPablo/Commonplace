import { WarningCircle } from "@phosphor-icons/react";
import { Icon } from "./Icon";

export function InlineError({ children }: { children?: React.ReactNode }) {
  return children ? (
    <p role="alert" className="inline-error">
      <Icon
        as={WarningCircle}
        size={20}
        weight="fill"
        color="currentColor"
        className="mt-px shrink-0"
      />
      <span>{children}</span>
    </p>
  ) : null;
}
