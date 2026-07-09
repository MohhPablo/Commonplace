import { useEffect, useState } from "react";
import { TabBar, type TabKey, TABS } from "./components/TabBar";
import { Splash } from "./components/Splash";
import { LockScreen } from "./components/LockScreen";
import { Settings } from "./components/Settings";
import { Onboarding } from "./components/Onboarding";
import { Journal } from "./features/journal/Journal";
import { Tasks } from "./features/tasks/Tasks";
import { Priorities } from "./features/priorities/Priorities";
import { Habits } from "./features/habits/Habits";
import { Review } from "./features/review/Review";
import { isPasswordSet } from "./lib/auth";
import { configureReminder, stopReminder } from "./lib/notifications";
import { getTheme } from "./lib/settings";
import { getOnboarded, setOnboarded } from "./lib/settings";

export function App() {
  const [active, setActive] = useState<TabKey>("journal");
  const [base, setBase] = useState<TabKey>("journal");
  const [locked, setLocked] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    void isPasswordSet().then(setLocked);
  }, []);

  // Show the first-run tour once, before the app is unlocked.
  useEffect(() => {
    void getOnboarded().then((done) => {
      if (!done) setShowOnboarding(true);
    });
  }, []);

  // Apply the saved theme to <html> on mount.
  useEffect(() => {
    void getTheme().then((t) => {
      document.documentElement.dataset.theme = t;
    });
  }, []);

  // Arm the saved daily reminder once the app mounts; clear on unmount.
  useEffect(() => {
    void configureReminder();
    const onVisible = () => {
      if (document.visibilityState === "visible") void configureReminder();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      stopReminder();
    };
  }, []);

  // Remember the last real screen so opening Settings (a tab) leaves the
  // previous view mounted behind the sheet and returns to it on close.
  useEffect(() => {
    if (active !== "settings") setBase(active);
  }, [active]);

  const headerTitle =
    active === "settings"
      ? "Settings"
      : TABS.find((t) => t.key === active)?.label ?? "Commonplace";

  return (
    <div className="paper-grain relative mx-auto flex min-h-dvh max-w-md flex-col">
      <AppBar title={headerTitle} />
      <main className="flex-1 pb-24" style={{ position: "relative", zIndex: 2 }}>
        {base === "journal" && <Journal />}
        {base === "tasks" && <Tasks />}
        {base === "priorities" && <Priorities />}
        {base === "habits" && <Habits />}
        {base === "review" && <Review />}
      </main>
      <TabBar active={active} onChange={setActive} />
      <Splash />
      <Settings
        open={active === "settings"}
        onClose={() => setActive(base)}
        onPasswordChanged={() => {
          void isPasswordSet().then(setLocked);
        }}
      />
      {locked && (
        <LockScreen
          onUnlock={() => {
            setLocked(false);
            setActive("journal");
          }}
        />
      )}
      {showOnboarding && (
        <Onboarding
          onDone={() => {
            setShowOnboarding(false);
            void setOnboarded(true);
          }}
        />
      )}
    </div>
  );
}

/**
 * Fixed top app-bar (native-feel, §6). Stays stationary while content scrolls
 * and holds only the active screen title. The settings gear now lives as its
 * own tab in the bottom nav, so it never overlaps screen content or the
 * header divider.
 */
function AppBar({ title }: { title: string }) {
  return (
    <header
      className="app-header fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-taupe bg-surface/95 px-5 backdrop-blur-sm"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        height: "calc(env(safe-area-inset-top) + 3.5rem)",
      }}
    >
      <h1 className="font-serif text-xl font-semibold text-ink">{title}</h1>
    </header>
  );
}
