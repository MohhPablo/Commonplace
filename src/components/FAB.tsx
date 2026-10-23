import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { Plus, type IconProps } from "@phosphor-icons/react";

/** The navigation bar's trailing button area, provided by the app shell. */
export const HeaderSlot = createContext<HTMLElement | null>(null);

/** Places a screen's primary action in the navigation bar when one exists. */
export function HeaderAction({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlot);
  return slot ? (
    createPortal(children, slot)
  ) : (
    <div className="page-actions">{children}</div>
  );
}

/** The screen's add action: a tinted circular button in the navigation bar. */
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
    <HeaderAction>
      <button
        type="button"
        onClick={onPress}
        aria-label={label}
        title={label}
        className="header-button is-primary press"
      >
        <Icon as={Glyph} size={22} color="currentColor" weight="bold" />
      </button>
    </HeaderAction>
  );
}
