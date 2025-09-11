// src/components/Workspace.tsx
import React, { useRef, useState, useMemo } from 'react';
import { Block } from '../types/Block';
import { BlockComponent } from './BlockComponent';

interface WorkspaceProps {
  blocks: Block[];
  isDragging: boolean;
  draggedBlockId: string | undefined;
  onGreenFlagClick: (blockId: string) => void;
  onDelayChange: (blockId: string, value: number) => void;
  onBlockRemove: (blockId: string) => void;
  onBlockDragStart: (block: Block, e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => void;
  onPan?: (dx: number, dy: number) => void;
  panX?: number;
  panY?: number;
  zoom?: number;
  onZoom?: (factor: number, centerX?: number, centerY?: number) => void;
  bottomInsetPx?: number;
  gridCellSize?: number;

  pinchSensitivity?: number; // 0..1
  pinchMaxStep?: number;     // max per-step multiplier

  // NEW: interaction mode. 'runner' means normal (default). 'deleter' means clicking a component removes it.
  interactionMode?: 'runner' | 'deleter';
}

export const Workspace: React.FC<WorkspaceProps> = ({
  blocks,
  isDragging,
  draggedBlockId,
  onGreenFlagClick,
  onDelayChange,
  onBlockRemove,
  onBlockDragStart,
  onPan,
  panX = 0,
  panY = 0,
  zoom = 1,
  onZoom,
  bottomInsetPx = 120,
  gridCellSize = 72,
  pinchSensitivity = 0.5,
  pinchMaxStep = 1.12,
  interactionMode = 'runner',
}) => {
  const panState = useRef<{ active: boolean; lastX: number; lastY: number; pointerId?: number | null }>({
    active: false,
    lastX: 0,
    lastY: 0,
    pointerId: null,
  });

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  const pinch = useRef<{ active: boolean; lastDist: number } | null>(null);

  const [isGrabbing, setIsGrabbing] = useState(false);

  const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  };

  const getCenter = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch { /* ignore */ }

    const pointerCount = pointers.current.size;

    if (pointerCount === 1) {
      panState.current.active = true;
      panState.current.lastX = e.clientX;
      panState.current.lastY = e.clientY;
      panState.current.pointerId = e.pointerId;
      setIsGrabbing(true);
      e.preventDefault();
    } else if (pointerCount === 2) {
      panState.current.active = false;
      panState.current.pointerId = null;

      const iter = pointers.current.values();
      const p1 = iter.next().value as { x: number; y: number } | undefined;
      const p2 = iter.next().value as { x: number; y: number } | undefined;
      if (!p1 || !p2) return; // <-- TS-safe check

      const startDist = getDistance(p1, p2) || 1;
      pinch.current = { active: true, lastDist: startDist };
      setIsGrabbing(true);
      e.preventDefault();
    } else {
      e.preventDefault();
    }
  };

  const onBackgroundPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinch.current?.active && pointers.current.size >= 2) {
      const iter = pointers.current.values();
      const p1 = iter.next().value as { x: number; y: number } | undefined;
      const p2 = iter.next().value as { x: number; y: number } | undefined;
      if (!p1 || !p2) return;

      const currentDist = getDistance(p1, p2) || 0.0001;
      const incremental = currentDist / pinch.current.lastDist;
      const adjusted = 1 + (incremental - 1) * pinchSensitivity;
      const clamped = Math.max(1 / pinchMaxStep, Math.min(pinchMaxStep, adjusted));
      const center = getCenter(p1, p2);

      onZoom?.(clamped, center.x, center.y);
      pinch.current.lastDist = currentDist;
      e.preventDefault();
      return;
    }

    if (!panState.current.active) return;
    if (panState.current.pointerId != null && e.pointerId !== panState.current.pointerId) return;

    const dx = e.clientX - panState.current.lastX;
    const dy = e.clientY - panState.current.lastY;
    panState.current.lastX = e.clientX;
    panState.current.lastY = e.clientY;
    if (dx === 0 && dy === 0) return;
    onPan?.(dx, dy);
    e.preventDefault();
  };

  const onBackgroundPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);

    if (pinch.current?.active) {
      if (pointers.current.size < 2) {
        pinch.current = null;
        setIsGrabbing(false);

        if (pointers.current.size === 1) {
          const remainingEntry = pointers.current.entries().next().value as [number, { x: number; y: number }] | undefined;
          if (remainingEntry) {
            const [id, pos] = remainingEntry;
            panState.current.active = true;
            panState.current.pointerId = id;
            panState.current.lastX = pos.x;
            panState.current.lastY = pos.y;
            setIsGrabbing(true);
          }
        }
      }
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch { /* empty */ }
      e.preventDefault();
      return;
    }

    if (panState.current.active && panState.current.pointerId === e.pointerId) {
      panState.current.active = false;
      panState.current.pointerId = null;
      setIsGrabbing(false);
    }

    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch { /* empty */ }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    onZoom?.(factor, e.clientX, e.clientY);
  };

  const handleZoomIn = () => onZoom?.(1.12);
  const handleZoomOut = () => onZoom?.(1 / 1.12);
  const handleZoomReset = () => {
    if (zoom === 1) return;
    onZoom?.(1 / zoom);
  };

  const GRID_EXTENT = useMemo(() => 200_000, []);
  const half = GRID_EXTENT / 2;

  const gridStyle: React.CSSProperties = {
    position: 'absolute',
    left: -half,
    top: -half,
    width: GRID_EXTENT,
    height: GRID_EXTENT,
    pointerEvents: 'none',
    backgroundImage: `
      linear-gradient(0deg, rgba(0,0,0,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)
    `,
    backgroundSize: `${gridCellSize}px ${gridCellSize}px`,
    willChange: 'transform, background-position',
  };

  return (
    <div
      className="w-full h-full absolute top-0 left-0"
      style={{ bottom: `${bottomInsetPx}px`, touchAction: 'none' }}
      onWheel={onWheel}
    >
      <div
        className="absolute inset-0 z-0"
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onBackgroundPointerMove}
        onPointerUp={onBackgroundPointerUp}
        onPointerCancel={onBackgroundPointerUp}
        onPointerLeave={onBackgroundPointerUp}
        style={{ background: 'transparent', cursor: isGrabbing ? 'grabbing' : 'grab' }}
      />

      <div style={{ position: 'absolute', left: 10, top: 10, zIndex: 80 }}>
        <div className="flex flex-col gap-2 bg-white/90 p-2 rounded-lg shadow">
          <button onClick={handleZoomIn} className="w-8 h-8 rounded-md border text-sm">+</button>
          <button onClick={handleZoomOut} className="w-8 h-8 rounded-md border text-sm">−</button>
          <button onClick={handleZoomReset} className="w-8 h-8 rounded-md border text-sm">⤾</button>
        </div>
      </div>

      <div
        className="absolute z-10"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      >
        <div style={gridStyle} />
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {blocks.map((block) => {
            const isCurrentlyDragged = isDragging && draggedBlockId === block.id;
            return (
              <div
                key={block.id}
                className="absolute"
                style={{
                  left: block.x,
                  top: block.y,
                  transition: isCurrentlyDragged ? 'none' : 'left 150ms ease-out, top 150ms ease-out',
                  zIndex: isCurrentlyDragged ? 200 : 100,
                  pointerEvents: 'auto',
                  touchAction: 'none',
                }}
                onPointerDownCapture={(e: React.PointerEvent) => {
                  // If deleter mode — remove immediately and prevent drag start
                  if (interactionMode === 'deleter') {
                    // stop anything else from handling this pointer (including your drag hook)
                    try { e.stopPropagation(); } catch { /* empty */ }
                    try { e.preventDefault(); } catch { /* empty */ }
                    onBlockRemove(block.id);
                    return;
                  }
                  // Otherwise, forward to the drag start handler (which will call your hook)
                  onBlockDragStart(block, e);
                }}
              >
                <BlockComponent
                  block={block}
                  onDragStart={(e) => onBlockDragStart(block, e)}
                  onGreenFlagClick={block.type === 'green-flag' ? () => onGreenFlagClick(block.id) : undefined}
                  onDelayChange={block.type === 'delay' ? (value) => onDelayChange(block.id, value) : undefined}
                  onRemove={() => onBlockRemove(block.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
