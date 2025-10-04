// src/hooks/useBlockDragDrop.ts
import React, { useRef, useCallback } from 'react';
import { useDragDrop } from '../hooks/useDragDrop';
import { Block } from '../types/Block';
import { computeHorizStep, computeSnapThreshold } from '../constants/spacing';

type UseBlockDragDropParams = {
  blocksRef: React.MutableRefObject<Block[]>;
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  blocksMap: Map<string, Block>;
  getChain: (startBlockId: string) => Block[];
  screenToWorld: (sx: number, sy: number) => { x: number; y: number };
  applyUpdatesAndNormalize: (updates: Map<string, Partial<Block>>, capture?: boolean) => void;
  submitCapture: (blocks?: Block[]) => void;
  playSnapSound: () => void;
  BLOCK_WIDTH: number;
  BLOCK_HEIGHT: number;
  HORIZONTAL_SPACING: number | undefined | null; // caller can pass a "gap" or a full "step"
  getClientXY: (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => { clientX: number; clientY: number };
};

export function useBlockDragDrop({
  blocksRef,
  setBlocks,
  blocksMap,
  getChain,
  screenToWorld,
  applyUpdatesAndNormalize,
  submitCapture,
  playSnapSound,
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  HORIZONTAL_SPACING,
  getClientXY,
}: UseBlockDragDropParams) {
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Helper: get per-block width if available on block (fallback to workspace BLOCK_WIDTH)
  const getBlockWidth = useCallback(
    (b: Block | { width?: number; size?: number } | undefined) => {
      if (!b) return BLOCK_WIDTH;
      const anyB = b as any;
      if (anyB && typeof anyB.width === 'number' && !isNaN(anyB.width)) return anyB.width;
      if (anyB && typeof anyB.size === 'number' && !isNaN(anyB.size)) return anyB.size;
      return BLOCK_WIDTH;
    },
    [BLOCK_WIDTH],
  );

  // rotate chain so index becomes head (keeps order)
  const rotateChain = useCallback((arr: Block[], startIndex: number) => {
    if (startIndex <= 0) return arr.slice();
    return arr.slice(startIndex).concat(arr.slice(0, startIndex));
  }, []);

  //
  // Safety helpers to avoid creating cycles in parent/child pointers.
  // These check both existing blocks (blocksMap / blocksRef.current) and
  // tentative updates in the provided Map.
  //
  const wouldCreateCycle = useCallback(
    (
      proposedParentId: string | null | undefined,
      childId: string,
      updatesMap: Map<string, Partial<Block>>,
    ) => {
      if (!proposedParentId) return false;
      const blocksCur = blocksRef.current;
      let cur: string | null | undefined = proposedParentId;
      const seen = new Set<string>();
      while (cur) {
        if (cur === childId) return true;
        if (seen.has(cur)) return true; // existing cycle in graph
        seen.add(cur);

        // If an update sets a new parent for `cur`, honor that while simulating
        const upd = updatesMap.get(cur);
        if (upd && Object.prototype.hasOwnProperty.call(upd, 'parentId')) {
          cur = (upd as any).parentId ?? null;
          continue;
        }

        // Otherwise read current parent from blocksMap or blocksRef
        const bm = blocksMap.get(cur) ?? blocksCur.find((b) => b.id === cur);
        cur = bm ? bm.parentId ?? null : null;
      }
      return false;
    },
    [blocksMap, blocksRef],
  );

  const sanitizeUpdates = useCallback(
    (updates: Map<string, Partial<Block>>) => {
      // Make a shallow copy we can mutate
      const safe = new Map<string, Partial<Block>>();
      for (const [k, v] of updates) safe.set(k, { ...v });

      let changed = false;
      // We'll iterate a few times to let interdependent updates settle.
      for (let pass = 0; pass < 5; pass++) {
        let passChanged = false;
        for (const [id, upd] of Array.from(safe.entries())) {
          const copy = { ...upd };

          if (Object.prototype.hasOwnProperty.call(copy, 'parentId')) {
            const proposedParent = (copy as any).parentId ?? null;
            if (wouldCreateCycle(proposedParent, id, safe)) {
              // drop the parentId to prevent cycle
              // eslint-disable-next-line no-console
              console.warn(`sanitizeUpdates: dropping parentId -> ${proposedParent} for ${id} (would create cycle)`);
              delete (copy as any).parentId;
              passChanged = true;
            }
          }

          if (Object.prototype.hasOwnProperty.call(copy, 'childId')) {
            const proposedChild = (copy as any).childId ?? null;
            if (proposedChild && wouldCreateCycle(id, proposedChild, safe)) {
              // drop the childId to prevent cycle
              // eslint-disable-next-line no-console
              console.warn(`sanitizeUpdates: dropping childId -> ${proposedChild} for ${id} (would create cycle)`);
              delete (copy as any).childId;
              passChanged = true;
            }
          }

          // write back (may be identical)
          safe.set(id, copy);
        }
        if (!passChanged) break;
        changed = changed || passChanged;
      }

      return { safe, changed };
    },
    [wouldCreateCycle],
  );

  // Helper to apply updates after sanitizing; returns true if applied, false if nothing applied.
  const applySanitizedUpdates = useCallback(
    (updates: Map<string, Partial<Block>>) => {
      if (!updates || updates.size === 0) {
        submitCapture();
        return false;
      }
      const { safe, changed } = sanitizeUpdates(updates);
      if (changed) {
        // eslint-disable-next-line no-console
        console.warn('applySanitizedUpdates: sanitized incoming updates to avoid cycles.');
      }
      // If sanitization removed all effective keys, bail out.
      if (!safe || safe.size === 0) {
        submitCapture();
        return false;
      }
      applyUpdatesAndNormalize(safe, true);
      return true;
    },
    [applyUpdatesAndNormalize, sanitizeUpdates, submitCapture],
  );

  const handleBlockDragStart = useCallback(
    (block: Block, e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      const { clientX, clientY } = getClientXY(e);
      const pointerWorld = screenToWorld(clientX, clientY);

      const blocks = blocksRef.current;

      // If dragging from palette (template)
      if (block.id.endsWith('-template')) {
        // set drag offset to workspace block dims
        dragOffsetRef.current = { x: BLOCK_WIDTH / 2, y: BLOCK_HEIGHT / 2 };
        // create a new block instance — attach width so snapping works according to workspace width
        const newBlock: Block & { width?: number } = {
          ...block,
          id: `${block.type}-${Date.now()}`,
          x: pointerWorld.x - dragOffsetRef.current.x,
          y: pointerWorld.y - dragOffsetRef.current.y,
          parentId: null,
          childId: null,
          // IMPORTANT: store the logical/visual width on the block so snap uses it
          // consumer should also pass this size into BlockComponent when rendering.
          ...(typeof (block as any).width === 'undefined' ? { width: BLOCK_WIDTH } : {}),
        } as Block & { width?: number };

        setBlocks((prev) => {
          const next = [...prev, newBlock];
          blocksRef.current = next;
          submitCapture(next);
          return next;
        });
        return newBlock;
      }

      // Normal block drag start (drag offset is pointer - block pos)
      dragOffsetRef.current = { x: pointerWorld.x - block.x, y: pointerWorld.y - block.y };

      const draggedChain = getChain(block.id);
      if (draggedChain.length === 0) return block;

      const draggedIds = new Set(draggedChain.map((d) => d.id));
      const otherBlocks = blocks.filter((b) => !draggedIds.has(b.id)).map((b) => ({ ...b }));

      const parentId = block.parentId;
      if (parentId) {
        const pi = otherBlocks.findIndex((b) => b.id === parentId);
        if (pi !== -1) {
          otherBlocks[pi] = { ...otherBlocks[pi], childId: null };
        }
      }

      const normalizedDragged = draggedChain.map((d, idx, arr) => {
        const next = arr[idx + 1];
        const prev = arr[idx - 1];
        return {
          ...d,
          parentId: idx === 0 ? null : prev.id,
          childId: idx < arr.length - 1 ? next.id : d.childId ?? null,
        };
      });

      setBlocks(() => {
        const next = [...otherBlocks, ...normalizedDragged];
        blocksRef.current = next;
        submitCapture(next);
        return next;
      });

      return block;
    },
    [
      setBlocks,
      blocksRef,
      getChain,
      screenToWorld,
      getClientXY,
      submitCapture,
      BLOCK_WIDTH,
      BLOCK_HEIGHT,
    ],
  );

  const handleBlockDrag = useCallback(
    (pos: { x: number; y: number }, draggedBlock: Block) => {
      const chain = getChain(draggedBlock.id);
      if (!chain.length) return;

      const pointerWorld = screenToWorld(pos.x, pos.y);
      const baseX = pointerWorld.x - dragOffsetRef.current.x;
      const baseY = pointerWorld.y - dragOffsetRef.current.y;

      const updates = new Map<string, Partial<Block>>();

      // create sequential positions using per-block widths
      let curX = baseX;
      updates.set(chain[0].id, { x: curX, y: baseY, parentId: null });
      for (let i = 1; i < chain.length; i++) {
        const prev = chain[i - 1];
        const step = computeHorizStep(getBlockWidth(prev), HORIZONTAL_SPACING ?? undefined);
        curX = curX + step;
        updates.set(chain[i].id, { x: curX, y: baseY });
      }

      setBlocks((prev) => prev.map((b) => (updates.has(b.id) ? { ...b, ...updates.get(b.id)! } : b)));
    },
    [getChain, screenToWorld, HORIZONTAL_SPACING, BLOCK_WIDTH, setBlocks, getBlockWidth],
  );

  const handleDrop = useCallback(
    (pos: { x: number; y: number }, droppedBlock: Block) => {
      const blocks = blocksRef.current;
      const blockToSnap = blocksMap.get(droppedBlock.id);
      if (!blockToSnap) {
        submitCapture();
        return;
      }

      const draggedChain = getChain(blockToSnap.id);
      if (draggedChain.length === 0) {
        submitCapture();
        return;
      }
      const draggedIds = new Set(draggedChain.map((b) => b.id));

      // compute intended drop origin (virtual) using pointer + drag offset
      const pointerWorld = screenToWorld(pos.x, pos.y);
      const baseX = pointerWorld.x - dragOffsetRef.current.x;
      const baseY = pointerWorld.y - dragOffsetRef.current.y;

      // Build virtual positions sequentially using per-block widths
      const virtualPositions: { id: string; x: number; y: number; width: number }[] = [];
      let curX = baseX;
      for (let i = 0; i < draggedChain.length; i++) {
        const d = draggedChain[i];
        const w = getBlockWidth(d);
        virtualPositions.push({ id: d.id, x: curX, y: baseY, width: w });
        // step to next origin based on current block width
        const step = computeHorizStep(w, HORIZONTAL_SPACING ?? undefined);
        curX = curX + step;
      }

      // Candidate type includes which dragged index matched
      type Candidate =
        | { kind: 'attachAfter'; target: Block; distance: number; draggedIndex: number; snapX: number; snapY: number }
        | { kind: 'insertBetween'; target: Block; distance: number; draggedIndex: number; snapX: number; snapY: number };

      const candidates: Candidate[] = [];

      // FIRST: green-flag special case => attach as parent of a head ONLY
      if (blockToSnap.type === 'green-flag') {
        const potentialHeadTargets = blocks.filter(
          (b) => b.parentId === null && !draggedIds.has(b.id) && b.id !== blockToSnap.id,
        );

        for (const targetBlock of potentialHeadTargets) {
          // canonical snap point is left of target by target width + gap
          const snapX = targetBlock.x - computeHorizStep(getBlockWidth(targetBlock), HORIZONTAL_SPACING ?? undefined);
          const snapY = targetBlock.y;

          // test every virtual dragged block
          for (let vi = 0; vi < virtualPositions.length; vi++) {
            const vp = virtualPositions[vi];
            const thr = computeSnapThreshold(vp.width);
            const dx = vp.x - snapX;
            const dy = vp.y - snapY;
            const dist = Math.hypot(dx, dy);
            if (dist <= thr && Math.abs(dy) < BLOCK_HEIGHT * 0.75) {
              const rotated = rotateChain(draggedChain, vi);
              const updates = new Map<string, Partial<Block>>();
              // green becomes parent (head parentId stays null)
              updates.set(blockToSnap.id, {
                x: snapX,
                y: snapY,
                parentId: null,
                childId: rotated[0].id,
              });
              updates.set(targetBlock.id, { parentId: blockToSnap.id });

              // place rotated chain sequentially using per-block widths
              let placeX = snapX + computeHorizStep(getBlockWidth(blockToSnap as any), HORIZONTAL_SPACING ?? undefined);
              for (let i = 0; i < rotated.length; i++) {
                const t = rotated[i];
                updates.set(t.id, {
                  x: placeX,
                  y: snapY,
                  parentId: i === 0 ? blockToSnap.id : rotated[i - 1].id,
                  childId: i < rotated.length - 1 ? rotated[i + 1].id : t.childId ?? null,
                });
                placeX += computeHorizStep(getBlockWidth(t), HORIZONTAL_SPACING ?? undefined);
              }

              // sanitize and apply
              if (!applySanitizedUpdates(updates)) return;
              playSnapSound();
              return;
            }
          }
        }

        submitCapture();
        return;
      }

      // General candidate collection:
      for (const target of blocks) {
        if (draggedIds.has(target.id) || target.id === blockToSnap.id) continue;

        // canonical snap position for "after this target" uses target width
        const canonicalSnapX = target.x + computeHorizStep(getBlockWidth(target), HORIZONTAL_SPACING ?? undefined);
        const canonicalSnapY = target.y;

        // test every virtual block
        for (let vi = 0; vi < virtualPositions.length; vi++) {
          const vp = virtualPositions[vi];
          const thr = computeSnapThreshold(vp.width);

          const attachDx = vp.x - canonicalSnapX;
          const attachDy = vp.y - canonicalSnapY;
          const attachDist = Math.hypot(attachDx, attachDy);

          if (Math.abs(attachDy) < BLOCK_HEIGHT * 0.75 && attachDist <= thr) {
            candidates.push({
              kind: 'attachAfter',
              target,
              distance: attachDist,
              draggedIndex: vi,
              snapX: canonicalSnapX,
              snapY: canonicalSnapY,
            });
          }

          // insertion between target + its child (if any) — same canonical gap spot
          if (target.childId) {
            const gapX = canonicalSnapX;
            const gapY = canonicalSnapY;
            const gapDx = vp.x - gapX;
            const gapDy = vp.y - gapY;
            const gapDist = Math.hypot(gapDx, gapDy);
            if (Math.abs(gapDy) < BLOCK_HEIGHT * 0.75 && gapDist <= thr) {
              candidates.push({
                kind: 'insertBetween',
                target,
                distance: gapDist,
                draggedIndex: vi,
                snapX: gapX,
                snapY: gapY,
              });
            }
          }
        }
      }

      // choose best candidate by smallest distance
      candidates.sort((a, b) => a.distance - b.distance);
      if (candidates.length > 0) {
        const best = candidates[0];

        // rotate the draggedChain so matched index becomes head
        const rotatedChain = rotateChain(draggedChain, best.draggedIndex);

        // compute placement start: align the matched virtual pos to best.snapX
        const vpMatched = virtualPositions[best.draggedIndex];
        const shift = best.snapX - vpMatched.x;

        // We'll place rotatedChain[0] at best.snapX (head position) and subsequent using per-block steps
        const placeStartX = best.snapX;
        const placeY = best.snapY;
        const updates = new Map<string, Partial<Block>>();

        if (best.kind === 'attachAfter') {
          const target = best.target;

          if (target.childId) {
            const originalChild = blocksMap.get(target.childId!);
            if (!originalChild) {
              updates.set(target.id, { childId: rotatedChain[0].id });
              let nextX = placeStartX;
              for (let i = 0; i < rotatedChain.length; i++) {
                const d = rotatedChain[i];
                updates.set(d.id, {
                  x: nextX,
                  y: placeY,
                  parentId: i === 0 ? target.id : rotatedChain[i - 1].id,
                  childId: i < rotatedChain.length - 1 ? rotatedChain[i + 1].id : d.childId ?? null,
                });
                nextX += computeHorizStep(getBlockWidth(d), HORIZONTAL_SPACING ?? undefined);
              }
            } else {
              const originalChildChain = getChain(originalChild.id);
              updates.set(target.id, { childId: rotatedChain[0].id });
              updates.set(rotatedChain[rotatedChain.length - 1].id, { childId: originalChild.id });
              updates.set(originalChild.id, { parentId: rotatedChain[rotatedChain.length - 1].id });

              let nextX = placeStartX;
              for (let i = 0; i < rotatedChain.length; i++) {
                const d = rotatedChain[i];
                updates.set(d.id, {
                  x: nextX,
                  y: placeY,
                  parentId: i === 0 ? target.id : rotatedChain[i - 1].id,
                  childId:
                    i < rotatedChain.length - 1 ? rotatedChain[i + 1].id : rotatedChain[i].childId ?? null,
                });
                nextX += computeHorizStep(getBlockWidth(d), HORIZONTAL_SPACING ?? undefined);
              }

              const startForOriginalChild = placeStartX + rotatedChain.reduce((sum, item) => sum + computeHorizStep(getBlockWidth(item), HORIZONTAL_SPACING ?? undefined), 0);
              for (let i = 0; i < originalChildChain.length; i++) {
                const oc = originalChildChain[i];
                updates.set(oc.id, {
                  x: startForOriginalChild + i * computeHorizStep(getBlockWidth(oc), HORIZONTAL_SPACING ?? undefined),
                  y: placeY,
                  parentId: i === 0 ? rotatedChain[rotatedChain.length - 1].id : originalChildChain[i - 1].id,
                  childId: oc.childId ?? null,
                });
              }
            }

            if (!applySanitizedUpdates(updates)) return;
            playSnapSound();
            return;
          } else {
            // target had no child -> simple attach
            updates.set(target.id, { childId: rotatedChain[0].id });

            let nextX = placeStartX;
            for (let i = 0; i < rotatedChain.length; i++) {
              const d = rotatedChain[i];
              updates.set(d.id, {
                x: nextX,
                y: placeY,
                parentId: i === 0 ? target.id : rotatedChain[i - 1].id,
                childId: i < rotatedChain.length - 1 ? rotatedChain[i + 1].id : rotatedChain[i].childId ?? null,
              });
              nextX += computeHorizStep(getBlockWidth(d), HORIZONTAL_SPACING ?? undefined);
            }

            if (!applySanitizedUpdates(updates)) return;
            playSnapSound();
            return;
          }
        }

        // insertBetween
        if (best.kind === 'insertBetween') {
          const target = best.target;
          if (!target.childId) {
            submitCapture();
            return;
          }
          const child = blocksMap.get(target.childId!);
          if (!child) {
            submitCapture();
            return;
          }

          updates.set(target.id, { childId: rotatedChain[0].id });
          updates.set(rotatedChain[rotatedChain.length - 1].id, { childId: child.id });
          updates.set(child.id, { parentId: rotatedChain[rotatedChain.length - 1].id });

          // place rotatedChain starting at placeStartX
          let nextX = placeStartX;
          for (let i = 0; i < rotatedChain.length; i++) {
            const d = rotatedChain[i];
            updates.set(d.id, {
              x: nextX,
              y: placeY,
              parentId: i === 0 ? target.id : rotatedChain[i - 1].id,
              childId:
                i < rotatedChain.length - 1 ? rotatedChain[i + 1].id : rotatedChain[i].childId ?? null,
            });
            nextX += computeHorizStep(getBlockWidth(d), HORIZONTAL_SPACING ?? undefined);
          }

          const originalChildChain = getChain(child.id);
          const startForOriginalChild = placeStartX + rotatedChain.reduce((sum, item) => sum + computeHorizStep(getBlockWidth(item), HORIZONTAL_SPACING ?? undefined), 0);
          for (let i = 0; i < originalChildChain.length; i++) {
            const oc = originalChildChain[i];
            updates.set(oc.id, {
              x: startForOriginalChild + i * computeHorizStep(getBlockWidth(oc), HORIZONTAL_SPACING ?? undefined),
              y: placeY,
              parentId: i === 0 ? rotatedChain[rotatedChain.length - 1].id : originalChildChain[i - 1].id,
              childId: oc.childId ?? null,
            });
          }

          if (!applySanitizedUpdates(updates)) return;
          playSnapSound();
          return;
        }
      }

      // fallback: attach to tails (no child)
      const potentialTargets = blocks.filter((b) => !b.childId && !draggedIds.has(b.id));
      for (const targetBlock of potentialTargets) {
        const snapX = targetBlock.x + computeHorizStep(getBlockWidth(targetBlock), HORIZONTAL_SPACING ?? undefined);
        const snapY = targetBlock.y;

        for (let vi = 0; vi < virtualPositions.length; vi++) {
          const vp = virtualPositions[vi];
          const thr = computeSnapThreshold(vp.width);
          const dx = vp.x - snapX;
          const dy = vp.y - snapY;
          const dist = Math.hypot(dx, dy);
          if (dist <= thr && Math.abs(dy) < BLOCK_HEIGHT * 0.75) {
            const rotated = rotateChain(draggedChain, vi);

            const updates = new Map<string, Partial<Block>>();
            updates.set(targetBlock.id, { childId: rotated[0].id });

            let newX = snapX;
            for (let i = 0; i < rotated.length; i++) {
              const d = rotated[i];
              updates.set(d.id, {
                x: newX,
                y: snapY,
                parentId: i === 0 ? targetBlock.id : rotated[i - 1].id,
                childId: i < rotated.length - 1 ? rotated[i + 1].id : d.childId ?? null,
              });
              newX += computeHorizStep(getBlockWidth(d), HORIZONTAL_SPACING ?? undefined);
            }

            if (!applySanitizedUpdates(updates)) return;
            playSnapSound();
            return;
          }
        }
      }

      // nothing matched
      submitCapture();
    },
    [
      blocksRef,
      blocksMap,
      getChain,
      applyUpdatesAndNormalize,
      submitCapture,
      playSnapSound,
      HORIZONTAL_SPACING,
      BLOCK_WIDTH,
      BLOCK_HEIGHT,
      screenToWorld,
      getBlockWidth,
      rotateChain,
      applySanitizedUpdates,
    ],
  );

  const { handleDragStart, isDragging, draggedBlock } = useDragDrop({
    onDragStart: handleBlockDragStart,
    onDrag: handleBlockDrag,
    onDrop: handleDrop,
    onDragEnd: () => {},
  });

  return {
    handleDragStart,
    isDragging,
    draggedBlock,
  };
}

export default useBlockDragDrop;
