import { useEffect, useState } from "react";
import { dayKey } from "./date";

export function useToday() {
  const [today, setToday] = useState(dayKey);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setToday(dayKey());
      clearTimeout(timer);
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 50);
      timer = setTimeout(refresh, midnight.getTime() - Date.now());
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}
