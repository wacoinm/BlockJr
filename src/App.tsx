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
import { ensureBluetoothPermissions } from './utils/ensureBluetoothPermissions';
import {
  MousePointer2,
  Trash2,
  Bluetooth as BluetoothIcon,
  Monitor,
  Sun,
  Moon,
  X,
  FolderOpenDot,
  FolderKanban
} from 'lucide-react';
import Kamaan from '../public/icon.svg?react';
import { SplashScreen } from '@capacitor/splash-screen';

export const SoundContext = createContext(() => {});

const App: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isBluetoothConnected, setIsBluetoothConnected] = useState(false);
  const playSnapSound = useSnapSound();
  const blocksMap = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );

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

  // helper: apply updates map, then normalize ALL chains (so members align immediately)
  // NOTE: also rebuild childId from parentId to keep links consistent (prevent visual-only connection)
  const applyUpdatesAndNormalize = useCallback(
    (updates: Map<string, Partial<Block>>) => {
      setBlocks((prev) => {
        // merge updates into a fresh copy
        let merged = prev.map((b) => (updates.has(b.id) ? { ...b, ...updates.get(b.id)! } : { ...b }));

        // === Rebuild child links from parent links to ensure bidirectional consistency ===
        // For each block where parentId != null, set parentToChild[parentId] = block.id
        const parentToChild = new Map<string, string>();
        for (const b of merged) {
          if (b.parentId) {
            parentToChild.set(b.parentId, b.id);
          }
        }
        merged = merged.map((b) => ({ ...b, childId: parentToChild.get(b.id) ?? null }));

        // normalize every chain: find heads (parentId === null) and lay out sequentially
        const heads = merged.filter((b) => b.parentId == null);
        for (const head of heads) {
          // find head in merged
          const headIndex = merged.findIndex((m) => m.id === head.id);
          if (headIndex === -1) continue;
          // keep head.x and head.y as canonical starting coords for that chain
          let currX = merged[headIndex].x;
          const y = merged[headIndex].y;

          // walk the chain by childId and normalize positions
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

        return merged;
      });
    },
    [HORIZONTAL_SPACING],
  );

  // --- Drag / Drop logic with click offset fix ---
  const handleBlockDragStart = useCallback(
    (block: Block, e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      const { clientX, clientY } = getClientXY(e);
      const pointerWorld = screenToWorld(clientX, clientY);

      // create from template
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
        setBlocks((prev) => [...prev, newBlock]);
        return newBlock;
      }

      dragOffsetRef.current = { x: pointerWorld.x - block.x, y: pointerWorld.y - block.y };

      // We want to detach the dragged sub-chain from its parent *atomically* and
      // move it to top of stacking order (append it to the end of array).
      const draggedChain = getChain(block.id); // subchain starting at `block`
      if (draggedChain.length === 0) return block;

      const draggedIds = new Set(draggedChain.map((d) => d.id));
      // other blocks excluding dragged chain
      const otherBlocks = blocks.filter((b) => !draggedIds.has(b.id)).map(b => ({ ...b }));

      // If there is a parent pointing to the dragged head, clear that parent's childId
      const parentId = block.parentId;
      if (parentId) {
        const pi = otherBlocks.findIndex((b) => b.id === parentId);
        if (pi !== -1) {
          otherBlocks[pi] = { ...otherBlocks[pi], childId: null };
        }
      }

      // Make dragged chain head have parentId === null (it's now detached)
      // Also ensure internal parent/child pointers of the dragged chain are consistent
      const normalizedDragged = draggedChain.map((d, idx, arr) => {
        const next = arr[idx + 1];
        const prev = arr[idx - 1];
        return {
          ...d,
          parentId: idx === 0 ? null : prev.id,
          childId: idx < arr.length - 1 ? next.id : d.childId ?? null,
        };
      });

      // set state once: other blocks first (keeps z-order) then dragged chain
      setBlocks([...otherBlocks, ...normalizedDragged]);

      return block;
    },
    [blocks, getChain, screenToWorld, BLOCK_WIDTH, BLOCK_HEIGHT, getClientXY],
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

      // during dragging we just update positions directly (no normalize here)
      setBlocks((prev) =>
        prev.map((b) => (updates.has(b.id) ? { ...b, ...updates.get(b.id)! } : b)),
      );
    },
    [getChain, screenToWorld, HORIZONTAL_SPACING],
  );

  const handleDrop = useCallback(
    (pos: { x: number; y: number }, droppedBlock: Block) => {
      const blockToSnap = blocksMap.get(droppedBlock.id);
      if (!blockToSnap) return;

      const draggedChain = getChain(blockToSnap.id); // the subchain we dragged
      if (draggedChain.length === 0) return;
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

            // move target chain right after green
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

            applyUpdatesAndNormalize(updates);
            playSnapSound();
            return;
          }
        }

        // If not snapped to a head, do nothing for green-flag — it cannot attach elsewhere.
        return;
      }

      // We'll iterate targets and evaluate two possible actions:
      // - attachAfterTarget: drop close to the target center -> add after target
      // - insertBetweenTargetAndChild: drop close to the gap between target and its child
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
        // handle attachAfter (which effectively becomes insert if target has child)
        if (best.kind === 'attachAfter') {
          const target = best.target;
          const firstDragged = draggedChain[0];
          const lastDragged = draggedChain[draggedChain.length - 1];
          const updates = new Map<string, Partial<Block>>();

          const snapX = target.x + horizSpacingWorld;
          const snapY = target.y;

          // if target already has a child -> we will insert (shift child chain)
          if (target.childId) {
            const originalChild = blocksMap.get(target.childId!);
            if (!originalChild) {
              // safety: treat as simple attach
              updates.set(target.id, { childId: firstDragged.id });
              // position dragged chain
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
              // insert between target and originalChild
              const originalChildChain = getChain(originalChild.id);
              // link target -> firstDragged
              updates.set(target.id, { childId: firstDragged.id });
              // link lastDragged -> originalChild
              updates.set(lastDragged.id, { childId: originalChild.id });
              // update original child's parent
              updates.set(originalChild.id, { parentId: lastDragged.id });

              // position dragged chain starting at snapX
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

              // reposition original child chain to start after inserted chain
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

            applyUpdatesAndNormalize(updates);
            playSnapSound();
            return;
          } else {
            // simple attach to right of target (target has no child)
            updates.set(target.id, { childId: firstDragged.id });

            // position dragged chain starting at snapX
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

            applyUpdatesAndNormalize(updates);
            playSnapSound();
            return;
          }
        }

        // handle insertBetween explicitly (target + its child)
        if (best.kind === 'insertBetween') {
          const target = best.target;
          if (!target.childId) {
            // nothing to insert between — skip
            // (shouldn't happen, but safe guard)
            return;
          }
          const child = blocksMap.get(target.childId!);
          if (!child) return;

          const updates = new Map<string, Partial<Block>>();
          const firstDragged = draggedChain[0];
          const lastDragged = draggedChain[draggedChain.length - 1];

          // connect target -> firstDragged
          updates.set(target.id, { childId: firstDragged.id });
          // connect lastDragged -> child
          updates.set(lastDragged.id, { childId: child.id });
          // set child's parent to lastDragged
          updates.set(child.id, { parentId: lastDragged.id });

          // position dragged chain starting after target
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

          // shift the original child chain to start after the inserted chain
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

          applyUpdatesAndNormalize(updates);
          playSnapSound();
          return;
        }
      }

      // DEFAULT fallback: try attach to a block that has no child (append)
      // (green-flag is already handled above and will not fall through here)
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

          applyUpdatesAndNormalize(updates);
          playSnapSound();
          return;
        }
      }

      // If nothing matched, leave blocks where they are (no snap).
    },
    [blocks, blocksMap, getChain, playSnapSound, HORIZONTAL_SPACING, BLOCK_WIDTH, BLOCK_HEIGHT, applyUpdatesAndNormalize],
  );

  const { handleDragStart, isDragging, draggedBlock } = useDragDrop({
    onDragStart: handleBlockDragStart,
    onDrag: handleBlockDrag,
    onDrop: handleDrop,
    onDragEnd: () => {},
  });

  // Green flag execution
  const handleGreenFlagClick = useCallback(
    async (blockId: string) => {
      if (!isBluetoothConnected) {
        alert('You must connect to a device');
        // return;
      }
      const flag = blocksMap.get(blockId);
      if (flag && flag.childId) {
        const executionChain = getChain(flag.childId);
        executeBlocks(executionChain);
      }
    },
    [blocksMap, getChain, isBluetoothConnected],
  );

  const handleDelayChange = useCallback((blockId: string, value: number) => {
    setBlocks((prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, value } : block)),
    );
  }, []);

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

      setBlocks(newBlocks);
      playSnapSound();
    },
    [blocksMap, getChain, playSnapSound],
  );

  const [interactionMode, setInteractionMode] =
    useState<'runner' | 'deleter'>('runner');
  const [bluetoothOpen, setBluetoothOpen] = useState(false);

  // --- Select Project popup states & animation config ---
  const [selectVisible, setSelectVisible] = useState(false); // mounted
  const [selectOpen, setSelectOpen] = useState(false); // animating / visible
  const [selectedProject, setSelectedProject] = useState<string | null>("elevator");

  // animation timing (ms)
  const ITEM_STAGGER = 80;
  const BASE_DURATION = 220;
  const ITEM_DURATION = 180;
  const totalCloseDelay = BASE_DURATION + ITEM_STAGGER * 2 + 40; // ~ safe unmount time

  // open popup: mount then open (to trigger transitions)
  const openSelectPopup = useCallback(() => {
    setSelectVisible(true);
    // next frame -> set open to true to run transitions
    requestAnimationFrame(() => {
      setSelectOpen(true);
    });
  }, []);

  // close popup: trigger closing animation then unmount after animations complete
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
    // NEW: Select Project FAB (appears under interaction)
    {
      key: 'selectProject',
      onClick: () => {
        if (!selectVisible) openSelectPopup();
        else closeSelectPopup();
      },
      content: <FolderOpenDot className="w-6 h-6" />,
    },
  ];

  // project list
  const projects = ['elevator', 'bulldozer', 'lift truck'];

  const handleProjectSelect = (proj: string) => {
    setSelectedProject(proj);
    // you can trigger project loading logic here
    closeSelectPopup();
  };

  return (
    <SoundContext.Provider value={playSnapSound}>
      <div className="h-screen w-screen overflow-hidden relative">
        <BluetoothConnector
          open={bluetoothOpen}
          onConnectionChange={setIsBluetoothConnected}
        />

        {/* Hamburger + animated FABs */}
        <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-3">
          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-100 transition-transform duration-200 hover:scale-105"
          >
            <div className="relative w-6 h-6">
              <Kamaan
                className={`absolute inset-0 w-6 h-6 scale-[200%] transform transition-all duration-300 ${
                  menuOpen ? 'scale-0 rotate-90 opacity-0' : 'scale-100 opacity-100'
                }`}
              />
              <X
                className={`absolute inset-0 w-6 h-6 transform transition-all duration-300 ${
                  menuOpen ? 'scale-100 rotate-90 opacity-100' : 'scale-0 opacity-0'
                }`}
              />
            </div>
          </button>

          {/* FABs animate below */}
          {fabItems.map((f, idx) => {
            const delay = idx * 80;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  f.onClick();
                }}
                style={{ transitionDelay: `${delay}ms` }}
                className={`
                  w-12 h-12 rounded-full shadow-lg flex items-center justify-center
                  transform transition-all duration-300
                  ${
                    menuOpen
                      ? 'scale-100 opacity-100 translate-y-0'
                      : 'scale-75 opacity-0 -translate-y-2 pointer-events-none'
                  }
                  ${
                    f.key === 'interaction' && interactionMode === 'deleter'
                      ? 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }
                `}
              >
                {f.content}
              </button>
            );
          })}
        </div>

        {/* Select Project popup: anchored upper-right with higher z-index */}
        {selectVisible && (
          <div
            // container (covers whole screen, but panel anchored top-right)
            className="fixed inset-0 z-[88] pointer-events-auto"
            onClick={(e) => {
              // clicking truly outside should close
              if (e.target === e.currentTarget) closeSelectPopup();
            }}
            aria-modal="true"
            role="dialog"
          >
            {/* backdrop (below panel) */}
            <div
              className={`absolute inset-0 bg-black transition-opacity`}
              style={{
                zIndex: 88,
                transitionDuration: `${BASE_DURATION}ms`,
                opacity: selectOpen ? 0.36 : 0,
              }}
            />

            {/* Panel anchored near the top-right (above the FABs) */}
            <div
              className="absolute right-6 top-20"
              style={{ zIndex: 90 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                // panel
                className={`relative w-64 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-4 transform origin-top-right`}
                style={{
                  transitionProperty: 'transform, opacity',
                  transitionDuration: `${BASE_DURATION}ms`,
                  transform: selectOpen ? 'translateY(0px) scale(1)' : 'translateY(6px) scale(0.96)',
                  opacity: selectOpen ? 1 : 0,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className='flex gap-1 items-center'>
                    <FolderKanban className='w-5 h-5' />
                    <div className="text-sm font-semibold">Projects</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeSelectPopup();
                    }}
                    className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700"
                    aria-label="Close select project"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {projects.map((p, i) => {
                    // stagger delay top->down when opening,
                    // when closing we reverse order for nicer effect
                    const openDelay = i * ITEM_STAGGER;
                    const closeDelay = (projects.length - 1 - i) * ITEM_STAGGER;
                    const delay = selectOpen ? openDelay : closeDelay;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleProjectSelect(p)}
                        className="w-full text-left px-3 py-2 rounded-lg transform transition-all"
                        style={{
                          transitionProperty: 'transform, opacity',
                          transitionDuration: `${ITEM_DURATION}ms`,
                          transitionDelay: `${delay}ms`,
                          transform: selectOpen ? 'translateY(0px) scale(1)' : 'translateY(-6px) scale(0.96)',
                          opacity: selectOpen ? 1 : 0,
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="text-sm capitalize">{p}</div>
                        {selectedProject === p && (
                          <div className="text-xs text-slate-500">Selected</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

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

        <div className="fixed right-4 bottom-4 text-xs text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 px-3 py-2 rounded-md shadow-sm z-60">
          <div>vw: {viewportWidth}px</div>
          <div>zoom: {zoom.toFixed(2)}</div>
          <div>
            pan: {Math.round(pan.x)}, {Math.round(pan.y)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            project: {selectedProject ?? 'none'}
          </div>
        </div>
      </div>
    </SoundContext.Provider>
  );
};

export default App;
