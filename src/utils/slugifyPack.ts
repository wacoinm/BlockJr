// src/utils/slugifyPack.ts
/**
 * Convert a project name (and optional category) into a pack id: slug + "(category)".pack
 * Keeps Unicode letters and numbers (so Persian names are preserved).
 * Example:
 *   name = "آسانسور تست", category = "تله کابین"
 *   => "آسانسور-تست(تله-کابین).pack"
 */
export function toPackId(name: string, category?: string) {
  const clean = (s?: string) => {
    if (!s) return "";
    const slug = s
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
    return slug;
  };

  const n = clean(name) || "untitled";
  if (!category) return `${n}.pack`;

  const c = clean(category) || "uncat";
  return `${n}(${c}).pack`;
}
