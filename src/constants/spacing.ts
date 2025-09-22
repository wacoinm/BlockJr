// src/constants/spacing.ts
/**
 * Centralized spacing constants used across workspace + drag/drop logic.
 *
 * - DEFAULT_BLOCK_WIDTH: fallback width used by visual/layout logic when real BLOCK_WIDTH
 *   isn't available in the component.
 * - GAP_BETWEEN_BLOCKS: visual gap (px) between blocks' edges — tweak this to change spacing.
 * - MIN_GAP: safety minimum to avoid overlap.
 *
 * computeHorizStep(blockWidth?, stepOrGap?)
 * - If stepOrGap >= blockWidth -> treat as full origin-step and return it.
 * - If stepOrGap < blockWidth -> treat as a gap and return blockWidth + Math.max(stepOrGap, MIN_GAP).
 * - If stepOrGap undefined -> return blockWidth + Math.max(GAP_BETWEEN_BLOCKS, MIN_GAP).
 */

export const MIN_GAP = 1; // px — safety floor to avoid overlap
export const GAP_BETWEEN_BLOCKS = 4; // px — default desirable gap between block edges (tweak here)
export const DEFAULT_BLOCK_WIDTH = 2; // px — fallback block width used by Workspace when BLOCK_WIDTH not passed

export function computeHorizStep(blockWidth?: number, stepOrGap?: number | null): number {
  const bw = typeof blockWidth === 'number' && !isNaN(blockWidth) ? blockWidth : DEFAULT_BLOCK_WIDTH;

  if (typeof stepOrGap === 'number') {
    // If the caller passed a value that is at least the width, treat as full origin step.
    if (stepOrGap >= bw) return stepOrGap;
    // Otherwise treat as gap
    return bw + Math.max(stepOrGap, MIN_GAP);
  }

  // No stepOrGap provided: return blockWidth + default gap (but respect MIN_GAP)
  return bw + Math.max(GAP_BETWEEN_BLOCKS, MIN_GAP);
}
