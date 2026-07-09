import { useEffect, useState } from "react";
import { TabBar, type TabKey } from "./components/TabBar";
import { Splash } from "./components/Splash";
import { LockScreen } from "./components/LockScreen";
import { Settings } from "./components/Settings";
import { Onboarding } from "./components/Onboarding";
import { Journal } from "./features/journal/Journal";
import { Tasks } from "./features/tasks/Tasks";
import { Priorities } from "./features/priorities/Priorities";
import { Habits } from "./features/habits/Habits";
import { Review } from "./features/review/Review";
import { db } from "./lib/db";
import { isDoneOn } from "./lib/habits";
import { dayKey } from "./lib/date";
import { Icon } from "./components/Icon";
import { Repeat, Gear } from "@phosphor-icons/react";
import { isPasswordSet } from "./lib/auth";
import { configureReminder, stopReminder } from "./lib/notifications";
import { getTheme } from "./lib/settings";
import { getOnboarded, setOnboarded } from "./lib/settings";

export function App() {
  const [active, setActive] = useState<TabKey>("journal");
  const [locked, setLocked] = useState<boolean | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  return (
    <div className="paper-grain relative mx-auto flex min-h-dvh max-w-md flex-col">
      <TodayBanner />
      <main className="flex-1 pb-24" style={{ position: "relative", zIndex: 2 }}>
        {active === "journal" && <Journal />}
        {active === "tasks" && <Tasks />}
        {active === "priorities" && <Priorities />}
        {active === "habits" && <Habits />}
        {active === "review" && <Review />}
      </main>
      <TabBar active={active} onChange={setActive} />
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        aria-label="Settings"
        className="interactive fixed right-4 top-0 z-20 flex h-10 w-10 items-center justify-center rounded-full"
        style={{ top: "env(safe-area-inset-top)" }}
      >
        <Icon as={Gear} size={22} color="#6B6058" weight="light" />
      </button>
      <Splash />
      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onPasswordChanged={() => {
          setSettingsOpen(false);
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
 * In-app "today" reminder banner (technical ref §4.1): shown on app open for
 * habits still undone. This is the reliable, offline-only nudge — there is no
 * background scheduling in this backend-free app.
 */
function TodayBanner() {
  const [undone, setUndone] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [habits, logs] = await Promise.all([
        db.habits.toArray(),
        db.habitLogs.toArray(),
      ]);
      const active = habits.filter((h) => !h.archived);
      const today = dayKey();
      const left = active.filter((h) => !isDoneOn(logs, h.id!, today)).map((h) => h.name);
      if (alive) setUndone(left);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!undone || undone.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-30 flex items-center gap-2 border-b border-taupe bg-surface/95 px-5 py-2.5 backdrop-blur-sm"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Icon as={Repeat} size={18} color="#C1502D" weight="duotone" />
      <span className="font-sans text-sm text-ink">
        {undone.length} {undone.length === 1 ? "habit" : "habits"} left today:{" "}
        <span className="text-terracotta">{undone.join(", ")}</span>
      </span>
    </div>
  );
}
