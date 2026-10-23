import { motion } from "framer-motion";

export interface Ring {
  /** 0–1; values above 1 render as a full ring. */
  value: number;
  color: string;
  label: string;
}

/**
 * Concentric activity rings. Each ring sweeps from twelve o'clock with a
 * spring, over a faint track in the same colour.
 */
export function ProgressRing({
  rings,
  size = 72,
  stroke = 10,
  gap = 2,
  children,
}: {
  rings: Ring[];
  size?: number;
  stroke?: number;
  gap?: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={rings
        .map(
          (ring) =>
            `${ring.label} ${Math.round(Math.min(1, ring.value) * 100)}%`,
        )
        .join(", ")}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring, index) => {
          const radius = size / 2 - stroke / 2 - index * (stroke + gap);
          if (radius <= stroke / 2) return null;
          return (
            <g
              key={ring.label}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeOpacity={0.2}
                strokeWidth={stroke}
              />
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: Math.max(0.0001, Math.min(1, ring.value)),
                  // Round caps would otherwise paint a dot for an empty ring.
                  opacity: ring.value > 0 ? 1 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 110,
                  damping: 20,
                  delay: 0.1 + index * 0.08,
                }}
              />
            </g>
          );
        })}
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
