import { flushPendingSaves } from "./autosave";

export type UpdateState = {
  status: "idle" | "checking" | "available" | "applying" | "current" | "error";
  message: string;
};

/** Keep the update action independent of the worker's registration timing. */
export function createAppUpdater(save = flushPendingSaves) {
  let registration: ServiceWorkerRegistration | undefined;
  let activate: (() => Promise<void>) | undefined;
  let pending = false;
  let snapshot: UpdateState = {
    status: "idle",
    message: "Your writing is saved before an update is installed.",
  };
  const listeners = new Set<() => void>();
  const set = (state: UpdateState) => {
    snapshot = state;
    listeners.forEach((listener) => listener());
  };
  const available = () => {
    if (snapshot.status !== "applying")
      set({
        status: "available",
        message: "A new version is ready to install.",
      });
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    connect(worker: ServiceWorkerRegistration, install: () => Promise<void>) {
      registration = worker;
      activate = install;
      if (worker.waiting) available();
    },
    available,
    registrationFailed() {
      set({
        status: "error",
        message:
          "Updates could not connect. Check your connection and reopen the app to try again.",
      });
    },
    async update(): Promise<void> {
      if (pending) return;
      pending = true;
      set({ status: "checking", message: "Checking for updates…" });
      try {
        // A failed draft save must never be followed by a reload.
        await save();
        if (!registration || !activate)
          throw new Error(
            "Updates aren't ready yet. Please try again in a moment.",
          );
        // A downloaded update can be installed even when the device is offline.
        if (!registration.waiting) await registration.update();
        const installing = registration.installing;
        if (
          installing &&
          installing.state !== "installed" &&
          installing.state !== "activated"
        ) {
          await new Promise<void>((resolve, reject) => {
            const cleanup = () => {
              clearTimeout(timer);
              installing.removeEventListener("statechange", changed);
            };
            const changed = () => {
              if (
                installing.state === "installed" ||
                installing.state === "activated"
              ) {
                cleanup();
                resolve();
              } else if (installing.state === "redundant") {
                cleanup();
                reject(
                  new Error(
                    "The update could not be downloaded. Please try again.",
                  ),
                );
              }
            };
            const timer = setTimeout(() => {
              cleanup();
              reject(
                new Error(
                  "The update is taking longer than expected. Please try again.",
                ),
              );
            }, 20_000);
            installing.addEventListener("statechange", changed);
            changed();
          });
        }
        if (registration.waiting || snapshot.status === "available") {
          await save();
          set({
            status: "applying",
            message: "Installing update… Your writing has been saved.",
          });
          await activate();
        } else set({ status: "current", message: "You're up to date." });
      } catch (error) {
        set({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Couldn't update. Check your connection and try again.",
        });
      } finally {
        pending = false;
      }
    },
  };
}

export const appUpdater = createAppUpdater();

/** Wait for the new controller, then reload only after an explicit, saved update. */
export async function activateDownloadedUpdate(
  registration: ServiceWorkerRegistration,
  container: ServiceWorkerContainer,
  loadedController: ServiceWorker | null,
  reload: () => void,
): Promise<void> {
  const waiting = registration.waiting;
  if (!waiting) {
    // Another tab may already have activated it while this page still runs old JS.
    if (container.controller && container.controller !== loadedController) {
      reload();
      return;
    }
    throw new Error(
      "The update is not ready to install. Check again in a moment.",
    );
  }
  const before = container.controller;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      container.removeEventListener("controllerchange", changed);
    };
    const changed = () => {
      if (!container.controller || container.controller === before) return;
      cleanup();
      reload();
      resolve();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "The update could not finish. Reopen the app, then check again.",
        ),
      );
    }, 15000);
    container.addEventListener("controllerchange", changed);
    try {
      waiting.postMessage({ type: "SKIP_WAITING" });
      changed();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

/** Native registration avoids Workbox Window's external-update reload heuristic. */
export async function registerAppUpdates(container: ServiceWorkerContainer) {
  const loadedController = container.controller;
  try {
    const registration = await container.register("/sw.js", {
      updateViaCache: "none",
    });
    appUpdater.connect(registration, () =>
      activateDownloadedUpdate(registration, container, loadedController, () =>
        window.location.reload(),
      ),
    );
    const watchInstalling = () => {
      const worker = registration.installing;
      if (!worker) return;
      const changed = () => {
        if (worker.state === "installed" && registration.waiting)
          appUpdater.available();
        if (["installed", "activated", "redundant"].includes(worker.state))
          worker.removeEventListener("statechange", changed);
      };
      worker.addEventListener("statechange", changed);
      changed();
    };
    registration.addEventListener("updatefound", watchInstalling);
    watchInstalling();
  } catch {
    appUpdater.registrationFailed();
  }
}
