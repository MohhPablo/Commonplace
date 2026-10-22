import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  TextB,
  TextItalic,
  TextHTwo,
  ListBullets,
  ListNumbers,
  Quotes,
  type Icon,
} from "@phosphor-icons/react";

/** Count words in editor plain text (spec §5.1 — subtle, not a prominent stat). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

interface ToolbarButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: Icon;
}

function ToolbarButton({
  active,
  onClick,
  label,
  icon: Glyph,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-lg"
      style={{ background: active ? "var(--color-terracotta)" : "transparent" }}
    >
      <Glyph
        size={20}
        color={active ? "var(--color-onaccent)" : "var(--color-ink)"}
        weight="bold"
      />
    </button>
  );
}

interface EditorProps {
  initialContent: unknown;
  onChange: (content: unknown, wordCount: number) => void;
}

/**
 * A quiet, always-available formatting toolbar works with keyboard and touch.
 * Body line-height is generous (1.6+, §3) and uses the serif/sans pairing.
 */
export function Editor({ initialContent, onChange }: EditorProps) {
  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
        underline: false,
      }),
    ],
    content: (initialContent as object) ?? "",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Journal entry",
        "aria-multiline": "true",
        class: "journal-prose focus:outline-none min-h-[50svh]",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON(), countWords(editor.getText()));
    },
  });

  if (!editor) return <div className="min-h-[50svh]" />;

  return (
    <div className="relative">
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="mb-5 flex flex-wrap gap-1 rounded-xl border border-taupe bg-surface p-1"
      >
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          icon={TextB}
        />
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          icon={TextItalic}
        />
        <ToolbarButton
          label="Heading"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          icon={TextHTwo}
        />
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          icon={ListBullets}
        />
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          icon={ListNumbers}
        />
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          icon={Quotes}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
