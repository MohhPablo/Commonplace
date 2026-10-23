interface MonthGridProps {
  year: number;
  month: number; // 0-indexed
  doneDates: Set<string>; // day keys completed
}

/**
 * Calendar-style completion view (spec §5.4): completed days fill with the
 * section tint, like a Fitness activity calendar; today is outlined.
 */
export function MonthGrid({ year, month, doneDates }: MonthGridProps) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date();
  const todayStr = `${todayKey.getFullYear()}-${String(todayKey.getMonth() + 1).padStart(2, "0")}-${String(todayKey.getDate()).padStart(2, "0")}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="month-grid">
      {/* 1 February 2026 is a Sunday, so these are localised Sun–Sat initials. */}
      {Array.from({ length: 7 }, (_, i) =>
        new Date(2026, 1, i + 1).toLocaleDateString(undefined, {
          weekday: "narrow",
        }),
      ).map((d, i) => (
        <div
          key={`h-${i}`}
          aria-hidden="true"
          className="pb-1 text-center text-[11px] font-semibold text-softink"
        >
          {d}
        </div>
      ))}
      {cells.map((d, i) => {
        if (d === null) return <div key={`b-${i}`} />;
        const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const done = doneDates.has(key);
        return (
          <div
            key={key}
            className="month-day"
            data-done={done}
            data-today={key === todayStr}
            role={done ? "img" : undefined}
            aria-label={done ? `Completed ${key}` : undefined}
          >
            {d}
          </div>
        );
      })}
    </div>
  );
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
