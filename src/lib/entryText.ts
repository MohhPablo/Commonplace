/** Extract visible words instead of searching editor node names and attributes. */
export function entryText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return "";
  const node = content as { text?: unknown; content?: unknown[] };
  if (typeof node.text === "string") return node.text;
  return Array.isArray(node.content)
    ? node.content.map(entryText).join(" ")
    : "";
}

/**
 * Splits an entry into a title (its first sentence) and the rest, always at a
 * word boundary, so list previews never start or stop mid-word.
 */
export function entryPreview(content: unknown): {
  title: string;
  excerpt: string;
} {
  const text = entryText(content).replace(/\s+/g, " ").trim();
  const sentence = /^(.{8,120}?[.!?…])(\s|$)/.exec(text)?.[1];
  let title = sentence ?? text;
  if (title.length > 120) {
    const cut = title.lastIndexOf(" ", 100);
    title = title.slice(0, cut > 40 ? cut : 100);
  }
  return { title, excerpt: text.slice(title.length).trim() };
}
