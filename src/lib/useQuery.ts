import { useEffect, useState } from "react";
import { liveQuery } from "dexie";

/** Pass a stable module-level query so the subscription survives renders. */
export function useQuery<T>(query: () => Promise<T>, initial: T) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (result) => {
        setValue(result);
        setError(false);
        setLoading(false);
      },
      error: () => {
        setError(true);
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
  }, [query]);
  return { value, error, loading };
}
