import { describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db } from "../src/lib/db";
import { setPassword, verifyPassword } from "../src/lib/auth";
import { flushPendingSaves } from "../src/lib/autosave";
import { dayKey } from "../src/lib/date";
import { Settings } from "../src/components/Settings";
import { BottomSheet } from "../src/components/BottomSheet";
import { Journal } from "../src/features/journal/Journal";
import { Review } from "../src/features/review/Review";
import { Tasks } from "../src/features/tasks/Tasks";
import { Priorities } from "../src/features/priorities/Priorities";
import { Habits } from "../src/features/habits/Habits";
import { useSwipeToDelete } from "../src/lib/useSwipeToDelete";

// Exercise journal persistence and navigation without emulating the rich editor.
vi.mock("../src/features/journal/Editor", () => ({
  Editor: ({
    onChange,
  }: {
    onChange: (content: unknown, words: number) => void;
  }) => (
    <textarea
      aria-label="Journal entry"
      onChange={(event) =>
        onChange(
          {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: event.target.value }],
              },
            ],
          },
          event.target.value.split(/\s+/).length,
        )
      }
    />
  ),
}));

async function enterPin(
  user: ReturnType<typeof userEvent.setup>,
  digits: string,
) {
  for (const digit of digits)
    await user.click(screen.getByRole("button", { name: `Digit ${digit}` }));
}

describe("passcode settings", () => {
  it("sets a matching PIN and changes it through the full flow", async () => {
    const user = userEvent.setup();
    render(<Settings open onClose={() => {}} onPasswordChanged={() => {}} />);
    await user.click(
      await screen.findByRole("button", { name: "Set", exact: true }),
    );
    await enterPin(user, "2468");
    await screen.findByText("Re-enter your new passcode");
    await enterPin(user, "2468");
    await screen.findByText("Passcode saved.");
    expect(await verifyPassword("2468")).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Change", exact: true }),
    );
    await enterPin(user, "2468");
    await screen.findByText("Enter a new passcode");
    await enterPin(user, "8642");
    await screen.findByText("Re-enter your new passcode");
    await enterPin(user, "8642");
    await screen.findByText("Passcode saved.");
    expect(await verifyPassword("2468")).toBe(false);
    expect(await verifyPassword("8642")).toBe(true);
  });
  it("offers a replacement preview before importing data", async () => {
    await db.tasks.add({
      text: "Keep existing data",
      dueDate: null,
      completed: false,
      completedAt: null,
      createdAt: 1,
    });
    const user = userEvent.setup();
    render(<Settings open onClose={() => {}} onPasswordChanged={() => {}} />);
    const data = {
      version: 1,
      exportedAt: 1,
      entries: [],
      tasks: [],
      priorities: [],
      habits: [],
      habitLogs: [],
      moods: [],
      reflections: [],
    };
    const file = new File([JSON.stringify(data)], "backup.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: async () => JSON.stringify(data),
    });
    await user.upload(
      screen.getByLabelText("Choose a Commonplace backup"),
      file,
    );
    await screen.findByText("Replace current data?");
    expect(await db.tasks.count()).toBe(1);
    await user.click(screen.getByRole("button", { name: "Cancel import" }));
    expect(await db.tasks.count()).toBe(1);
  });
});

it("contains keyboard focus, closes on Escape, and restores its trigger", async () => {
  const user = userEvent.setup();
  const close = vi.fn();
  const trigger = document.createElement("button");
  trigger.textContent = "Trigger";
  document.body.append(trigger);
  trigger.focus();
  const view = render(
    <BottomSheet open onClose={close} title="Edit">
      <input autoFocus aria-label="Name" />
      <button type="button">Save</button>
    </BottomSheet>,
  );
  const dialog = screen.getByRole("dialog", { name: "Edit" });
  await user.tab();
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.tab({ shift: true });
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Escape}");
  expect(close).toHaveBeenCalledOnce();
  view.rerender(
    <BottomSheet open={false} onClose={close} title="Edit">
      <input autoFocus aria-label="Name" />
    </BottomSheet>,
  );
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});

it("does not resurrect a journal deleted before its save timer, and Undo restores the latest draft", async () => {
  const user = userEvent.setup();
  render(<Journal />);
  await user.click(screen.getByRole("button", { name: "New entry" }));
  fireEvent.change(await screen.findByLabelText("Journal entry"), {
    target: { value: "My latest words" },
  });
  await user.click(screen.getByRole("button", { name: "Delete entry" }));
  await screen.findByText("Entry deleted");
  await act(async () => {
    await flushPendingSaves();
  });
  expect(await db.entries.count()).toBe(0);
  await user.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(async () => expect(await db.entries.count()).toBe(1));
  expect(JSON.stringify((await db.entries.toArray())[0].content)).toContain(
    "My latest words",
  );
});

it("searches visible journal text immediately without matching editor node names", async () => {
  await db.entries.add({
    createdAt: 1,
    updatedAt: 1,
    wordCount: 1,
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Sokoto" }] },
      ],
    },
  });
  const user = userEvent.setup();
  render(<Journal />);
  await screen.findByText("Sokoto");
  await user.type(
    screen.getByRole("searchbox", { name: "Search entries" }),
    "paragraph",
  );
  expect(screen.getByText("No entries match “paragraph”.")).toBeTruthy();
});

it("saves an intentionally cleared reflection and keeps writing during mood selection", async () => {
  await db.reflections.add({
    date: dayKey(),
    content: "Old words",
    createdAt: 1,
  });
  render(<Review />);
  const field = await screen.findByDisplayValue("Old words");
  fireEvent.change(field, { target: { value: "" } });
  await act(async () => {
    await flushPendingSaves();
  });
  expect(await db.reflections.count()).toBe(0);
  fireEvent.change(field, { target: { value: "My unsaved thought" } });
  fireEvent.click(screen.getByRole("button", { name: "Good", exact: true }));
  await waitFor(async () => expect(await db.moods.count()).toBe(1));
  expect((field as HTMLTextAreaElement).value).toBe("My unsaved thought");
  await act(async () => {
    await flushPendingSaves();
  });
  expect((await db.reflections.toArray())[0].content).toBe(
    "My unsaved thought",
  );
});

it("edits a task without changing its completion or creation date", async () => {
  const id = await db.tasks.add({
    text: "Old task",
    dueDate: null,
    completed: false,
    completedAt: null,
    createdAt: 123,
  });
  const user = userEvent.setup();
  render(<Tasks />);
  await user.click(
    await screen.findByRole("button", { name: "Options for Old task" }),
  );
  await user.clear(screen.getByRole("textbox", { name: "Task" }));
  await user.type(
    screen.getByRole("textbox", { name: "Task" }),
    "Corrected task",
  );
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(async () =>
    expect((await db.tasks.get(id))?.text).toBe("Corrected task"),
  );
  expect(await db.tasks.get(id)).toEqual(
    expect.objectContaining({ createdAt: 123, completed: false }),
  );
});

it("supports editing a priority and reordering it with the keyboard", async () => {
  const first = await db.priorities.add({
    list: "needs",
    text: "First",
    order: 0,
    fulfilled: false,
    fulfilledAt: null,
    createdAt: 1,
  });
  const second = await db.priorities.add({
    list: "needs",
    text: "Second",
    order: 1,
    fulfilled: false,
    fulfilledAt: null,
    createdAt: 2,
  });
  const user = userEvent.setup();
  render(<Priorities />);
  await user.click(
    await screen.findByRole("button", { name: "First", exact: true }),
  );
  await user.clear(screen.getByRole("textbox", { name: "Priority" }));
  await user.type(screen.getByRole("textbox", { name: "Priority" }), "Edited");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByRole("button", { name: "Edited", exact: true });
  fireEvent.keyDown(
    screen.getByRole("button", {
      name: "Reorder Second. Use arrow keys to move.",
    }),
    { key: "ArrowUp" },
  );
  await act(async () => {
    await flushPendingSaves();
  });
  expect((await db.priorities.get(second))?.order).toBe(0);
  expect((await db.priorities.get(first))?.order).toBe(1);
});

it("keeps habit completion separate from calendar expansion and preserves history on archive", async () => {
  const id = await db.habits.add({
    name: "Read",
    createdAt: 1,
    archived: false,
  });
  const user = userEvent.setup();
  render(<Habits />);
  await user.click(
    await screen.findByRole("button", { name: "Mark Read done today" }),
  );
  expect(
    screen
      .getByRole("button", { name: "Read", exact: true })
      .getAttribute("aria-expanded"),
  ).toBe("false");
  await waitFor(async () => expect(await db.habitLogs.count()).toBe(1));
  await user.click(screen.getByRole("button", { name: "Archive habit" }));
  await screen.findByText("Habit archived");
  expect((await db.habits.get(id))?.archived).toBe(true);
  expect(await db.habitLogs.count()).toBe(1);
});

it("a cancelled horizontal swipe never deletes a task", () => {
  const remove = vi.fn();
  function Surface() {
    const swipe = useSwipeToDelete(remove);
    return <div data-testid="surface" {...swipe.handlers} />;
  }
  render(<Surface />);
  const surface = screen.getByTestId("surface");
  const pointer = (type: string, x: number, y: number) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    });
    fireEvent(surface, event);
  };
  pointer("pointerdown", 250, 10);
  pointer("pointermove", 80, 12);
  pointer("pointercancel", 80, 12);
  expect(remove).not.toHaveBeenCalled();
  pointer("pointerdown", 250, 10);
  pointer("pointermove", 80, 12);
  pointer("pointerup", 80, 12);
  expect(remove).toHaveBeenCalledOnce();
});

it("keeps the journal unmounted until authentication resolves, then hides it on background lock", async () => {
  const { App } = await import("../src/App");
  await setPassword("2468");
  await db.meta.put({ key: "setting:onboarded", value: true });
  await db.entries.add({
    createdAt: 1,
    updatedAt: 1,
    wordCount: 2,
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Private writing" }],
        },
      ],
    },
  });
  const user = userEvent.setup();
  render(<App />);
  expect(screen.queryByText("Private writing")).toBeNull();
  await screen.findByText("Enter your passcode to unlock");
  expect(screen.queryByText("Private writing")).toBeNull();
  await enterPin(user, "2468");
  await screen.findByText("Private writing");
  Object.defineProperty(document, "visibilityState", {
    value: "hidden",
    configurable: true,
  });
  fireEvent(document, new Event("visibilitychange"));
  await screen.findByText("Enter your passcode to unlock");
  expect(screen.getByText("Private writing").closest("[hidden]")).toBeTruthy();
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
});

it("releases an open sheet while locked and returns to its draft after unlocking", async () => {
  const { App } = await import("../src/App");
  await setPassword("2468");
  await db.meta.put({ key: "setting:onboarded", value: true });
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  const user = userEvent.setup();
  render(<App />, { container: root });
  await screen.findByText("Enter your passcode to unlock");
  await enterPin(user, "2468");
  await user.click(
    await screen.findByRole("button", { name: "Tasks", exact: true }),
  );
  await user.click(await screen.findByRole("button", { name: "Add a task" }));
  await user.type(
    screen.getByRole("textbox", { name: "Task" }),
    "Unfinished task draft",
  );
  expect(root.inert).toBe(true);
  Object.defineProperty(document, "visibilityState", {
    value: "hidden",
    configurable: true,
  });
  fireEvent(document, new Event("visibilitychange"));
  await screen.findByText("Enter your passcode to unlock");
  expect(root.inert).toBe(false);
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  await enterPin(user, "2468");
  await screen.findByDisplayValue("Unfinished task draft");
});

it("retains and saves the draft when journal deletion fails", async () => {
  const user = userEvent.setup();
  render(<Journal />);
  await user.click(screen.getByRole("button", { name: "New entry" }));
  fireEvent.change(await screen.findByLabelText("Journal entry"), {
    target: { value: "Keep my latest draft" },
  });
  vi.spyOn(db.entries, "delete").mockRejectedValueOnce(
    new Error("Storage unavailable"),
  );
  await user.click(screen.getByRole("button", { name: "Delete entry" }));
  await screen.findByText(
    "Could not delete this entry. Your draft is still here.",
  );
  await act(async () => {
    await flushPendingSaves();
  });
  expect(JSON.stringify((await db.entries.toArray())[0].content)).toContain(
    "Keep my latest draft",
  );
});
