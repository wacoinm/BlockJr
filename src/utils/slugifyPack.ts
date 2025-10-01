// src/utils/slugifyPack.ts
/**
 * Convert a project name into a pack id: slug + ".pack"
 * Keeps Unicode letters and numbers (so Persian names are preserved).
 */
export function toPackId(name: string) {
  if (!name) return "untitled.pack";
  const slug = name
    .toLowerCase()
    .trim()
    // replace whitespace sequences with single dash
    .replace(/\s+/g, "-")
    // remove characters that are not letters, numbers, or dash (unicode aware)
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    // collapse multiple dashes
    .replace(/-+/g, "-")
    // trim leading/trailing dashes
    .replace(/^-+|-+$/g, "");
  return `${slug || "untitled"}.pack`;
}
