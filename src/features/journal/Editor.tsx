import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
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

function ToolbarButton({ active, onClick, label, icon: Glyph }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg"
      style={{ background: active ? "#C1502D" : "transparent" }}
    >
      <Glyph size={20} color="#FDFBF7" weight="bold" />
    </button>
  );
}

interface EditorProps {
  initialContent: unknown;
  onChange: (content: unknown, wordCount: number) => void;
}

/**
 * Distraction-free Tiptap editor (spec §5.1). A floating BubbleMenu appears
 * only when text is selected, offering bold/italic/heading/list/blockquote.
 * Body line-height is generous (1.6+, §3) and uses the serif/sans pairing.
 */
export function Editor({ initialContent, onChange }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
    ],
    content: (initialContent as object) ?? "",
    editorProps: {
      attributes: {
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
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 120 }}
        className="flex gap-1 rounded-xl border border-taupe bg-ink p-1 shadow-lift"
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
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
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
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
