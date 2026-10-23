import {
  type Icon as PhosphorIconType,
  type IconProps as PhosphorProps,
  type IconWeight,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";

/**
 * App-wide icon wrapper around Phosphor.
 * - Regular weight reads like SF Symbols; `active` switches to the filled
 *   glyph and the current section tint, as iOS tab bars do.
 */
export function Icon({
  as: Glyph,
  active = false,
  color,
  weight,
  size = 24,
  ...rest
}: PhosphorProps & {
  as: ComponentType<PhosphorProps>;
  active?: boolean;
}) {
  const resolvedWeight: IconWeight = weight ?? (active ? "fill" : "regular");
  const resolvedColor =
    color ?? (active ? "var(--tint)" : "var(--color-softink)");
  return (
    <Glyph
      size={size}
      weight={resolvedWeight}
      color={resolvedColor}
      aria-hidden="true"
      {...rest}
    />
  );
}

export type { PhosphorIconType, PhosphorProps };
