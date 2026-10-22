export type SaveState = "saved" | "saving" | "error";

const drafts = new Set<ReturnType<typeof createAutosave>>();

/** A single writer per draft: navigation can await it; deletion can cancel it. */
export function createAutosave<T>(
  write: (value: T) => Promise<unknown>,
  delay = 500,
) {
  let pending: { value: T } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let state: SaveState = "saved";
  const listeners = new Set<() => void>();
  const publish = (next: SaveState) => {
    state = next;
    listeners.forEach((notify) => notify());
  };

  const api = {
    subscribe(notify: () => void) {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    getState: () => state,
    schedule(value: T) {
      pending = { value };
      drafts.add(api);
      publish("saving");
      clearTimeout(timer);
      timer = setTimeout(() => {
        void api.flush().catch(() => {});
      }, delay);
    },
    async flush(): Promise<void> {
      clearTimeout(timer);
      if (running) {
        await running;
        if (pending) await api.flush();
        return;
      }
      if (!pending) return;
      const item = pending;
      pending = undefined;
      publish("saving");
      running = Promise.resolve()
        .then(() => write(item.value))
        .then(() => {})
        .catch((error: unknown) => {
          // A newer edit always wins over the failed older snapshot.
          pending ??= item;
          publish("error");
          throw error;
        });
      try {
        await running;
      } finally {
        running = undefined;
      }
      if (pending) return api.flush();
      drafts.delete(api);
      publish("saved");
    },
    async discard(): Promise<void> {
      clearTimeout(timer);
      pending = undefined;
      try {
        await running;
      } catch {
        /* deletion intentionally discards this draft */
      }
      pending = undefined;
      drafts.delete(api);
      publish("saved");
    },
  };
  return api;
}

export async function flushPendingSaves(): Promise<void> {
  await Promise.all([...drafts].map((draft) => draft.flush()));
}

export function hasPendingSaves(): boolean {
  return drafts.size > 0;
}

export async function discardPendingSaves(): Promise<void> {
  await Promise.all([...drafts].map((draft) => draft.discard()));
}
