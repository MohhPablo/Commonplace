import { useSyncExternalStore, type CSSProperties } from "react";
import { ArrowsClockwise, Info } from "@phosphor-icons/react";
import { APP_VERSION } from "../lib/version";
import { appUpdater } from "../lib/updates";
import { Icon } from "./Icon";

export function AppUpdate() {
  const state = useSyncExternalStore(
    appUpdater.subscribe,
    appUpdater.getSnapshot,
  );
  const busy = state.status === "checking" || state.status === "applying";
  return (
    <>
      <h3 className="settings-label">About</h3>
      <section className="settings-group">
        <div className="settings-row">
          <span
            className="icon-tile"
            style={{ "--tile": "var(--tint-gray)" } as CSSProperties}
          >
            <Icon as={Info} size={18} color="#fff" weight="fill" />
          </span>
          <span className="row-label">Version</span>
          <span className="settings-value rounded-num">{APP_VERSION}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            void appUpdater.update();
          }}
          disabled={busy}
          className="settings-row"
        >
          <span
            className="icon-tile"
            style={{ "--tile": "var(--tint-blue)" } as CSSProperties}
          >
            <Icon as={ArrowsClockwise} size={18} color="#fff" weight="bold" />
          </span>
          <span className="row-label text-[var(--tint)]">
            {state.status === "checking"
              ? "Checking…"
              : state.status === "applying"
                ? "Installing…"
                : state.status === "available"
                  ? "Install update"
                  : "Check for updates"}
          </span>
        </button>
      </section>
      <p
        role="status"
        className="settings-note"
        style={state.status === "error" ? { color: "var(--color-rust)" } : {}}
      >
        {state.message}
      </p>
    </>
  );
}
