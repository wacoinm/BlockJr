// src/hooks/useCaptureHistory.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { Block } from '../types/Block';

/**
 * useCaptureHistory
 * - Manages an in-memory undo/redo stack of Block[] snapshots
 * - Exposes submitCapture(snapshot?), goPrev, goNext, hasPrev, hasNext
 *
 * @param blocksRef - Mutable ref to current blocks (used as default snapshot source)
 * @param setBlocks - App's setBlocks (used to restore previous snapshots)
 */
export function useCaptureHistory(
  blocksRef: React.MutableRefObject<Block[]>,
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
) {
  const [captures, setCaptures] = useState<Block[][]>([]);
  const capturesRef = useRef<Block[][]>(captures);
  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  const [captureIndex, setCaptureIndex] = useState<number>(-1);
  const captureIndexRef = useRef<number>(-1);
  useEffect(() => {
    captureIndexRef.current = captureIndex;
  }, [captureIndex]);

  const cloneSnapshot = useCallback((arr: Block[]) => arr.map((b) => ({ ...b })), []);
  const snapshotKey = useCallback((arr: Block[]) => JSON.stringify(arr), []);

  const submitCapture = useCallback(
    (snapshot?: Block[]) => {
      const snap = snapshot ? cloneSnapshot(snapshot) : cloneSnapshot(blocksRef.current);
      setCaptures((prev) => {
        const last = prev[prev.length - 1];
        if (last && snapshotKey(last) === snapshotKey(snap)) {
          return prev;
        }

        // truncate any redo history beyond current index
        const base = prev.slice(0, captureIndexRef.current + 1);
        const next = [...base, snap];
        const newIndex = next.length - 1;
        captureIndexRef.current = newIndex;
        setCaptureIndex(newIndex);
        return next;
      });
    },
    [blocksRef, cloneSnapshot, snapshotKey],
  );

  const goPrev = useCallback(() => {
    const curIndex = captureIndexRef.current;
    if (curIndex <= 0) return;
    const newIndex = curIndex - 1;
    const snap = capturesRef.current[newIndex];
    if (!snap) return;
    const cloned = cloneSnapshot(snap);
    captureIndexRef.current = newIndex;
    setCaptureIndex(newIndex);
    setBlocks(cloned);
    blocksRef.current = cloned;
  }, [blocksRef, cloneSnapshot, setBlocks]);

  const goNext = useCallback(() => {
    const curIndex = captureIndexRef.current;
    if (curIndex >= capturesRef.current.length - 1) return;
    const newIndex = curIndex + 1;
    const snap = capturesRef.current[newIndex];
    if (!snap) return;
    const cloned = cloneSnapshot(snap);
    captureIndexRef.current = newIndex;
    setCaptureIndex(newIndex);
    setBlocks(cloned);
    blocksRef.current = cloned;
  }, [blocksRef, cloneSnapshot, setBlocks]);

  // header props for prev/next
  const hasPrev = captureIndex > 0;
  const hasNext = captureIndex < captures.length - 1;

  // return API
  return {
    submitCapture,
    goPrev,
    goNext,
    hasPrev,
    hasNext,
    // expose internals if needed for debugging
    _internal: {
      capturesRef,
      captureIndexRef,
    },
  };
}
