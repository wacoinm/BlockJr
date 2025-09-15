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
import { useDragDrop } from './hooks/useDragDrop';
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

  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

  // Pan & zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

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
        cx = window.innerWidth / 2;
        cy = window.innerHeight / 2;
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

  // --- Drag / Drop logic with click offset fix ---
  const handleBlockDragStart = useCallback(
    (block: Block, e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
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
        setBlocks((prev) => {
          const next = [...prev, newBlock];
          blocksRef.current = next;
          submitCapture(next);
          return next;
        });
        return newBlock;
      }

      dragOffsetRef.current = { x: pointerWorld.x - block.x, y: pointerWorld.y - block.y };

      const draggedChain = getChain(block.id);
      if (draggedChain.length === 0) return block;

      const draggedIds = new Set(draggedChain.map((d) => d.id));
      const otherBlocks = blocks.filter((b) => !draggedIds.has(b.id)).map(b => ({ ...b }));

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
    [blocks, getChain, screenToWorld, BLOCK_WIDTH, BLOCK_HEIGHT, getClientXY, submitCapture],
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

      setBlocks((prev) =>
        prev.map((b) => (updates.has(b.id) ? { ...b, ...updates.get(b.id)! } : b)),
      );
    },
    [getChain, screenToWorld, HORIZONTAL_SPACING],
  );

  const handleDrop = useCallback(
    (pos: { x: number; y: number }, droppedBlock: Block) => {
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
                  childId: i < draggedChain.length - 1 ? draggedChain[i + 1].id : draggedChain[i].childId ?? null,
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
                  childId: i < draggedChain.length - 1 ? draggedChain[i + 1].id : draggedChain[i].childId ?? null,
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
                childId: i < draggedChain.length - 1 ? draggedChain[i + 1].id : draggedChain[i].childId ?? null,
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
              childId: i < draggedChain.length - 1 ? draggedChain[i + 1].id : draggedChain[i].childId ?? null,
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
              childId: i < draggedChain.length - 1 ? draggedChain[i + 1].id : d.childId ?? null,
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
    [blocks, blocksMap, getChain, playSnapSound, HORIZONTAL_SPACING, BLOCK_WIDTH, BLOCK_HEIGHT, applyUpdatesAndNormalize, submitCapture],
  );

  const { handleDragStart, isDragging, draggedBlock } = useDragDrop({
    onDragStart: handleBlockDragStart,
    onDrag: handleBlockDrag,
    onDrop: handleDrop,
    onDragEnd: () => {},
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
    [blocksMap, getChain, playSnapSound, submitCapture],
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
