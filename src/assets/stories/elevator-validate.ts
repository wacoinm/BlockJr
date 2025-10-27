// src/assets/stories/elevator-validate.ts
// Flexible elevator validator supporting exact tokens and regex patterns.
// Rules object is a plain JSON-like object you can edit.

export type BlockLike = {
  id: string;
  parentId?: string | null;
  childId?: string | null;
  type?: string;
  [k: string]: any;
};

/**
 * Each chapter key maps to an array of accepted rule-sequences.
 * Each rule-sequence is an array of token matchers.
 *
 * A token matcher can be:
 * - exact string (compared to block.type)
 * - regex string in slash form like "/green[- ]?flag/i"
 *
 * The validator will return true when any one rule-sequence appears
 * as a contiguous subsequence inside any chain (follow childId links).
 */
export const elevatorValidationRules: Record<string, Array<Array<string>>> = {
  // example for chapter-01:
  // sequence examples:
  //  - exact match tokens
  //  - regex tokens (slash-wrapped) allowing flexible matching
  "chapter-01": [
    // exact sequence: green-flag -> up -> delay -> down
    ["green-flag", "up", "down"],
    // allow "green flag" with or without hyphen and shorter sequence
    ["/^green[- ]?flag$/i", "down", "delay"],
    // alternative ordering or simplified sequence
    ["green-flag", "down"],
  ],

  // example for chapter-02 (add your own sequences)
  "chapter-02": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-03": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-04": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-05": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-06": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-07": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-08": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-09": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-10": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-11": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-12": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-13": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-14": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-15": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],
  "chapter-16": [
    // allow either "green-flag -> up -> delay -> up" OR a simple "green-flag -> up"
    ["green-flag", "up", "delay", "up"],
    ["green-flag", "up"],
  ],

  // add more chapters here...
};

/**
 * Helper: parse a matcher string into a function that checks a token.
 * If the string is slash-wrapped like "/pattern/flags" it becomes RegExp.
 * Otherwise it's treated as exact string (case-sensitive).
 */
function makeMatcher(matcher: string): (token: string) => boolean {
  if (!matcher || typeof matcher !== "string") {
    return () => false;
  }

  const regexLiteral = matcher.match(/^\/(.+)\/([gimusy]*)$/);
  if (regexLiteral) {
    try {
      const pattern = regexLiteral[1];
      const flags = regexLiteral[2] ?? "";
      const re = new RegExp(pattern, flags);
      return (token: string) => {
        if (typeof token !== "string") return false;
        return re.test(token);
      };
    } catch (err) {
      // fallback to false if invalid regex
      return () => false;
    }
  }

  // exact string match
  return (token: string) => token === matcher;
}

/**
 * Build all chains from blocks using parentId/childId links.
 * If no parentId === null heads exist, treat every block as possible head.
 */
function buildChains(blocks: BlockLike[]): string[][] {
  const idMap = new Map<string, BlockLike>();
  blocks.forEach((b) => {
    if (b && b.id) idMap.set(b.id, b);
  });

  const heads = blocks.filter((b) => !b.parentId);
  const candidates = heads.length > 0 ? heads : blocks;

  const chains: string[][] = [];

  for (const head of candidates) {
    const chain: string[] = [];
    let cur: BlockLike | undefined = head;
    while (cur) {
      chain.push(String(cur.type ?? ""));
      if (!cur.childId) break;
      cur = idMap.get(String(cur.childId));
    }
    chains.push(chain);
  }

  return chains;
}

/**
 * Test whether `sequenceMatchers` (array of matchers) is a contiguous subsequence of `tokens`.
 * SequenceMatchers are functions produced by makeMatcher.
 */
function sequenceMatches(tokens: string[], sequenceMatchers: ((t: string) => boolean)[]): boolean {
  if (sequenceMatchers.length === 0) return false;
  if (tokens.length < sequenceMatchers.length) return false;

  for (let start = 0; start <= tokens.length - sequenceMatchers.length; start++) {
    let ok = true;
    for (let j = 0; j < sequenceMatchers.length; j++) {
      const token = tokens[start + j];
      if (!sequenceMatchers[j](token)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Main exported function:
 * - blocks: current block list (array of BlockLike)
 * - chapterKey: the chapter id string (e.g. "chapter-01")
 *
 * Returns true if any rule for the chapter is satisfied.
 */
export function validateElevatorChapter(blocks: BlockLike[], chapterKey: string): boolean {
  if (!Array.isArray(blocks)) return false;
  const rules = elevatorValidationRules[chapterKey];
  if (!rules || rules.length === 0) return false;

  const chains = buildChains(blocks); // array of token arrays

  // pre-compile matchers for each rule
  for (const rule of rules) {
    // rule is array of strings (exact token or regex-string)
    const compiled = rule.map((m) => makeMatcher(m));
    // test each chain for presence
    for (const tokens of chains) {
      if (sequenceMatches(tokens, compiled)) return true;
    }
  }

  return false;
}

export default validateElevatorChapter;
