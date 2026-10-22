import { readFileSync } from "node:fs";

// A vendor chunk can silently pull the rich editor back into the entry graph.
const manifest = JSON.parse(readFileSync("dist/.vite/manifest.json", "utf8"));
const visited = new Set();
function check(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const chunk = manifest[key];
  if (!chunk) throw new Error(`Missing build chunk: ${key}`);
  if (/tiptap|Editor-/.test(chunk.file))
    throw new Error("Rich editor is eagerly loaded at startup.");
  for (const dependency of chunk.imports ?? []) check(dependency);
}
for (const [key, chunk] of Object.entries(manifest))
  if (chunk.isEntry) check(key);
console.log("Startup bundle verified: rich editor loads on demand.");
