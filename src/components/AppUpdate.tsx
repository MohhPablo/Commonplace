import { useSyncExternalStore } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";
import { appUpdater } from "../lib/updates";
import { Icon } from "./Icon";

export function AppUpdate() {
  const state = useSyncExternalStore(
    appUpdater.subscribe,
    appUpdater.getSnapshot,
  );
  return (
    <section className="settings-group">
      <div className="flex items-center gap-2">
        <Icon as={ArrowClockwise} size={19} />
        <h3 className="text-base font-semibold text-ink">App updates</h3>
      </div>
      <p
        role="status"
        className={`mt-2 text-sm leading-relaxed ${state.status === "error" ? "text-rust" : "text-softink"}`}
      >
        {state.message}
      </p>
      <button
        type="button"
        onClick={() => {
          void appUpdater.update();
        }}
        disabled={state.status === "checking"}
        className="native-primary mt-4 w-full"
      >
        {state.status === "checking"
          ? "Checking…"
          : state.status === "available"
            ? "Install update"
            : "Update app"}
      </button>
    </section>
  );
}
