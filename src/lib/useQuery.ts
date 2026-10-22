import { useEffect, useState } from "react";
import { liveQuery } from "dexie";

/** Pass a stable module-level query so the subscription survives renders. */
export function useQuery<T>(query: () => Promise<T>, initial: T) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState(false);
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (result) => {
        setValue(result);
        setError(false);
      },
      error: () => setError(true),
    });
    return () => subscription.unsubscribe();
  }, [query]);
  return { value, error };
}
