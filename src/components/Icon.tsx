import {
  type Icon as PhosphorIconType,
  type IconProps as PhosphorProps,
  type IconWeight,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";

/**
 * App-wide icon wrapper around Phosphor.
 * - `duotone` weight renders the secondary layer as a low-opacity tint of
 *   `color`, giving the warm-terracotta-duotone look called for in spec §3.
 * - `active` switches light -> duotone and ink -> terracotta.
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
  const resolvedWeight: IconWeight = weight ?? (active ? "duotone" : "light");
  const resolvedColor = color ?? (active ? "#c1502d" : "#6b6058");
  return (
    <Glyph size={size} weight={resolvedWeight} color={resolvedColor} {...rest} />
  );
}

export type { PhosphorIconType, PhosphorProps };
