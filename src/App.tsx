import { lazy, Suspense, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Bell, GearSix, X } from "@phosphor-icons/react";
import { TabBar, type TabKey, TABS } from "./components/TabBar";
import { Splash } from "./components/Splash";
import { LockScreen } from "./components/LockScreen";
import { Settings } from "./components/Settings";
import { Onboarding } from "./components/Onboarding";
import { InlineError } from "./components/InlineError";
import { Icon } from "./components/Icon";
import { HeaderSlot } from "./components/FAB";
import { AppToaster, ToasterMounted } from "./components/UndoSnackbar";
import { Journal } from "./features/journal/Journal";
import { isPasswordSet } from "./lib/auth";
import {
  configureReminder,
  onReminderFire,
  stopReminder,
} from "./lib/notifications";
import {
  applyTheme,
  applyWritingSize,
  getWritingSize,
  getTheme,
  getOnboarded,
  setOnboarded,
} from "./lib/settings";
import { flushPendingSaves, hasPendingSaves } from "./lib/autosave";
import { WritingMode } from "./lib/WritingMode";
import { ModalAvailability } from "./lib/ModalAvailability";
import { useToday } from "./lib/useToday";
import { appUpdater } from "./lib/updates";
import { toast } from "sonner";
import { fromDayKey } from "./lib/date";

// Only the first session of a page load plays the opening animation, so an
// unlock or a restore never waits behind it.
const launchedAt = performance.now();

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
  const [scrolled, setScrolled] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [launching] = useState(() => performance.now() - launchedAt < 1500);
  const today = useToday();
  const title = TABS.find((tab) => tab.key === active)?.label;
  // An update that arrives mid-session is offered, never forced on a draft.
  useEffect(
    () =>
      appUpdater.subscribe(() => {
        if (appUpdater.getSnapshot().status !== "available")
          return void toast.dismiss("app-update");
        toast("A new version of Commonplace is ready", {
          id: "app-update",
          duration: Infinity,
          action: {
            label: "Update",
            onClick: () => void appUpdater.update(),
          },
        });
      }),
    [],
  );
  // Sheets render outside the session, so the section tint lives on <html> too.
  useEffect(() => {
    document.documentElement.dataset.section = active;
  }, [active]);

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      isPasswordSet(),
      getTheme(),
      getOnboarded(),
      getWritingSize(),
    ])
      .then(([passcode, theme, onboarded, writingSize]) => {
        if (disposed) return;
        applyTheme(theme);
        applyWritingSize(writingSize);
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
        setScrolled(false);
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
      <ToasterMounted.Provider value>
        <ModalAvailability.Provider value={!locked}>
          <WritingMode.Provider value={setWriting}>
            <div className="app-frame">
              <Splash />
              {!ready ? (
                <div className="screen-pad">
                  <p role="status" className="sr-only">
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
                      data-section={active}
                      data-scrolled={scrolled}
                      className={`app-session ${writing ? "is-writing" : ""} ${launching ? "is-launching" : ""}`}
                    >
                      <div className="app-backdrop mesh" aria-hidden="true" />
                      <header className="app-header">
                        <div className="app-header-blur" aria-hidden="true" />
                        <span className="app-header-title" aria-hidden="true">
                          {title}
                        </span>
                        <div className="header-actions">
                          <div ref={setHeaderSlot} className="contents" />
                          <button
                            type="button"
                            onClick={() => navigate("settings")}
                            aria-label="Settings"
                            className="header-button glass press"
                          >
                            <Icon
                              as={GearSix}
                              size={23}
                              color="var(--color-ink)"
                            />
                          </button>
                        </div>
                      </header>
                      <HeaderSlot.Provider value={headerSlot}>
                        <main
                          className="app-scroll"
                          key={`${revision}:${active}`}
                          aria-label={`${active} content`}
                          onScroll={(event) =>
                            setScrolled(event.currentTarget.scrollTop > 40)
                          }
                        >
                          <div className="large-title">
                            <p className="eyebrow">
                              {fromDayKey(today).toLocaleDateString(undefined, {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                              })}
                            </p>
                            <h1>{title}</h1>
                          </div>
                          {error && (
                            <div className="screen-pad !pb-0">
                              <InlineError>{error}</InlineError>
                            </div>
                          )}
                          {reminder && (
                            <div className="screen-pad !pb-0">
                              <div role="status" className="banner glass">
                                <span
                                  className="icon-tile"
                                  style={
                                    {
                                      "--tile": "var(--tint-red)",
                                    } as React.CSSProperties
                                  }
                                >
                                  <Icon
                                    as={Bell}
                                    size={18}
                                    color="#fff"
                                    weight="fill"
                                  />
                                </span>
                                <button
                                  type="button"
                                  className="min-h-11 flex-1 text-left text-[15px] leading-snug"
                                  onClick={() => navigate("habits")}
                                >
                                  {reminder}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReminder("")}
                                  aria-label="Dismiss reminder"
                                  className="tap-target flex items-center justify-center"
                                >
                                  <Icon as={X} size={18} />
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
                      </HeaderSlot.Provider>
                      <div className="tab-bar-edge" aria-hidden="true" />
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
              {/* Toasts can name private content, so none float over the lock screen. */}
              {!locked && <AppToaster />}
            </div>
          </WritingMode.Provider>
        </ModalAvailability.Provider>
      </ToasterMounted.Provider>
    </MotionConfig>
  );
}
