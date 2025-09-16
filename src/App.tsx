import React, {
  useState,
  useCallback,
  createContext,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { useSnapSound } from './utils/soundEffects';
import { executeBlocks } from './utils/blockExecutor';
import { Block } from './types/Block';
import Header from './components/Header';
import { SplashScreen } from '@capacitor/splash-screen';
import { useCaptureHistory } from './hooks/useCaptureHistory';
import useBlockDragDrop from './hooks/useBlockDragDrop';
import usePanZoom from './hooks/usePanZoom';
import useTheme from './hooks/useTheme';
import useProjects from './hooks/useProjects';
import useUnits from './hooks/useUnits';
import AppShell, { PointerEventLike } from './components/AppShell';
import {
  MousePointer2,
  Trash2,
  Bluetooth as BluetoothIcon,
  Monitor,
  Sun,
  Moon,
  FolderOpenDot,
} from 'lucide-react';

export const SoundContext = createContext<() => void>(() => {});

const App: React.FC = () => {
  // blocks + history
  const [blocks, setBlocks] = useState<Block[]>([]);
  const blocksRef = useRef<Block[]>(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const { submitCapture, goPrev, goNext, hasPrev, hasNext } = useCaptureHistory(blocksRef, setBlocks);

  // bluetooth connection state
  const [isBluetoothConnected, setIsBluetoothConnected] = useState<boolean>(false);

  // other global UI state
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );

  // sound
  const playSnapSound = useSnapSound();

  // derived map of blocks for O(1) lookup
  const blocksMap = useMemo(() => new Map<string, Block>(blocks.map((b) => [b.id, b])), [blocks]);

  // attempt to call ensureBluetoothPermissions if module exists (dynamic import to avoid build-time error)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // dynamic import avoids compile error if file missing
        // expected export: export function ensureBluetoothPermissions(): Promise<void>
        // if not present, this will throw and be caught below
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = await import('./utils/ensureBluetoothPermissions');
        if (!mounted) return;
        if (typeof mod.ensureBluetoothPermissions === 'function') {
          await mod.ensureBluetoothPermissions();
        }
      } catch (err) {
        console.warn('ensureBluetoothPermissions not available or failed:', err);
      }
    })();

    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);

    // hide splash if capacitor present
    void (async () => {
      try {
        await SplashScreen.hide();
      } catch (err) {
        // not critical
        console.warn('Failed to hide splash screen:', err);
      }
    })();

    return () => {
      mounted = false;
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const isMobile = viewportWidth < 768;
  const BLOCK_WIDTH = isMobile ? 48 : 64;
  const BLOCK_HEIGHT = isMobile ? 48 : 64;
  const HORIZONTAL_GAP = isMobile ? -2 : 2;
  const HORIZONTAL_SPACING = BLOCK_WIDTH + HORIZONTAL_GAP;

  // pan & zoom (hook)
  const { pan, zoom, screenToWorld, zoomBy, panBy } = usePanZoom({ x: 0, y: 0 }, 1);

  // helper functions
  const getChain = useCallback(
    (startBlockId: string): Block[] => {
      const chain: Block[] = [];
      let currentBlock = blocksMap.get(startBlockId);
      while (currentBlock) {
        chain.push(currentBlock);
        currentBlock = currentBlock.childId ? blocksMap.get(currentBlock.childId) : undefined;
      }
      return chain;
    },
    [blocksMap],
  );

  const getClientXY = useCallback((e: PointerEventLike) => {
    if ('touches' in e && e.touches && e.touches.length > 0) {
      const t = e.touches[0];
      return { clientX: t.clientX, clientY: t.clientY };
    }
    if ('clientX' in e && 'clientY' in e) {
      // mouse or pointer event
      return {
        clientX: (e as React.MouseEvent).clientX,
        clientY: (e as React.MouseEvent).clientY,
      };
    }
    return { clientX: 0, clientY: 0 };
  }, []);

  // apply updates + normalize chains/positions
  const applyUpdatesAndNormalize = useCallback(
    (updates: Map<string, Partial<Block>>, capture = true) => {
      setBlocks((prev) => {
        // merge updates
        let merged = prev.map((b) => (updates.has(b.id) ? { ...b, ...updates.get(b.id)! } : { ...b }));

        // recompute childId from parentId relationships
        const parentToChild = new Map<string, string>();
        for (const b of merged) {
          if (b.parentId) parentToChild.set(b.parentId, b.id);
        }
        merged = merged.map((b) => ({ ...b, childId: parentToChild.get(b.id) ?? null }));

        // normalize head chains horizontal spacing
        const heads = merged.filter((b) => b.parentId == null);
        for (const head of heads) {
          const headIndex = merged.findIndex((m) => m.id === head.id);
          if (headIndex === -1) continue;
          let currX = merged[headIndex].x;
          const y = merged[headIndex].y;

          let cur = merged[headIndex];
          while (cur) {
            const i = merged.findIndex((m) => m.id === cur.id);
            if (i === -1) break;
            merged[i] = { ...merged[i], x: currX, y };
            currX += HORIZONTAL_SPACING;
            if (!merged[i].childId) break;
            cur = merged.find((m) => m.id === merged[i].childId) as Block | undefined;
          }
        }

        blocksRef.current = merged;

        if (capture) {
          submitCapture(merged);
        }

        return merged;
      });
    },
    [HORIZONTAL_SPACING, submitCapture],
  );

  // block drag/drop hook (typed)
  const { handleDragStart, isDragging, draggedBlock } = useBlockDragDrop({
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
  });

  // units / projects / theme hooks (typed)
  const { unitLabel, unitValue, cycleUnit } = useUnits();
  const {
    selectVisible,
    selectOpen,
    selectedProject,
    openSelectPopup,
    closeSelectPopup,
    handleProjectSelect,
    ITEM_STAGGER,
    BASE_DURATION,
    ITEM_DURATION,
  } = useProjects('elevator');
  const { theme, cycleTheme } = useTheme('system');

  // actions: green flag
  const handleGreenFlagClick = useCallback(
    async (blockId: string) => {
      if (!isBluetoothConnected) {
        // keep the original behavior but don't block execution
        alert('You must connect to a device');
      }
      const flag = blocksMap.get(blockId);
      if (flag && flag.childId) {
        const executionChain = getChain(flag.childId);
        executeBlocks(executionChain, unitValue);
      }
    },
    [blocksMap, getChain, isBluetoothConnected, unitValue],
  );

  const handleDelayChange = useCallback(
    (blockId: string, value: number) => {
      setBlocks((prev) => prev.map((block) => (block.id === blockId ? { ...block, value } : block)));
      // schedule capture microtask
      setTimeout(() => submitCapture(), 0);
    },
    [submitCapture],
  );

  const handleBlockRemove = useCallback(
    (blockId: string) => {
      const blockToRemove = blocksMap.get(blockId);
      if (!blockToRemove) return;

      const chainToRemove = getChain(blockId);
      const idsToRemove = new Set(chainToRemove.map((b) => b.id));

      let newBlocks = blocks.filter((b) => !idsToRemove.has(b.id));

      if (blockToRemove.parentId) {
        const parent = blocksMap.get(blockToRemove.parentId);
        if (parent) {
          newBlocks = newBlocks.map((b) => (b.id === parent.id ? { ...b, childId: null } : b));
        }
      }

      setBlocks(() => {
        const nb = newBlocks;
        blocksRef.current = nb;
        submitCapture(nb);
        return nb;
      });
      playSnapSound();
    },
    [blocks, blocksMap, getChain, playSnapSound, submitCapture],
  );

  // UI state
  const [interactionMode, setInteractionMode] = useState<'runner' | 'deleter'>('runner');
  const [bluetoothOpen, setBluetoothOpen] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  // FAB items (typed)
  // NOTE: interaction item removed from fab and placed as a left-side floating control (see below)
  const fabItems: Array<{ key: string; onClick: () => void; content: React.ReactNode }> = [
    {
      key: 'bluetooth',
      onClick: () => setBluetoothOpen((p) => !p),
      content: <BluetoothIcon className="w-6 h-6" />,
    },
    {
      key: 'theme',
      onClick: cycleTheme,
      content: theme === 'system' ? <Monitor className="w-6 h-6" /> : theme === 'light' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />,
    },
    {
      key: 'selectProject',
      onClick: () => {
        if (!selectVisible) openSelectPopup();
        else closeSelectPopup();
      },
      content: <FolderOpenDot className="w-6 h-6" />,
    },
    {
      key: 'unit',
      onClick: cycleUnit,
      content: <div className="text-xs font-semibold select-none pointer-events-none">{unitLabel}</div>,
    },
  ];

  const projects = ['elevator', 'bulldozer', 'lift truck'];
  const LEFT_TOGGLE_LEFT = 6; // px - offset to avoid overlapping the palette toggle at left:0
  const LEFT_TOGGLE_BOTTOM = 84; // px - aligns roughly with the palette chooser bottom when closed
  const toggleInteraction = () => setInteractionMode((prev) => (prev === 'runner' ? 'deleter' : 'runner'));

  return (
    <SoundContext.Provider value={playSnapSound}>
      <Header initialCollapsed={false} hasPrev={hasPrev} hasNext={hasNext} onPrev={goPrev} onNext={goNext} />

     {/* left-side interaction button (moved out of hamburger FAB) */}
    <div
      style={{
        position: 'fixed',
        left: LEFT_TOGGLE_LEFT,
        bottom: LEFT_TOGGLE_BOTTOM,
        zIndex: 70,
      }}
    >
      <button
        aria-pressed={interactionMode === 'deleter'}
        onClick={toggleInteraction}
        className={`
          inline-flex items-center justify-center
          w-12 h-12 rounded-full shadow-lg
          cursor-pointer select-none
          transition-transform duration-200 hover:scale-105 active:scale-95
          bg-white dark:bg-slate-800
          text-gray-700 dark:text-slate-100
          hover:bg-gray-50 dark:hover:bg-slate-700
        `}
        title={interactionMode === 'runner' ? 'Switch to delete mode' : 'Switch to run mode'}
      >
        {interactionMode === 'runner' ? (
          <MousePointer2 className="w-5 h-5" />
        ) : (
          <Trash2 className="w-5 h-5" />
        )}
      </button>
    </div>

      <div className="h-screen w-screen overflow-hidden relative">
        <AppShell
          blocks={blocks}
          isDragging={isDragging}
          draggedBlockId={draggedBlock?.id}
          viewportWidth={viewportWidth}
          panX={pan.x}
          panY={pan.y}
          zoom={zoom}
          onPan={panBy}
          onZoom={zoomBy}
          onGreenFlagClick={handleGreenFlagClick}
          onDelayChange={handleDelayChange}
          onBlockRemove={handleBlockRemove}
          onBlockDragStart={handleDragStart}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          fabItems={fabItems}
          selectVisible={selectVisible}
          selectOpen={selectOpen}
          closeSelectPopup={closeSelectPopup}
          projects={projects}
          selectedProject={selectedProject}
          handleProjectSelect={handleProjectSelect}
          ITEM_STAGGER={ITEM_STAGGER}
          BASE_DURATION={BASE_DURATION}
          ITEM_DURATION={ITEM_DURATION}
          unitLabel={unitLabel}
          theme={theme}
          bluetoothOpen={bluetoothOpen}
          setBluetoothOpen={setBluetoothOpen}
          onBluetoothConnectionChange={setIsBluetoothConnected}
          interactionMode={interactionMode}
        />
      </div>
    </SoundContext.Provider>
  );
};

export default App;
