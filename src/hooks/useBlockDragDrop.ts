import React, { useRef, useCallback } from 'react';
import { useDragDrop } from '../hooks/useDragDrop';
import { Block } from '../types/Block';

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
  HORIZONTAL_SPACING: number;
  getClientXY: (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => { clientX: number; clientY: number };
};

/**
 * Hook that encapsulates block drag & drop logic.
 * Returns handleDragStart, isDragging and draggedBlock which mirror your previous usage.
 */
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

  const handleBlockDragStart = useCallback(
    (block: Block, e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      const { clientX, clientY } = getClientXY(e);
      const pointerWorld = screenToWorld(clientX, clientY);

      const blocks = blocksRef.current;

      // If dragging from palette (template)
      if (block.id.endsWith('-template')) {
        dragOffsetRef.current = { x: BLOCK_WIDTH / 2, y: BLOCK_HEIGHT / 2 };
        const newBlock: Block = {
          ...block,
          id: `${block.type}-${Date.now()}`,
          x: pointerWorld.x - dragOffsetRef.current.x,
          y: pointerWorld.y - dragOffsetRef.current.y,
          parentId: null,
          childId: null,
        };
        setBlocks((prev) => {
          const next = [...prev, newBlock];
          blocksRef.current = next;
          submitCapture(next);
          return next;
        });
        return newBlock;
      }

      // Normal block drag start
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
      let currentX = baseX;

      updates.set(chain[0].id, { x: baseX, y: baseY, parentId: null });

      const horizSpacingWorld = HORIZONTAL_SPACING;
      for (let i = 1; i < chain.length; i++) {
        currentX += horizSpacingWorld;
        updates.set(chain[i].id, { x: currentX, y: baseY });
      }

      setBlocks((prev) => prev.map((b) => (updates.has(b.id) ? { ...b, ...updates.get(b.id)! } : b)));
    },
    [getChain, screenToWorld, HORIZONTAL_SPACING, setBlocks],
  );

  const handleDrop = useCallback(
    (pos: { x: number; y: number }, droppedBlock: Block) => {
      const blocks = blocksRef.current;
      const blockToSnap = blocksMap.get(droppedBlock.id);
      if (!blockToSnap) {
        // still submit a capture of current blocks (the drag may have moved them)
        submitCapture();
        return;
      }

      const draggedChain = getChain(blockToSnap.id);
      if (draggedChain.length === 0) {
        submitCapture();
        return;
      }
      const draggedIds = new Set(draggedChain.map((b) => b.id));

      const horizSpacingWorld = HORIZONTAL_SPACING;
      const blockWidthWorld = BLOCK_WIDTH;
      const blockHeightWorld = BLOCK_HEIGHT;

      // thresholds
      const centerThreshold = blockWidthWorld * 0.75;
      const gapThreshold = blockWidthWorld * 0.75;

      // FIRST: if green-flag special case => attach as parent of a head ONLY
      if (blockToSnap.type === 'green-flag') {
        const potentialHeadTargets = blocks.filter(
          (b) => b.parentId === null && !draggedIds.has(b.id) && b.id !== blockToSnap.id,
        );

        for (const targetBlock of potentialHeadTargets) {
          const snapX = targetBlock.x - horizSpacingWorld;
          const snapY = targetBlock.y;
          if (
            Math.abs(blockToSnap.x - snapX) < gapThreshold &&
            Math.abs(blockToSnap.y - snapY) < blockHeightWorld * 0.75
          ) {
            const updates = new Map<string, Partial<Block>>();
            // green becomes parent (head parentId stays null)
            updates.set(blockToSnap.id, {
              x: snapX,
              y: snapY,
              parentId: null,
              childId: targetBlock.id,
            });
            updates.set(targetBlock.id, { parentId: blockToSnap.id });

            let newX = snapX + horizSpacingWorld;
            const targetChain = getChain(targetBlock.id);
            for (let i = 0; i < targetChain.length; i++) {
              const t = targetChain[i];
              updates.set(t.id, {
                x: newX,
                y: snapY,
                parentId: i === 0 ? blockToSnap.id : targetChain[i - 1].id,
                childId: t.childId ?? null,
              });
              newX += horizSpacingWorld;
            }

            applyUpdatesAndNormalize(updates, true);
            playSnapSound();
            return;
          }
        }

        submitCapture();
        return;
      }

      type Candidate =
        | { kind: 'attachAfter'; target: Block; distance: number }
        | { kind: 'insertBetween'; target: Block; distance: number };

      const candidates: Candidate[] = [];

      for (const target of blocks) {
        if (draggedIds.has(target.id) || target.id === blockToSnap.id) continue;

        // center distance
        const centerDistX = Math.abs(blockToSnap.x - target.x);
        const centerDistY = Math.abs(blockToSnap.y - target.y);
        const centerDist = Math.hypot(centerDistX, centerDistY);

        if (centerDist < centerThreshold) {
          candidates.push({ kind: 'attachAfter', target, distance: centerDist });
        }

        // if target has a child we can consider insertion point (gap right after target)
        if (target.childId) {
          const gapX = target.x + horizSpacingWorld;
          const gapY = target.y;
          const gapDistX = Math.abs(blockToSnap.x - gapX);
          const gapDistY = Math.abs(blockToSnap.y - gapY);
          const gapDist = Math.hypot(gapDistX, gapDistY);
          if (gapDist < gapThreshold) {
            candidates.push({ kind: 'insertBetween', target, distance: gapDist });
          }
        }
      }

      // choose best candidate by smallest distance
      candidates.sort((a, b) => a.distance - b.distance);
      if (candidates.length > 0) {
        const best = candidates[0];
        if (best.kind === 'attachAfter') {
          const target = best.target;
          const firstDragged = draggedChain[0];
          const lastDragged = draggedChain[draggedChain.length - 1];
          const updates = new Map<string, Partial<Block>>();

          const snapX = target.x + horizSpacingWorld;
          const snapY = target.y;

          if (target.childId) {
            const originalChild = blocksMap.get(target.childId!);
            if (!originalChild) {
              updates.set(target.id, { childId: firstDragged.id });
              let nextX = snapX;
              for (let i = 0; i < draggedChain.length; i++) {
                const d = draggedChain[i];
                updates.set(d.id, {
                  x: nextX,
                  y: snapY,
                  parentId: i === 0 ? target.id : draggedChain[i - 1].id,
                  childId:
                    i < draggedChain.length - 1
                      ? draggedChain[i + 1].id
                      : draggedChain[i].childId ?? null,
                });
                nextX += horizSpacingWorld;
              }
            } else {
              const originalChildChain = getChain(originalChild.id);
              updates.set(target.id, { childId: firstDragged.id });
              updates.set(lastDragged.id, { childId: originalChild.id });
              updates.set(originalChild.id, { parentId: lastDragged.id });

              let nextX = snapX;
              for (let i = 0; i < draggedChain.length; i++) {
                const d = draggedChain[i];
                updates.set(d.id, {
                  x: nextX,
                  y: snapY,
                  parentId: i === 0 ? target.id : draggedChain[i - 1].id,
                  childId:
                    i < draggedChain.length - 1
                      ? draggedChain[i + 1].id
                      : draggedChain[i].childId ?? null,
                });
                nextX += horizSpacingWorld;
              }

              const startForOriginalChild = snapX + draggedChain.length * horizSpacingWorld;
              for (let i = 0; i < originalChildChain.length; i++) {
                const oc = originalChildChain[i];
                updates.set(oc.id, {
                  x: startForOriginalChild + i * horizSpacingWorld,
                  y: snapY,
                  parentId: i === 0 ? lastDragged.id : originalChildChain[i - 1].id,
                  childId: oc.childId ?? null,
                });
              }
            }

            applyUpdatesAndNormalize(updates, true);
            playSnapSound();
            return;
          } else {
            updates.set(target.id, { childId: firstDragged.id });

            let nextX = snapX;
            for (let i = 0; i < draggedChain.length; i++) {
              const d = draggedChain[i];
              updates.set(d.id, {
                x: nextX,
                y: snapY,
                parentId: i === 0 ? target.id : draggedChain[i - 1].id,
                childId:
                  i < draggedChain.length - 1
                    ? draggedChain[i + 1].id
                    : draggedChain[i].childId ?? null,
              });
              nextX += horizSpacingWorld;
            }

            applyUpdatesAndNormalize(updates, true);
            playSnapSound();
            return;
          }
        }

        // handle insertBetween explicitly (target + its child)
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

          const updates = new Map<string, Partial<Block>>();
          const firstDragged = draggedChain[0];
          const lastDragged = draggedChain[draggedChain.length - 1];

          updates.set(target.id, { childId: firstDragged.id });
          updates.set(lastDragged.id, { childId: child.id });
          updates.set(child.id, { parentId: lastDragged.id });

          const insertionX = target.x + horizSpacingWorld;
          const insertionY = target.y;
          let nextX = insertionX;
          for (let i = 0; i < draggedChain.length; i++) {
            const d = draggedChain[i];
            updates.set(d.id, {
              x: nextX,
              y: insertionY,
              parentId: i === 0 ? target.id : draggedChain[i - 1].id,
              childId:
                i < draggedChain.length - 1
                  ? draggedChain[i + 1].id
                  : draggedChain[i].childId ?? null,
            });
            nextX += horizSpacingWorld;
          }

          const originalChildChain = getChain(child.id);
          const startForOriginalChild = insertionX + draggedChain.length * horizSpacingWorld;
          for (let i = 0; i < originalChildChain.length; i++) {
            const oc = originalChildChain[i];
            updates.set(oc.id, {
              x: startForOriginalChild + i * horizSpacingWorld,
              y: insertionY,
              parentId: i === 0 ? lastDragged.id : originalChildChain[i - 1].id,
              childId: oc.childId ?? null,
            });
          }

          applyUpdatesAndNormalize(updates, true);
          playSnapSound();
          return;
        }
      }

      const potentialTargets = blocks.filter((b) => !b.childId && !draggedIds.has(b.id));
      for (const targetBlock of potentialTargets) {
        const snapX = targetBlock.x + horizSpacingWorld;
        const snapY = targetBlock.y;

        if (
          Math.abs(blockToSnap.x - snapX) < blockWidthWorld * 0.75 &&
          Math.abs(blockToSnap.y - snapY) < blockHeightWorld * 0.75
        ) {
          const updates = new Map<string, Partial<Block>>();
          const firstDragged = draggedChain[0];

          updates.set(targetBlock.id, { childId: firstDragged.id });

          let newX = snapX;
          for (let i = 0; i < draggedChain.length; i++) {
            const d = draggedChain[i];
            updates.set(d.id, {
              x: newX,
              y: snapY,
              parentId: i === 0 ? targetBlock.id : draggedChain[i - 1].id,
              childId:
                i < draggedChain.length - 1
                  ? draggedChain[i + 1].id
                  : d.childId ?? null,
            });
            newX += horizSpacingWorld;
          }

          applyUpdatesAndNormalize(updates, true);
          playSnapSound();
          return;
        }
      }

      // If nothing matched, leave blocks where they are (no snap).
      // But we still want to capture the final moved positions (dedupe prevents duplicates)
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
    ],
  );

  // wire into the low-level drag-drop hook
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
