/**
 * Centralized spacing constants used across workspace + drag/drop logic.
 *
 * Tuning:
 *  - Change GAP_BETWEEN_BLOCKS to adjust the desired gap between block edges.
 *  - DEFAULT_BLOCK_WIDTH should match your typical block width (px) as a fallback.
 *  - SNAP tuning: use a mix of absolute pixel radius and relative factor so
 *    snapping stays consistent even if blocks get larger or smaller.
 */

export const MIN_GAP = 52; // px — minimum spacing to avoid overlap
export const GAP_BETWEEN_BLOCKS = 30; // px — desired gap between block edges
export const DEFAULT_BLOCK_WIDTH = 90; // px — fallback block width when not passed

// Snap tuning:
export const SNAP_DISTANCE_ABSOLUTE = 48; // px — fixed snap radius (works regardless of block size)
export const SNAP_DISTANCE_FACTOR = 0.25; // multiplier relative to block width (0.0..1.0 typical)
export const SNAP_MIN_DISTANCE = 32; // px — minimum snap radius (for very small blocks)

/**
 * computeHorizStep:
 * Returns the effective horizontal step between block origins.
 * If caller passes a step >= blockWidth, it is used directly.
 * Otherwise it computes: blockWidth + max(gap, MIN_GAP).
 */
export function computeHorizStep(blockWidth?: number, stepOrGap?: number | null): number {
  const bw = typeof blockWidth === 'number' && !isNaN(blockWidth) ? blockWidth : DEFAULT_BLOCK_WIDTH;

  if (typeof stepOrGap === 'number') {
    if (stepOrGap >= bw) return stepOrGap;
    return bw + Math.max(stepOrGap, MIN_GAP);
  }
  return bw + Math.max(GAP_BETWEEN_BLOCKS, MIN_GAP);
}

/**
 * computeSnapThreshold:
 * Returns a stable snap threshold in world pixels.
 * Uses a mix of:
 *  - SNAP_DISTANCE_ABSOLUTE (fixed px)
 *  - SNAP_DISTANCE_FACTOR × blockWidth (relative to block size)
 *  - SNAP_MIN_DISTANCE (safety floor)
 */
export function computeSnapThreshold(blockWidth?: number): number {
  const bw = typeof blockWidth === 'number' && !isNaN(blockWidth) ? blockWidth : DEFAULT_BLOCK_WIDTH;
  const relative = bw * SNAP_DISTANCE_FACTOR;
  return Math.max(SNAP_DISTANCE_ABSOLUTE, relative, SNAP_MIN_DISTANCE);
}
