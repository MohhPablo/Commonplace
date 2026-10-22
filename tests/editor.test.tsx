import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Editor as Tiptap } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Editor } from "../src/features/journal/Editor";
import { validateBackup } from "../src/lib/backup";

it("opens existing journal JSON and exposes every formatting control", () => {
  const content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Existing writing", marks: [{ type: "bold" }] },
        ],
      },
    ],
  };
  render(<Editor initialContent={content} onChange={vi.fn()} />);
  expect(
    screen.getByRole("textbox", { name: "Journal entry" }).textContent,
  ).toBe("Existing writing");
  const toolbar = screen.getByRole("toolbar", { name: "Text formatting" });
  expect(toolbar.querySelectorAll("button").length).toBe(6);
});

it("formats existing entries and produces backup-compatible JSON after the editor upgrade", () => {
  const editor = new Tiptap({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
        heading: { levels: [2, 3] },
      }),
    ],
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello journal" }],
        },
      ],
    },
  });
  editor.commands.setTextSelection({ from: 1, to: 6 });
  editor.commands.toggleBold();
  const content = editor.getJSON();
  expect(content.content?.[0].content?.[0].marks).toEqual([{ type: "bold" }]);
  const backup = {
    version: 1,
    exportedAt: 1,
    entries: [{ id: 1, createdAt: 1, updatedAt: 1, wordCount: 2, content }],
    tasks: [],
    priorities: [],
    habits: [],
    habitLogs: [],
  };
  expect(validateBackup(backup).entries[0].content).toEqual(content);
  editor.destroy();
});
