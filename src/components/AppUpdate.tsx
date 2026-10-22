import { useSyncExternalStore } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";
import { APP_VERSION } from "../lib/version";
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
        disabled={state.status === "checking" || state.status === "applying"}
        className="settings-link mt-2"
      >
        {state.status === "checking"
          ? "Checking…"
          : state.status === "applying"
            ? "Installing…"
            : state.status === "available"
              ? "Install update"
              : "Check for updates"}
      </button>
      <p className="mt-2 text-xs text-softink">
        Commonplace {APP_VERSION}
      </p>
    </section>
  );
}
