// src/utils/validator.ts
import { Block } from '../types/Block';

export type ValidatorState = string[];

export interface ValidatorConfig {
  states: ValidatorState[];
  blockTypes?: string[] | null;
}

/**
 * Extract all block chains based on parentId / childId.
 * Each chain starts from a "head" with parentId === null.
 */
function extractChains(blocks: Block[]): Block[][] {
  const byId = new Map<string, Block>();
  blocks.forEach((b) => byId.set(b.id, b));

  const heads = blocks.filter((b) => b.parentId == null);

  const chains: Block[][] = [];
  for (const head of heads) {
    const chain: Block[] = [];
    let current: Block | undefined = head;
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      chain.push(current);
      current = current.childId ? byId.get(current.childId) : undefined;
    }

    if (chain.length > 0) {
      chains.push(chain);
    }
  }

  return chains;
}

/**
 * If token looks like a regex (e.g. "/^green[- ]?flag$/i")
 * it converts it to a RegExp, otherwise it returns it as a literal string.
 */
function parsePatternToken(token: string): { regex?: RegExp; literal?: string } {
  const trimmed = token.trim();
  if (!trimmed.startsWith('/') || trimmed.length < 2) {
    return { literal: trimmed };
  }

  // Look for the last / to separate body and flags
  const lastSlash = trimmed.lastIndexOf('/');
  if (lastSlash <= 0) {
    return { literal: trimmed };
  }

  const body = trimmed.slice(1, lastSlash);
  const flags = trimmed.slice(lastSlash + 1) || undefined;

  try {
    const regex = new RegExp(body, flags);
    return { regex };
  } catch {
    return { literal: trimmed };
  }
}

/**
 * Checks whether sequence (e.g. ["green-flag","forward","forward"])
 * matches pattern (same array shape, possibly containing regex tokens) or not.
 * This performs full-length matching (not subsequence matching).
 */
function matchesPattern(sequence: string[], pattern: string[]): boolean {
  if (sequence.length !== pattern.length) return false;

  for (let i = 0; i < pattern.length; i += 1) {
    const token = pattern[i];
    const { regex, literal } = parsePatternToken(token);
    const value = sequence[i] ?? '';

    if (regex) {
      if (!regex.test(value)) return false;
    } else if (literal !== value) {
      return false;
    }
  }

  return true;
}

/**
 * Main validation function:
 * - blocks: all current blocks
 * - config or states: collection of allowed sequences
 * If at least one block chain matches at least one rule, it returns true.
 */
export function validateBlocksAgainstRuleSets(
  blocks: Block[],
  configOrStates: ValidatorConfig | string[][],
): boolean {
  if (!blocks || blocks.length === 0) return false;

  let states: string[][];
  let blockTypes: string[] | null | undefined;

  if (Array.isArray((configOrStates as ValidatorConfig).states)) {
    const cfg = configOrStates as ValidatorConfig;
    states = cfg.states || [];
    blockTypes = cfg.blockTypes ?? null;
  } else {
    states = configOrStates as string[][];
    blockTypes = null;
  }

  if (!states || states.length === 0) return false;

  const chains = extractChains(blocks);

  for (const chain of chains) {
    // Keep only the block types
    let types = chain.map((b) => b.type);

    // If blockTypes is provided, keep only allowed block types
    if (Array.isArray(blockTypes) && blockTypes.length > 0) {
      const allowed = new Set(blockTypes);
      types = types.filter((t) => allowed.has(t));
    }

    for (const pattern of states) {
      if (matchesPattern(types, pattern)) {
        return true;
      }
    }
  }

  return false;
}
