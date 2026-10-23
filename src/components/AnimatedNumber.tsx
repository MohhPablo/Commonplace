import NumberFlow, { type Format } from "@number-flow/react";

// NumberFlow animates with the Web Animations API; fall back to plain text
// where it is missing (older engines, the DOM test environment).
const canAnimate =
  typeof Element !== "undefined" &&
  typeof Element.prototype.animate === "function";

/** Digits that roll into place when the value changes. */
export function AnimatedNumber({
  value,
  suffix,
  format,
}: {
  value: number;
  suffix?: string;
  format?: Format;
}) {
  if (!canAnimate)
    return (
      <>
        {new Intl.NumberFormat(undefined, format).format(value)}
        {suffix}
      </>
    );
  return <NumberFlow value={value} suffix={suffix} format={format} />;
}
