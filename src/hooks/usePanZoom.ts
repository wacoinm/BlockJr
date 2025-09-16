// src/hooks/usePanZoom.ts
import { useState, useCallback } from 'react';

export type Pan = { x: number; y: number };

export default function usePanZoom(initialPan: Pan = { x: 0, y: 0 }, initialZoom: number = 1) {
  const [pan, setPan] = useState<Pan>(initialPan);
  const [zoom, setZoom] = useState<number>(initialZoom);

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - pan.x) / zoom,
      y: (sy - pan.y) / zoom,
    }),
    [pan, zoom],
  );

  const zoomBy = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const newZoom = Math.max(0.2, Math.min(3, zoom * factor));
      if (cx == null || cy == null) {
        cx = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
        cy = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
      }
      const worldUnderPointer = screenToWorld(cx, cy);
      const newPanX = cx - worldUnderPointer.x * newZoom;
      const newPanY = cy - worldUnderPointer.y * newZoom;
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [zoom, screenToWorld],
  );

  const panBy = useCallback((dx: number, dy: number) => {
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  return {
    pan,
    setPan,
    zoom,
    setZoom,
    screenToWorld,
    zoomBy,
    panBy,
  } as const;
}
