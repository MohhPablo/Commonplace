import { describe, expect, it, vi } from "vitest";
import { createAppUpdater } from "../src/lib/updates";

function worker(overrides: Partial<ServiceWorkerRegistration> = {}) {
  return {
    update: vi.fn().mockResolvedValue(undefined),
    waiting: null,
    installing: null,
    ...overrides,
  } as unknown as ServiceWorkerRegistration;
}

describe("app updates", () => {
  it("saves drafts before activating a downloaded update without needing the network", async () => {
    const order: string[] = [];
    const updater = createAppUpdater(async () => {
      order.push("save");
    });
    updater.connect(
      worker({
        waiting: {} as ServiceWorker,
        update: async () => {
          order.push("check");
        },
      }),
      async () => {
        order.push("install");
      },
    );
    expect(updater.getSnapshot().status).toBe("available");
    await updater.update();
    expect(order).toEqual(["save", "save", "install"]);
  });

  it("never checks or reloads after a failed draft save and allows retry", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Draft could not be saved"))
      .mockResolvedValue(undefined);
    const registration = worker({ waiting: {} as ServiceWorker });
    const install = vi.fn().mockResolvedValue(undefined);
    const updater = createAppUpdater(save);
    updater.connect(registration, install);
    await updater.update();
    expect(registration.update).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
    expect(updater.getSnapshot()).toEqual({
      status: "error",
      message: "Draft could not be saved",
    });
    await updater.update();
    expect(install).toHaveBeenCalledOnce();
  });

  it("reports when there is no newer version and publishes state changes", async () => {
    const updater = createAppUpdater(async () => {});
    const listener = vi.fn();
    const unsubscribe = updater.subscribe(listener);
    updater.connect(worker(), async () => {});
    await updater.update();
    expect(updater.getSnapshot().status).toBe("current");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    updater.available();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("waits for a downloading update and ignores repeated taps", async () => {
    const installing = new EventTarget() as ServiceWorker;
    Object.defineProperty(installing, "state", {
      value: "installing",
      configurable: true,
    });
    const registration = worker({ installing });
    const install = vi.fn().mockResolvedValue(undefined);
    const updater = createAppUpdater(async () => {});
    updater.connect(registration, install);
    const result = updater.update();
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledOnce());
    await updater.update();
    expect(install).not.toHaveBeenCalled();
    Object.defineProperty(registration, "waiting", { value: installing });
    Object.defineProperty(installing, "state", { value: "installed" });
    installing.dispatchEvent(new Event("statechange"));
    await result;
    expect(install).toHaveBeenCalledOnce();
    expect(registration.update).toHaveBeenCalledOnce();
  });

  it("does not reload on a network failure and can retry", async () => {
    const registration = worker({
      update: vi
        .fn()
        .mockRejectedValueOnce(new Error("Offline"))
        .mockResolvedValue(undefined),
    });
    const install = vi.fn();
    const updater = createAppUpdater(async () => {});
    updater.connect(registration, install);
    await updater.update();
    expect(updater.getSnapshot().status).toBe("error");
    expect(install).not.toHaveBeenCalled();
    await updater.update();
    expect(updater.getSnapshot().status).toBe("current");
  });

  it("explains when service workers are not ready", async () => {
    const updater = createAppUpdater(async () => {});
    await updater.update();
    expect(updater.getSnapshot().message).toContain("aren't ready");
  });
});

it("reloads only when the explicitly installed worker takes control, including an external update", async () => {
  const { activateDownloadedUpdate } = await import("../src/lib/updates");
  const old = {} as ServiceWorker;
  const next = {} as ServiceWorker;
  const container = new EventTarget() as ServiceWorkerContainer;
  Object.defineProperty(container, "controller", {
    value: old,
    configurable: true,
  });
  const postMessage = vi.fn();
  const reload = vi.fn();
  const activation = activateDownloadedUpdate(
    worker({ waiting: { postMessage } as unknown as ServiceWorker }),
    container,
    old,
    reload,
  );
  expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  expect(reload).not.toHaveBeenCalled();
  Object.defineProperty(container, "controller", { value: next });
  container.dispatchEvent(new Event("controllerchange"));
  await activation;
  expect(reload).toHaveBeenCalledOnce();
  container.dispatchEvent(new Event("controllerchange"));
  expect(reload).toHaveBeenCalledOnce();
});

it("reloads a stale page if another tab has already activated the update", async () => {
  const { activateDownloadedUpdate } = await import("../src/lib/updates");
  const container = new EventTarget() as ServiceWorkerContainer;
  Object.defineProperty(container, "controller", { value: {} });
  const reload = vi.fn();
  await activateDownloadedUpdate(
    worker(),
    container,
    {} as ServiceWorker,
    reload,
  );
  expect(reload).toHaveBeenCalledOnce();
});
