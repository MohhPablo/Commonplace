import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { db } from "../src/lib/db";
import { discardPendingSaves } from "../src/lib/autosave";
import { stopReminder } from "../src/lib/notifications";

Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({
    matches: true,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }),
});
Object.defineProperty(window, "scrollTo", { value: () => {} });
// jsdom lacks pointer capture, which Sonner's swipe-to-dismiss toasts use.
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;

afterEach(async () => {
  cleanup();
  await discardPendingSaves();
  stopReminder();
  await db.transaction("rw", db.tables, () =>
    Promise.all(db.tables.map((table) => table.clear())),
  );
});
