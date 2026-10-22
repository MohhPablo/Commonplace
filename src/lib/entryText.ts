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
