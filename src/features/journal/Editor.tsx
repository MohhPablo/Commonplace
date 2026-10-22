import { useEffect, useState } from "react";
import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  TextAa,
  TextB,
  TextItalic,
  TextHTwo,
  ListBullets,
  ListNumbers,
  Quotes,
  ArrowUUpLeft,
  ArrowUUpRight,
  Keyboard,
  type Icon,
} from "@phosphor-icons/react";

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

type ToolProps = {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  icon: Icon;
};
function Tool({
  active,
  disabled = false,
  onClick,
  label,
  icon: Glyph,
}: ToolProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={(event) => event.preventDefault()}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`writing-tool ${active ? "is-active" : ""}`}
    >
      <Glyph size={22} weight={active ? "fill" : "regular"} />
    </button>
  );
}

interface EditorProps {
  initialContent: unknown;
  onChange: (content: unknown, wordCount: number) => void;
  heading?: string;
  wordCount?: number;
}

/** A full-height page with selection-preserving tools above the keyboard. */
export function Editor({
  initialContent,
  onChange,
  heading,
  wordCount = 0,
}: EditorProps) {
  const [formatting, setFormatting] = useState(false);
  const [bookFont, setBookFont] = useState(false);
  const editor = useEditor({
    shouldRerenderOnTransaction: false,
    autofocus: initialContent === "" ? "end" : false,
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
        spellcheck: "true",
        autocorrect: "on",
        autocapitalize: "sentences",
        class: "journal-prose",
        "data-placeholder": "What's on your mind?",
      },
      scrollThreshold: { top: 24, bottom: 48, left: 0, right: 0 },
      scrollMargin: { top: 24, bottom: 48, left: 0, right: 0 },
    },
    onUpdate: ({ editor }) =>
      onChange(editor.getJSON(), countWords(editor.getText())),
  });
  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    const revealCaret = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (editor.isFocused && !editor.isDestroyed && !editor.view.composing)
          editor.commands.scrollIntoView();
      });
    };
    revealCaret();
    window.visualViewport?.addEventListener("resize", revealCaret);
    return () => {
      cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", revealCaret);
    };
  }, [editor, formatting]);
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            heading: editor.isActive("heading"),
            bullets: editor.isActive("bulletList"),
            numbers: editor.isActive("orderedList"),
            quote: editor.isActive("blockquote"),
            undo: editor.can().undo(),
            redo: editor.can().redo(),
            empty: editor.isEmpty,
          }
        : null,
  });
  if (!editor || !state)
    return (
      <p role="status" className="p-6 text-sm text-softink">
        Opening your page…
      </p>
    );
  const focus = () =>
    editor.chain().focus(undefined, { scrollIntoView: false });

  return (
    <div className={`writing-editor ${bookFont ? "book-font" : ""}`}>
      <div className="editor-scroll" data-empty={state.empty}>
        {heading && (
          <div className="editor-dateline">
            <h2>{heading}</h2>
            <p>
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </p>
          </div>
        )}
        <EditorContent editor={editor} className="editor-content" />
      </div>
      <div className="editor-dock glass-toolbar">
        {formatting && (
          <div
            role="toolbar"
            aria-label="Text formatting"
            className="formatting-row"
          >
            <Tool
              label="Bold"
              active={state.bold}
              onClick={() => focus().toggleBold().run()}
              icon={TextB}
            />
            <Tool
              label="Italic"
              active={state.italic}
              onClick={() => focus().toggleItalic().run()}
              icon={TextItalic}
            />
            <Tool
              label="Heading"
              active={state.heading}
              onClick={() => focus().toggleHeading({ level: 2 }).run()}
              icon={TextHTwo}
            />
            <Tool
              label="Numbered list"
              active={state.numbers}
              onClick={() => focus().toggleOrderedList().run()}
              icon={ListNumbers}
            />
            <Tool
              label="Quote"
              active={state.quote}
              onClick={() => focus().toggleBlockquote().run()}
              icon={Quotes}
            />
            <button
              type="button"
              className={`writing-tool font-choice ${bookFont ? "is-active" : ""}`}
              aria-label="Book font"
              aria-pressed={bookFont}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => setBookFont((value) => !value)}
            >
              Aa
            </button>
          </div>
        )}
        <div
          role="toolbar"
          aria-label="Writing tools"
          className="writing-tools"
        >
          <Tool
            label="Formatting"
            active={formatting}
            onClick={() => setFormatting((value) => !value)}
            icon={TextAa}
          />
          <Tool
            label="Bullet list"
            active={state.bullets}
            onClick={() => focus().toggleBulletList().run()}
            icon={ListBullets}
          />
          <div className="tool-divider" />
          <Tool
            label="Undo typing"
            disabled={!state.undo}
            onClick={() => focus().undo().run()}
            icon={ArrowUUpLeft}
          />
          <Tool
            label="Redo typing"
            disabled={!state.redo}
            onClick={() => focus().redo().run()}
            icon={ArrowUUpRight}
          />
          <div className="flex-1" />
          <Tool
            label="Hide keyboard"
            onClick={() => editor.commands.blur()}
            icon={Keyboard}
          />
        </div>
      </div>
    </div>
  );
}
