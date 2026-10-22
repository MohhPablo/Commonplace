import { expect, it, vi } from "vitest";
import {
  createAutosave,
  flushPendingSaves,
  hasPendingSaves,
} from "../src/lib/autosave";

it("coalesces edits into the latest durable snapshot", async () => {
  const save = vi.fn(async (_value: string) => {});
  const writer = createAutosave(save);
  writer.schedule("a");
  writer.schedule("ab");
  writer.schedule("abc");
  await flushPendingSaves();
  expect(save.mock.calls).toEqual([["abc"]]);
  expect(writer.getState()).toBe("saved");
  expect(hasPendingSaves()).toBe(false);
});

it("keeps failed edits available for retry", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("Quota exceeded"))
    .mockResolvedValue(undefined);
  const writer = createAutosave<string>(save);
  writer.schedule("Keep this draft");
  await expect(writer.flush()).rejects.toThrow("Quota exceeded");
  expect(writer.getState()).toBe("error");
  expect(hasPendingSaves()).toBe(true);
  await writer.flush();
  expect(save).toHaveBeenLastCalledWith("Keep this draft");
  expect(writer.getState()).toBe("saved");
});

it("serializes edits made while a save is in flight", async () => {
  let finish!: () => void;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const writer = createAutosave<string>(save);
  writer.schedule("older");
  const saving = writer.flush();
  await Promise.resolve();
  writer.schedule("newest");
  finish();
  await saving;
  expect(save.mock.calls).toEqual([["older"], ["newest"]]);
});

it("deletion waits for an in-flight save and discards queued edits", async () => {
  let finish!: () => void;
  let stored = "";
  const writer = createAutosave<string>(async (value) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    stored = value;
  });
  writer.schedule("older");
  const saving = writer.flush();
  await Promise.resolve();
  writer.schedule("queued");
  const discarding = writer.discard();
  finish();
  await Promise.all([saving, discarding]);
  stored = "deleted";
  await writer.flush();
  expect(stored).toBe("deleted");
});
