// src/App.tsx
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
import { BlockPalette } from './components/BlockPalette';
import { BluetoothConnector } from './components/BluetoothConnector';
import { Workspace } from './components/Workspace';
import WorkspaceControls from './components/WorkspaceControls';
import { ensureBluetoothPermissions } from './utils/ensureBluetoothPermissions';
import {
  MousePointer2,
  Trash2,
  Bluetooth as BluetoothIcon,
  Monitor,
  Sun,
  Moon,
  FolderOpenDot,
} from 'lucide-react';
import Header from './components/Header';
import { SplashScreen } from '@capacitor/splash-screen';
import { useCaptureHistory } from './hooks/useCaptureHistory';
import useBlockDragDrop from './hooks/useBlockDragDrop';
import usePanZoom from './hooks/usePanZoom';

export const SoundContext = createContext(() => {});

const App: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isBluetoothConnected, setIsBluetoothConnected] = useState(false);
  const playSnapSound = useSnapSound();
  const blocksMap = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );

  const blocksRef = useRef<Block[]>(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Use the extracted capture/history hook
  const {
    submitCapture,
    goPrev,
    goNext,
    hasPrev,
    hasNext,
  } = useCaptureHistory(blocksRef, setBlocks);

  useEffect(() => {
    ensureBluetoothPermissions().catch((err) => console.error(err));
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    SplashScreen.hide().catch(err => {
      console.warn('Failed to hide splash screen:', err);
    });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = viewportWidth < 768;
  const BLOCK_WIDTH = isMobile ? 48 : 64;
  const BLOCK_HEIGHT = isMobile ? 48 : 64;
  const HORIZONTAL_GAP = isMobile ? -2 : 2;
  const HORIZONTAL_SPACING = BLOCK_WIDTH + HORIZONTAL_GAP;

  // --- usePanZoom hook (pan & zoom encapsulated) ---
  const { pan, zoom, screenToWorld, zoomBy, panBy } = usePanZoom({ x: 0, y: 0 }, 1);

  const getChain = useCallback(
    (startBlockId: string): Block[] => {
      const chain: Block[] = [];
      let currentBlock = blocksMap.get(startBlockId);
      while (currentBlock) {
        chain.push(currentBlock);
        currentBlock = currentBlock.childId
          ? blocksMap.get(currentBlock.childId)
          : undefined;
      }
      return chain;
    },
    [blocksMap],
  );

  const getClientXY = useCallback(
    (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      if ('touches' in e && e.touches && e.touches.length > 0) {
        const t = e.touches[0];
        return { clientX: t.clientX, clientY: t.clientY };
      }
      if ('clientX' in e && 'clientY' in e) {
        return {
          clientX: (e as React.MouseEvent | React.PointerEvent).clientX,
          clientY: (e as React.MouseEvent | React.PointerEvent).clientY,
        };
      }
      return { clientX: 0, clientY: 0 };
    },
    [],
  );

  const applyUpdatesAndNormalize = useCallback(
    (updates: Map<string, Partial<Block>>, capture: boolean = true) => {
      setBlocks((prev) => {
        let merged = prev.map((b) => (updates.has(b.id) ? { ...b, ...updates.get(b.id)! } : { ...b }));

        const parentToChild = new Map<string, string>();
        for (const b of merged) {
          if (b.parentId) {
            parentToChild.set(b.parentId, b.id);
          }
        }
        merged = merged.map((b) => ({ ...b, childId: parentToChild.get(b.id) ?? null }));

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

  // --- useBlockDragDrop hook ---
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

  // --- Unit selector additions ---
  const unitOptions = [
    { key: '100m', label: '100m', value: 0.1 },
    { key: '10m', label: '10m', value: 0.01 },
    { key: '1s', label: '1s', value: 1 },
  ];
  const [unitIndex, setUnitIndex] = useState<number>(0); // default to first
  const unitValue = unitOptions[unitIndex].value;
  const unitLabel = unitOptions[unitIndex].label;
  const cycleUnit = useCallback(() => {
    setUnitIndex((i) => (i + 1) % unitOptions.length);
  }, []);

  // Green flag execution — passes unitValue to executor
  const handleGreenFlagClick = useCallback(
    async (blockId: string) => {
      if (!isBluetoothConnected) {
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

  const handleDelayChange = useCallback((blockId: string, value: number) => {
    setBlocks((prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, value } : block)),
    );
    // capture change (dedupe will skip if no real change)
    // we schedule a microtask to ensure blocksRef updated first
    setTimeout(() => submitCapture(), 0);
  }, [submitCapture]);

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
          newBlocks = newBlocks.map((b) =>
            b.id === parent.id ? { ...b, childId: null } : b,
          );
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
    [blocksMap, getChain, playSnapSound, submitCapture, blocks],
  );

  const [interactionMode, setInteractionMode] =
    useState<'runner' | 'deleter'>('runner');
  const [bluetoothOpen, setBluetoothOpen] = useState(false);

  // --- Select Project popup states & animation config ---
  const [selectVisible, setSelectVisible] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>('elevator');

  // animation timing (ms)
  const ITEM_STAGGER = 80;
  const BASE_DURATION = 220;
  const ITEM_DURATION = 180;
  const totalCloseDelay = BASE_DURATION + ITEM_STAGGER * 2 + 40;

  const openSelectPopup = useCallback(() => {
    setSelectVisible(true);
    requestAnimationFrame(() => {
      setSelectOpen(true);
    });
  }, []);

  const closeSelectPopup = useCallback(() => {
    setSelectOpen(false);
    // unmount after animation + stagger
    setTimeout(() => {
      setSelectVisible(false);
    }, totalCloseDelay);
  }, [totalCloseDelay]);

  // keyboard ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectVisible) closeSelectPopup();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectVisible, closeSelectPopup]);

  // theme
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('theme') as 'system' | 'light' | 'dark') ?? 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else if (theme === 'light') document.documentElement.classList.remove('dark');
      else {
        mq?.matches
          ? document.documentElement.classList.add('dark')
          : document.documentElement.classList.remove('dark');
      }
    };
    apply();
    if (theme === 'system' && mq) {
      const handler = () => apply();
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);
  const cycleTheme = () => {
    const next =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch { /* empty */ }
  };

  // Hamburger state
  const [menuOpen, setMenuOpen] = useState(false);

  // FAB items (added 'unit' FAB last — text label, click to cycle unit)
  const fabItems = [
    {
      key: 'bluetooth',
      onClick: () => setBluetoothOpen((p) => !p),
      content: <BluetoothIcon className="w-6 h-6" />,
    },
    {
      key: 'theme',
      onClick: cycleTheme,
      content:
        theme === 'system' ? (
          <Monitor className="w-6 h-6" />
        ) : theme === 'light' ? (
          <Sun className="w-6 h-6" />
        ) : (
          <Moon className="w-6 h-6" />
        ),
    },
    {
      key: 'interaction',
      onClick: () =>
        setInteractionMode((prev) =>
          prev === 'runner' ? 'deleter' : 'runner',
        ),
      content:
        interactionMode === 'runner' ? (
          <MousePointer2 className="w-6 h-6" />
        ) : (
          <Trash2 className="w-6 h-6" />
        ),
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
      onClick: () => {
        cycleUnit();
      },
      content: (
        <div className="text-xs font-semibold select-none pointer-events-none">
          {unitLabel}
        </div>
      ),
    },
  ];

  const projects = ['elevator', 'bulldozer', 'lift truck'];

  const handleProjectSelect = (proj: string) => {
    setSelectedProject(proj);
    closeSelectPopup();
  };

  return (
    <SoundContext.Provider value={playSnapSound}>
      <Header
        initialCollapsed={false}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={goPrev}
        onNext={goNext}
      />
      <div className="h-screen w-screen overflow-hidden relative">
        <BluetoothConnector
          open={bluetoothOpen}
          onConnectionChange={setIsBluetoothConnected}
        />

        {/* Workspace controls (hamburger, FABs, project popup, debug panel) */}
        <WorkspaceControls
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
          viewportWidth={viewportWidth}
          zoom={zoom}
          panX={pan.x}
          panY={pan.y}
          unitLabel={unitLabel}
          theme={theme}
        />

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
          interactionMode={interactionMode}
        />
        <BlockPalette onBlockDrag={handleDragStart} selectedProject={selectedProject} />
      </div>
    </SoundContext.Provider>
  );
};

export default App;
