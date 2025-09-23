// src/components/Workspace.tsx
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Block } from '../types/Block';
import { BlockComponent } from './BlockComponent';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import type { RootState } from '../store';
import { updateBlock as updateBlockAction, removeBlock as removeBlockAction } from '../store/slices/blocksSlice';
import BatteryGauge from './BatteryGauge';
import { computeHorizStep, DEFAULT_BLOCK_WIDTH, GAP_BETWEEN_BLOCKS } from '../constants/spacing';

interface WorkspaceProps {
  blocks?: Block[]; // now optional — we prefer store when not provided
  isDragging?: boolean;
  draggedBlockId?: string;
  onGreenFlagClick?: (blockId: string) => void;
  onDelayChange?: (blockId: string, value: number) => void;
  onBlockRemove?: (blockId: string) => void;
  onBlockDragStart?: (block: Block, e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => void;
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

export const Workspace: React.FC<WorkspaceProps> = (props) => {
  const dispatch = useAppDispatch();

  // --- Hooks (unconditional) ---
  // Prefer store blocks when parent doesn't pass blocks prop.
  const reduxBlocks = useAppSelector((s: RootState) => (s.blocks ? s.blocks.blocks : undefined));
  const reduxPan = useAppSelector((s: RootState) => (s.panZoom ? s.panZoom.pan : { x: 0, y: 0 }));
  const reduxZoom = useAppSelector((s: RootState) => (s.panZoom ? s.panZoom.zoom : 1));
  const reduxInteractionMode = useAppSelector((s: RootState) => (s.interaction ? (s.interaction.mode ?? s.interaction.interactionMode) : undefined));

  // other hooks
  const panState = useRef<{ active: boolean; lastX: number; lastY: number; pointerId?: number | null }>({
    active: false,
    lastX: 0,
    lastY: 0,
    pointerId: null,
  });

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ active: boolean; lastDist: number } | null>(null);

  const [isGrabbing, setIsGrabbing] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false);

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // --- Derived props (prefer explicit props, fall back to redux) ---
  const {
    blocks: blocksProp,
    isDragging = false,
    draggedBlockId,
    onGreenFlagClick,
    onDelayChange: onDelayChangeProp,
    onBlockRemove: onBlockRemoveProp,
    onBlockDragStart,
    onPan: onPanProp,
    panX: panXProp,
    panY: panYProp,
    zoom: zoomProp,
    onZoom: onZoomProp,
    bottomInsetPx = 120,
    gridCellSize = 72,
    pinchSensitivity = 0.5,
    pinchMaxStep = 1.12,
    interactionMode: interactionModeProp,
  } = props;

  const blocks = blocksProp ?? reduxBlocks ?? [];
  const panX = typeof panXProp === 'number' ? panXProp : reduxPan.x ?? 0;
  const panY = typeof panYProp === 'number' ? panYProp : reduxPan.y ?? 0;
  const zoom = typeof zoomProp === 'number' ? zoomProp : reduxZoom ?? 1;
  const interactionMode = interactionModeProp ?? reduxInteractionMode ?? 'runner';

  // local fallback handlers that dispatch to store when parent didn't pass handlers
  const onDelayChangeDefault = (blockId: string, value: number) => {
    const b = blocks.find((bb) => bb.id === blockId);
    if (!b) return;
    dispatch(updateBlockAction({ ...b, value }));
  };
  const onBlockRemoveDefault = (blockId: string) => {
    // Note: the original app removed chains; here we remove single block — consider wiring chain removal logic in a thunk
    dispatch(removeBlockAction(blockId));
  };

  const onPan = onPanProp ?? (() => {});
  const onZoom = onZoomProp ?? (() => {});
  const _onDelayChange = onDelayChangeProp ?? onDelayChangeDefault;
  const _onBlockRemove = onBlockRemoveProp ?? onBlockRemoveDefault;

  // --- helpers used for pinch/pan ---
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
      if (!p1 || !p2) return;

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

      onZoom(clamped, center.x, center.y);
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
    onPan(dx, dy);
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
    onZoom(factor, e.clientX, e.clientY);
  };

  const handleZoomIn = () => onZoom(1.12);
  const handleZoomOut = () => onZoom(1 / 1.12);
  const handleZoomReset = () => {
    if (zoom === 1) return;
    onZoom(1 / zoom);
  };

  const GRID_EXTENT = useMemo(() => 200_000, []);
  const half = GRID_EXTENT / 2;

  const gridColorStrong = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)';
  const gridColorLight = isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.06)';

  const gridStyle: React.CSSProperties = {
    position: 'absolute',
    left: -half,
    top: `calc(${-half}px + var(--safe-area-inset-top))`,
    width: GRID_EXTENT,
    height: GRID_EXTENT,
    pointerEvents: 'none',
    backgroundImage: `
      linear-gradient(0deg, ${gridColorStrong} 1px, transparent 1px),
      linear-gradient(90deg, ${gridColorLight} 1px, transparent 1px)
    `,
    backgroundSize: `${gridCellSize}px ${gridCellSize}px`,
    willChange: 'transform, background-position',
  };

  //
  // ----------------- NEW: visual spacing pass (display-only) -----------------
  //
  // Build a displayX map so that chains never visually overlap. We don't mutate blocks[].
  // We compute an effective horizontal step (horizStep) using centralized computeHorizStep and the canonical GAP_BETWEEN_BLOCKS.
  //
  const displayXById = useMemo(() => {
    const map = new Map<string, number>();

    // fast lookup
    const blocksMap = new Map<string, Block>(blocks.map((b) => [b.id, b]));

    // compute horizStep using centralized rule:
    // - pass DEFAULT_BLOCK_WIDTH (fallback) and the canonical GAP_BETWEEN_BLOCKS so Workspace honors that constant.
    const horizStep = computeHorizStep(DEFAULT_BLOCK_WIDTH, GAP_BETWEEN_BLOCKS);

    // find heads (parentId === null)
    const heads = blocks.filter((b) => b.parentId == null);

    // For deterministic ordering, sort heads by their stored x
    heads.sort((a, b) => a.x - b.x);

    const visited = new Set<string>();

    for (const head of heads) {
      // if already processed via another head (defensive), skip
      if (visited.has(head.id)) {
        continue;
      }

      // walk chain from head following childId
      let chain: Block[] = [];
      let cur: Block | undefined = head;
      const cycleGuard = new Set<string>();
      while (cur && !cycleGuard.has(cur.id)) {
        chain.push(cur);
        cycleGuard.add(cur.id);
        if (!cur.childId) break;
        const next = blocksMap.get(cur.childId);
        if (!next) break;
        cur = next;
      }

      // compute displayed positions for this chain
      if (chain.length === 0) continue;
      // start at the head's stored x (don't move head left)
      let currX = chain[0].x;
      map.set(chain[0].id, currX);
      visited.add(chain[0].id);

      for (let i = 1; i < chain.length; i++) {
        const b = chain[i];
        // place child at least horizStep to the right of previous displayed position
        const nextX = Math.max(b.x, currX + horizStep);
        map.set(b.id, nextX);
        visited.add(b.id);
        currX = nextX;
      }
    }

    // For any block not visited (orphaned, or part of cycles), fallback to stored x
    for (const b of blocks) {
      if (!visited.has(b.id)) {
        map.set(b.id, b.x);
      }
    }

    return map;
  }, [blocks, gridCellSize]);

  //
  // ----------------- end spacing pass -----------------
  //

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

      {/* Zoom helper buttons - style respects dark mode */}
      <div style={{ position: 'absolute', left: 10, zIndex: 80 }} className='[top:calc(10px+var(--safe-area-inset-top))]'>
        <div className="flex flex-col gap-2 p-2 rounded-lg shadow"
             style={{
               backgroundColor: isDark ? 'rgba(9,12,20,0.7)' : 'rgba(255,255,255,0.92)',
               border: isDark ? '1px solid rgba(148,163,184,0.06)' : '1px solid rgba(203,213,225,0.6)'
             }}
        >
          <button onClick={handleZoomIn} className="w-8 h-8 rounded-md border text-sm" aria-label="Zoom in">+</button>
          <button onClick={handleZoomOut} className="w-8 h-8 rounded-md border text-sm" aria-label="Zoom out">−</button>
          <button onClick={handleZoomReset} className="w-8 h-8 rounded-md border text-sm" aria-label="Reset zoom">⤾</button>
        </div>
        <BatteryGauge size={46} className='mt-2' strokeWidth={1} />
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

            // Use computed displayX (never undefined because we default fallback to b.x)
            const displayLeft = displayXById.get(block.id) ?? block.x;

            return (
              <div
                key={block.id}
                className="absolute"
                style={{
                  left: displayLeft,
                  top: `calc(${block.y}px + var(--safe-area-inset-top))`,
                  transition: isCurrentlyDragged ? 'none' : 'left 150ms ease-out, top 150ms ease-out',
                  zIndex: isCurrentlyDragged ? 200 : 100,
                  pointerEvents: 'auto',
                  touchAction: 'none',
                }}
                onPointerDownCapture={(e: React.PointerEvent) => {
                  // If deleter mode — remove immediately and prevent drag start
                  if (interactionMode === 'deleter') {
                    try { e.stopPropagation(); } catch { /* empty */ }
                    try { e.preventDefault(); } catch { /* empty */ }
                    _onBlockRemove(block.id);
                    return;
                  }
                  // Otherwise, forward to the drag start handler (which will call your hook)
                  onBlockDragStart?.(block, e);
                }}
              >
                <BlockComponent
                  block={block}
                  onDragStart={(e) => onBlockDragStart?.(block, e)}
                  onGreenFlagClick={block.type === 'green-flag' ? () => onGreenFlagClick?.(block.id) : undefined}
                  onDelayChange={block.type === 'delay' ? (value) => _onDelayChange(block.id, value) : undefined}
                  onRemove={() => _onBlockRemove(block.id)}
                  style={{ width: 100, height: 100 }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Workspace;
