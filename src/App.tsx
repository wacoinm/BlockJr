// src/App.tsx
import React, { useState, useCallback, createContext, useMemo, useEffect, useRef } from 'react';
import { useSnapSound } from './utils/soundEffects';
import { executeBlocks } from './utils/blockExecutor';
import { useDragDrop } from './hooks/useDragDrop';
import { Block } from './types/Block';
import { BlockPalette } from './components/BlockPalette';
import { BluetoothConnector } from './components/BluetoothConnector';
import { Workspace } from './components/Workspace';
import { ensureBluetoothPermissions } from './utils/ensureBluetoothPermissions';
import { MousePointer2, Trash2, Bluetooth as BluetoothIcon, Monitor, Sun, Moon } from 'lucide-react';

export const SoundContext = createContext(() => {});

const App: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isBluetoothConnected, setIsBluetoothConnected] = useState(false);
  const playSnapSound = useSnapSound();
  const blocksMap = useMemo(() => new Map(blocks.map(b => [b.id, b])), [blocks]);
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // store offset between pointer and block top-left (in world coords)
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    ensureBluetoothPermissions().catch(err => console.error(err));
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = viewportWidth < 768;
  const BLOCK_WIDTH = isMobile ? 48 : 64;
  const BLOCK_HEIGHT = isMobile ? 48 : 64;
  const HORIZONTAL_GAP = isMobile ? -2 : 2;
  const HORIZONTAL_SPACING = BLOCK_WIDTH + HORIZONTAL_GAP;

  // Pan & zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const screenToWorld = useCallback((sx: number, sy: number) => ({
    x: (sx - pan.x) / zoom,
    y: (sy - pan.y) / zoom
  }), [pan, zoom]);

  const zoomBy = useCallback((factor: number, cx?: number, cy?: number) => {
    const newZoom = Math.max(0.2, Math.min(3, zoom * factor));
    if (cx == null || cy == null) {
      cx = window.innerWidth / 2;
      cy = window.innerHeight / 2;
    }
    const worldUnderPointer = screenToWorld(cx, cy);
    const newPanX = cx - worldUnderPointer.x * newZoom;
    const newPanY = cy - worldUnderPointer.y * newZoom;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [zoom, screenToWorld]);

  const panBy = useCallback((dx: number, dy: number) => {
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const getChain = useCallback((startBlockId: string): Block[] => {
    const chain: Block[] = [];
    let currentBlock = blocksMap.get(startBlockId);
    while (currentBlock) {
      chain.push(currentBlock);
      currentBlock = currentBlock.childId ? blocksMap.get(currentBlock.childId) : undefined;
    }
    return chain;
  }, [blocksMap]);

  // Helper: extract clientX/clientY from Mouse | Touch | Pointer events without using `any`
  const getClientXY = useCallback((e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    // TouchEvent has touches
    if ('touches' in e && e.touches && e.touches.length > 0) {
      const t = e.touches[0];
      return { clientX: t.clientX, clientY: t.clientY };
    }
    // PointerEvent and MouseEvent have clientX/clientY
    if ('clientX' in e && 'clientY' in e) {
      return { clientX: (e as React.MouseEvent | React.PointerEvent).clientX, clientY: (e as React.MouseEvent | React.PointerEvent).clientY };
    }
    // Fallback (shouldn't happen)
    return { clientX: 0, clientY: 0 };
  }, []);

  // --- Drag / Drop logic with click offset fix ---
  const handleBlockDragStart = useCallback((block: Block, e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    const { clientX, clientY } = getClientXY(e);
    const pointerWorld = screenToWorld(clientX, clientY);

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
      setBlocks(prev => [...prev, newBlock]);
      return newBlock;
    }

    dragOffsetRef.current = { x: pointerWorld.x - block.x, y: pointerWorld.y - block.y };

    const chain = getChain(block.id);
    const otherBlocks = blocks.filter(b => !chain.find(cb => cb.id === b.id));
    setBlocks([...otherBlocks, ...chain]);

    if (block.parentId) {
      const parent = blocksMap.get(block.parentId);
      if (parent) {
        setBlocks(prev =>
          prev.map(b => (b.id === parent.id ? { ...b, childId: null } : b))
        );
      }
    }
    return block;
  }, [blocks, blocksMap, getChain, screenToWorld, BLOCK_WIDTH, BLOCK_HEIGHT, getClientXY]);

  const handleBlockDrag = useCallback((pos: { x: number; y: number }, draggedBlock: Block) => {
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

    setBlocks(prev => prev.map(b => (updates.has(b.id) ? { ...b, ...updates.get(b.id)! } : b)));
  }, [getChain, screenToWorld, HORIZONTAL_SPACING]);

  const handleDrop = useCallback((pos: { x: number, y: number }, droppedBlock: Block) => {
    const blockToSnap = blocksMap.get(droppedBlock.id);
    if (!blockToSnap) return;

    const chainIds = new Set(getChain(blockToSnap.id).map(b => b.id));
    const potentialTargets = blocks.filter(b => !b.childId && !chainIds.has(b.id));

    const horizSpacingWorld = HORIZONTAL_SPACING;
    const blockWidthWorld = BLOCK_WIDTH;
    const blockHeightWorld = BLOCK_HEIGHT;

    for (const targetBlock of potentialTargets) {
      const snapX = targetBlock.x + horizSpacingWorld;
      const snapY = targetBlock.y;

      if (Math.abs(blockToSnap.x - snapX) < (blockWidthWorld * 0.75) && Math.abs(blockToSnap.y - snapY) < (blockHeightWorld * 0.75)) {
        const chain = getChain(blockToSnap.id);
        const updates = new Map<string, Partial<Block>>();

        updates.set(targetBlock.id, { childId: blockToSnap.id });

        let newX = snapX;
        updates.set(blockToSnap.id, { x: newX, y: snapY, parentId: targetBlock.id });

        for (let i = 1; i < chain.length; i++) {
          newX += horizSpacingWorld;
          updates.set(chain[i].id, { x: newX, y: snapY });
        }

        setBlocks(prev => prev.map(b => (updates.has(b.id) ? { ...b, ...updates.get(b.id)! } : b)));
        playSnapSound();
        return;
      }
    }
  }, [blocks, blocksMap, getChain, playSnapSound, HORIZONTAL_SPACING, BLOCK_WIDTH, BLOCK_HEIGHT]);

  const { handleDragStart, isDragging, draggedBlock } = useDragDrop({
    onDragStart: handleBlockDragStart,
    onDrag: handleBlockDrag,
    onDrop: handleDrop,
    onDragEnd: () => {},
  });

  // inside App.tsx (replace existing handleGreenFlagClick)
  const handleGreenFlagClick = useCallback(async (blockId: string) => {
    // If Bluetooth isn't connected, show alert and don't execute.
    if (!isBluetoothConnected) {
      alert('You must connect to a device');
      return;
    }

    const flag = blocksMap.get(blockId);
    if (flag && flag.childId) {
      const executionChain = getChain(flag.childId);
      executeBlocks(executionChain);
    } else {
      console.log("No blocks connected to the Green Flag with ID:", blockId);
    }
  }, [blocksMap, getChain, isBluetoothConnected]);


  const handleDelayChange = useCallback((blockId: string, value: number) => {
    setBlocks(prev => prev.map(block => block.id === blockId ? { ...block, value } : block));
  }, []);

  const handleBlockRemove = useCallback((blockId: string) => {
    const blockToRemove = blocksMap.get(blockId);
    if (!blockToRemove) return;

    const chainToRemove = getChain(blockId);
    const idsToRemove = new Set(chainToRemove.map(b => b.id));

    let newBlocks = blocks.filter(b => !idsToRemove.has(b.id));

    if (blockToRemove.parentId) {
      const parent = blocksMap.get(blockToRemove.parentId);
      if (parent) {
        newBlocks = newBlocks.map(b => b.id === parent.id ? { ...b, childId: null } : b);
      }
    }

    setBlocks(newBlocks);
    playSnapSound();
  }, [blocksMap, getChain, playSnapSound]);

  // NEW: interaction mode state: 'runner' | 'deleter' (default 'runner')
  const [interactionMode, setInteractionMode] = useState<'runner' | 'deleter'>('runner');

  // NEW: Bluetooth panel open state (controlled by App-level FAB)
  const [bluetoothOpen, setBluetoothOpen] = useState<boolean>(false);

  // THEME: 'system' | 'light' | 'dark' (default system)
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    try {
      const s = localStorage.getItem('theme') as ('system' | 'light' | 'dark') | null;
      return s ?? 'system';
    } catch {
      return 'system';
    }
  });

  // Apply theme to documentElement and listen to system changes if theme === 'system'
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');

    const apply = () => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        // system
        if (mq?.matches) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      }
    };

    apply();

    if (theme === 'system' && mq) {
      const handler = () => apply();
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
      } else {
        // older browsers
        mq.addListener(handler);
        return () => {
          mq.removeListener(handler);
        };
      }
    }
    return;
  }, [theme]);

  const cycleTheme = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    try { localStorage.setItem('theme', next); } catch { /* empty */ }
  };


  return (
    <SoundContext.Provider value={playSnapSound}>
      <div className="h-screen w-screen overflow-hidden relative">
        {/* Pass open prop so App-level FAB can control the connector panel */}
        <BluetoothConnector
          open={bluetoothOpen}
          onConnectionChange={setIsBluetoothConnected}
        />

        {/* Top-right stacked FABs: consistent gap between each */}
        <div className="absolute top-4 right-4 z-50 flex flex-col gap-3 items-end">
          {/* Bluetooth FAB */}
          <button
            onClick={() => setBluetoothOpen(prev => !prev)}
            title="Bluetooth"
            className="w-12 h-12 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-100 hover:scale-105"
            aria-pressed={bluetoothOpen}
          >
            <BluetoothIcon className="w-6 h-6" />
          </button>

          {/* Theme FAB */}
          <button
            onClick={cycleTheme}
            title={`Theme: ${theme}`}
            className="w-12 h-12 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-100 hover:scale-105"
          >
            {theme === 'system' && <Monitor className="w-6 h-6" />}
            {theme === 'light' && <Sun className="w-6 h-6" />}
            {theme === 'dark' && <Moon className="w-6 h-6" />}
          </button>

          {/* Interaction mode FAB (same gap as others) */}
          <button
            onClick={() => setInteractionMode(prev => prev === 'runner' ? 'deleter' : 'runner')}
            title={interactionMode === 'runner' ? 'Runner mode (default)' : 'Deleter mode (click a block to remove)'}
            className={`
              w-12 h-12 rounded-full shadow-lg transition-all duration-200
              flex items-center justify-center
              ${interactionMode === 'runner'
                ? 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-700'
                : 'bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700'}
            `}
          >
            {interactionMode === 'runner' ? <MousePointer2 className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
          </button>
        </div>

        <Workspace
          blocks={blocks}
          isDragging={isDragging}
          draggedBlockId={draggedBlock?.id}
          onGreenFlagClick={handleGreenFlagClick}
          onDelayChange={handleDelayChange}
          onBlockRemove={handleBlockRemove}
          onBlockDragStart={handleDragStart}
          panX={pan.x}
          panY={pan.y}
          zoom={zoom}
          onPan={panBy}
          onZoom={zoomBy}
          interactionMode={interactionMode} // <-- new prop
        />
        <BlockPalette onBlockDrag={handleDragStart} />

        <div className="fixed right-4 bottom-4 text-xs text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 px-3 py-2 rounded-md shadow-sm z-60">
          <div>vw: {viewportWidth}px</div>
          <div>zoom: {zoom.toFixed(2)}</div>
          <div>pan: {Math.round(pan.x)}, {Math.round(pan.y)}</div>
        </div>
      </div>
    </SoundContext.Provider>
  );
}

export default App;
