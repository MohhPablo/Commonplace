import { useSyncExternalStore, type CSSProperties } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { APP_VERSION } from "../lib/version";
import { appUpdater } from "../lib/updates";
import { Icon } from "./Icon";

export function AppUpdate() {
  const state = useSyncExternalStore(
    appUpdater.subscribe,
    appUpdater.getSnapshot,
  );
  return (
    <>
      <h3 className="settings-label">About</h3>
      <section className="settings-group">
        <div className="settings-row">
          <span
            className="icon-tile"
            style={{ "--tile": "var(--tint-gray)" } as CSSProperties}
          >
            <Icon as={ArrowsClockwise} size={18} color="#fff" weight="bold" />
          </span>
          <span className="row-label">
            Version
            <span
              role="status"
              className={`block text-[13px] leading-snug ${state.status === "error" ? "text-rust" : "text-softink"}`}
            >
              {state.message}
            </span>
          </span>
          <span className="settings-value rounded-num">{APP_VERSION}</span>
        </div>
        <div className="settings-block !pt-1">
          <button
            type="button"
            onClick={() => {
              void appUpdater.update();
            }}
            disabled={
              state.status === "checking" || state.status === "applying"
            }
            className="settings-link press w-full !min-h-11"
          >
            {state.status === "checking"
              ? "Checking…"
              : state.status === "applying"
                ? "Installing…"
                : state.status === "available"
                  ? "Install update"
                  : "Check for updates"}
          </button>
        </div>
      </section>
    </>
  );
}
