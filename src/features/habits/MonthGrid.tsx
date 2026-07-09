interface MonthGridProps {
  year: number;
  month: number; // 0-indexed
  doneDates: Set<string>; // day keys completed
}

/**
 * Calendar-style completion view (spec §5.4): monthly grid where completed days
 * are marked with a small filled "ink stamp" dot — not a generic green heatmap.
 * Editorial paper feel: terracotta stamp on a warm taupe day cell.
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
    <div className="grid grid-cols-7 gap-1.5">
      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
        <div key={`h-${i}`} className="text-center font-sans text-[10px] text-softink">
          {d}
        </div>
      ))}
      {cells.map((d, i) => {
        if (d === null) return <div key={`b-${i}`} />;
        const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const done = doneDates.has(key);
        const isToday = key === todayStr;
        return (
          <div
            key={key}
            className="relative flex aspect-square items-center justify-center rounded-md"
            style={{
              background: isToday ? "#E4DCCB" : "transparent",
              border: isToday ? "1px solid #C1502D" : "1px solid transparent",
            }}
          >
            {done ? (
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: "#2B2420" }}
                aria-label={`Completed ${key}`}
              />
            ) : (
              <span className="font-sans text-xs text-softink">{d}</span>
            )}
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
