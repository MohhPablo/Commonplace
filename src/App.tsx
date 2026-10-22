import { lazy, Suspense, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Gear } from "@phosphor-icons/react";
import { TabBar, type TabKey, TABS } from "./components/TabBar";
import { Splash } from "./components/Splash";
import { LockScreen } from "./components/LockScreen";
import { Settings } from "./components/Settings";
import { Onboarding } from "./components/Onboarding";
import { InlineError } from "./components/InlineError";
import { Icon } from "./components/Icon";
import { Journal } from "./features/journal/Journal";
import { isPasswordSet } from "./lib/auth";
import {
  configureReminder,
  onReminderFire,
  stopReminder,
} from "./lib/notifications";
import {
  applyTheme,
  getTheme,
  getOnboarded,
  setOnboarded,
} from "./lib/settings";
import { flushPendingSaves, hasPendingSaves } from "./lib/autosave";
import { WritingMode } from "./lib/WritingMode";
import { ModalAvailability } from "./lib/ModalAvailability";
import { useToday } from "./lib/useToday";

const Tasks = lazy(() =>
  import("./features/tasks/Tasks").then((m) => ({ default: m.Tasks })),
);
const Priorities = lazy(() =>
  import("./features/priorities/Priorities").then((m) => ({
    default: m.Priorities,
  })),
);
const Habits = lazy(() =>
  import("./features/habits/Habits").then((m) => ({ default: m.Habits })),
);
const Review = lazy(() =>
  import("./features/review/Review").then((m) => ({ default: m.Review })),
);

export function App() {
  const [writing, setWriting] = useState(false);
  const [active, setActive] = useState<TabKey>("journal");
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [hasPasscode, setHasPasscode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [error, setError] = useState("");
  const [reminder, setReminder] = useState("");
  const [revision, setRevision] = useState(0);
  const today = useToday();

  useEffect(() => {
    let disposed = false;
    void Promise.all([isPasswordSet(), getTheme(), getOnboarded()])
      .then(([passcode, theme, onboarded]) => {
        if (disposed) return;
        applyTheme(theme);
        setHasPasscode(passcode);
        setLocked(passcode);
        setSessionOpen(!passcode);
        setShowOnboarding(!onboarded);
        setReady(true);
      })
      .catch(() => {
        if (!disposed)
          setError(
            "Could not open your device storage. Please reopen the app to try again. Your data has not been reset.",
          );
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const unsubscribe = onReminderFire((_title, body) => setReminder(body));
    const configure = () => {
      void configureReminder().catch(() =>
        setError(
          "Could not start your reminder. Try changing the time in Settings.",
        ),
      );
    };
    configure();
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        void flushPendingSaves().catch(() =>
          setError(
            "Some changes couldn't be saved. Your draft is still open; please retry.",
          ),
        );
        if (hasPasscode) {
          setLocked(true);
          setSettingsOpen(false);
        }
      } else configure();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingSaves()) return;
      void flushPendingSaves().catch(() => {});
      event.preventDefault();
      event.returnValue = "";
    };
    const pageHide = () => {
      void flushPendingSaves().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", pageHide);
    return () => {
      unsubscribe();
      stopReminder();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", pageHide);
    };
  }, [ready, hasPasscode]);

  async function navigate(next: TabKey | "settings") {
    try {
      await flushPendingSaves();
      setError("");
      if (next === "settings") setSettingsOpen(true);
      else {
        setReminder("");
        setActive(next);
      }
    } catch {
      setError(
        "Your latest changes are still here. Retry saving before leaving this screen.",
      );
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <ModalAvailability.Provider value={!locked}>
        <WritingMode.Provider value={setWriting}>
          <div className="app-frame">
            <Splash />
            {!ready ? (
              <div className="screen-pad">
                <p role="status" className="text-sm text-softink">
                  Opening Commonplace…
                </p>
                <InlineError>{error}</InlineError>
              </div>
            ) : (
              <>
                {/* After a background lock, keep the draft in memory but remove its
            whole surface from layout, focus, and the accessibility tree. */}
                {sessionOpen && (
                  <div
                    hidden={locked}
                    aria-hidden={locked}
                    className={`app-session ${writing ? "is-writing" : ""}`}
                  >
                    <header
                      className="app-header glass-toolbar flex items-center justify-between px-5"
                      style={{
                        paddingTop: "env(safe-area-inset-top)",
                        height: "calc(env(safe-area-inset-top) + 3.5rem)",
                      }}
                    >
                      <h1 className="text-[22px] font-semibold tracking-tight text-ink">
                        {TABS.find((tab) => tab.key === active)?.label}
                      </h1>
                      <button
                        type="button"
                        onClick={() => navigate("settings")}
                        aria-label="Settings"
                        className="tap-target -mr-2 flex items-center justify-center"
                      >
                        <Icon as={Gear} size={23} />
                      </button>
                    </header>
                    <main
                      className="app-scroll"
                      key={`${revision}:${active}`}
                      aria-label={`${active} content`}
                    >
                      {error && (
                        <div className="screen-pad !pb-0">
                          <InlineError>{error}</InlineError>
                        </div>
                      )}
                      {reminder && (
                        <div className="screen-pad">
                          <div
                            role="status"
                            className="flex items-start gap-3 rounded-xl border border-taupe bg-surface p-4 text-sm text-ink"
                          >
                            <button
                              type="button"
                              className="flex-1 text-left"
                              onClick={() => navigate("habits")}
                            >
                              {reminder}
                            </button>
                            <button
                              type="button"
                              onClick={() => setReminder("")}
                              aria-label="Dismiss reminder"
                              className="tap-target"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      )}
                      <Suspense
                        fallback={
                          <p
                            role="status"
                            className="screen-pad text-sm text-softink"
                          >
                            Opening…
                          </p>
                        }
                      >
                        {active === "journal" && <Journal />}
                        {active === "tasks" && <Tasks />}
                        {active === "priorities" && <Priorities />}
                        {active === "habits" && <Habits key={today} />}
                        {active === "review" && <Review key={today} />}
                      </Suspense>
                    </main>
                    <TabBar
                      active={active}
                      onChange={(key) => {
                        void navigate(key);
                      }}
                    />
                  </div>
                )}
                <Settings
                  open={settingsOpen && !locked}
                  onClose={() => setSettingsOpen(false)}
                  onPasswordChanged={() => {
                    void isPasswordSet()
                      .then(setHasPasscode)
                      .catch(() =>
                        setError("Could not refresh the passcode status."),
                      );
                  }}
                  onDataRestored={() => {
                    setRevision((value) => value + 1);
                    setReminder("");
                  }}
                />
                {locked && (
                  <LockScreen
                    onUnlock={() => {
                      setSessionOpen(true);
                      setLocked(false);
                    }}
                  />
                )}
                {showOnboarding && !locked && (
                  <Onboarding
                    onDone={() => {
                      void setOnboarded(true)
                        .then(() => setShowOnboarding(false))
                        .catch(() =>
                          setError(
                            "Could not save your preferences. Please try again.",
                          ),
                        );
                    }}
                  />
                )}
              </>
            )}
          </div>
        </WritingMode.Provider>
      </ModalAvailability.Provider>
    </MotionConfig>
  );
}
