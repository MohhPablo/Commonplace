import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createAutosave } from "./autosave";

export function useAutosave<T>(write: (value: T) => Promise<unknown>) {
  const latest = useRef(write);
  latest.current = write;
  const [writer] = useState(() =>
    createAutosave<T>((value) => latest.current(value)),
  );
  const status = useSyncExternalStore(writer.subscribe, writer.getState);
  useEffect(
    () => () => {
      void writer.flush().catch(() => {});
    },
    [writer],
  );
  return { writer, status };
}
