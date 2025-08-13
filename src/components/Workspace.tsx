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
}) => {
  const panState = useRef<{ active: boolean; lastX: number; lastY: number; pointerId?: number | null }>({
    active: false,
    lastX: 0,
    lastY: 0,
    pointerId: null,
  });

  const [isGrabbing, setIsGrabbing] = useState(false);

  // Panning handlers
  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if ((e as any).button !== undefined && (e as any).button !== 0) return;
    panState.current.active = true;
    panState.current.lastX = e.clientX;
    panState.current.lastY = e.clientY;
    panState.current.pointerId = e.pointerId ?? null;
    setIsGrabbing(true);
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {}
    e.preventDefault();
  };

  const onBackgroundPointerMove = (e: React.PointerEvent) => {
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

  const endPan = () => {
    if (!panState.current.active) return;
    panState.current.active = false;
    panState.current.pointerId = null;
    setIsGrabbing(false);
  };

  // Zoom with wheel + modifiers
  const onWheel = (e: React.WheelEvent) => {
    const shouldZoom = e.ctrlKey || e.metaKey || e.shiftKey;
    if (!shouldZoom) return;
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.08 : 1 / 1.08;
    onZoom?.(factor, e.clientX, e.clientY);
  };

  const handleZoomIn = () => onZoom?.(1.12);
  const handleZoomOut = () => onZoom?.(1 / 1.12);
  const handleZoomReset = () => {
    if (zoom === 1) return;
    const factor = 1 / zoom;
    onZoom?.(factor);
  };

  // Infinite grid simulation (huge area)
  const GRID_EXTENT = useMemo(() => 200000, []);
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
      {/* Panning layer */}
      <div
        className="absolute inset-0 z-0"
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onBackgroundPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onPointerLeave={endPan}
        style={{
          background: 'transparent',
          cursor: isGrabbing ? 'grabbing' : 'grab',
        }}
      />

      {/* Zoom controls */}
      <div style={{ position: 'absolute', left: 10, top: 10, zIndex: 80 }}>
        <div className="flex flex-col gap-2 bg-white/90 p-2 rounded-lg shadow">
          <button onClick={handleZoomIn} className="w-8 h-8 rounded-md border text-sm">+</button>
          <button onClick={handleZoomOut} className="w-8 h-8 rounded-md border text-sm">−</button>
          <button onClick={handleZoomReset} className="w-8 h-8 rounded-md border text-sm">⤾</button>
        </div>
      </div>

      {/* World (pan+zoom) */}
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
        {/* Infinite grid */}
        <div style={gridStyle} />

        {/* Blocks (in world coords) */}
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
                // capture pointer on the wrapper so the drag hook gets a stable target rect
                onPointerDownCapture={(e) => onBlockDragStart(block, e)}
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
