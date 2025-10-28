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
  SkipForward,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { useAppSelector } from './store/hooks';
import type { RootState } from './store';

import { computeHorizStep, GAP_BETWEEN_BLOCKS } from './constants/spacing';

import { saveProjectFile, readProjectFile, loadProjects, saveProjects } from './utils/projectStorage';
import { useParams, useNavigate, useLocation } from 'react-router';

import Confetti from 'react-confetti';
import { useDialogue } from 'dialogue-story';
import { elevator } from './assets/stories/elevator';
import validateElevatorChapter from './assets/stories/elevator-validate';
import { advanceSessionStep, getSession } from './utils/sessionStorage';

/* Timeline tasklist imports */
import TimelineTaskList, { TaskItem } from './components/TimelineTaskList';
import { getTaskListForProject } from './utils/manifest';

/* Emergency stop button (styled FAB) */
import EmergencyStopButton from './components/EmergencyStopButton';

export const SoundContext = createContext<() => void>(() => {});

const App: React.FC = () => {
  // read UI values from redux; cast to any for properties that may not be typed
  const reduxInteractionMode = useAppSelector((s: RootState) => (s.ui ? (s.ui as any).interactionMode : undefined));
  const reduxBluetoothOpen = useAppSelector((s: RootState) => (s.ui ? (s.ui as any).bluetoothOpen : undefined));

  // local blocks + history
  const [blocks, setBlocks] = useState<Block[]>([]);
  const blocksRef = useRef<Block[]>(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // capture history hook (we will wrap submitCapture for autosave)
  const { submitCapture: rawSubmitCapture, goPrev, goNext, hasPrev, hasNext } = useCaptureHistory(blocksRef, setBlocks);

  // selected project ref for autosave and session updates
  const selectedProjectRef = useRef<string | null>(null);

  // bluetooth connection state (local for now)
  const [isBluetoothConnected, setIsBluetoothConnected] = useState<boolean>(false);

  // viewport
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );

  // sound
  const playSnapSound = useSnapSound();

  // timeline tasklist UI state (show after dialogue ends)
  const [showTaskList, setShowTaskList] = useState<boolean>(false);
  const [activeTaskList, setActiveTaskList] = useState<TaskItem[] | null>(null);

  // derived map for quick lookup
  const blocksMap = useMemo(() => new Map<string, Block>(blocks.map((b) => [b.id, b])), [blocks]);

  // load ensureBluetoothPermissions if available
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('./utils/ensureBluetoothPermissions');
        if (!mounted) return;
        if (typeof mod.ensureBluetoothPermissions === 'function') {
          await mod.ensureBluetoothPermissions();
        }
      } catch (err) {
        // not critical
        console.warn('ensureBluetoothPermissions not available or failed:', err);
      }
    })();

    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);

    void (async () => {
      try {
        await SplashScreen.hide();
      } catch (err) {
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

  const HORIZONTAL_SPACING = GAP_BETWEEN_BLOCKS;

  const { pan, zoom, screenToWorld, zoomBy, panBy } = usePanZoom({ x: 0, y: 0 }, 0.5);

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
      return {
        clientX: (e as React.MouseEvent).clientX,
        clientY: (e as React.MouseEvent).clientY,
      };
    }
    return { clientX: 0, clientY: 0 };
  }, []);

  // Dialogue + elevator validation UI state
  const { dialogue } = useDialogue();
  const location = useLocation();
  const [showConfetti, setShowConfetti] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);
  const [currentDialogueChapter, setCurrentDialogueChapter] = useState<string | null>(null);

  // Autosave wrapper: call rawSubmitCapture then attempt to save blocks.json for the selected project
  const submitCapture = useCallback(
    (snapshot?: Block[]) => {
      rawSubmitCapture(snapshot);

      const projectId = selectedProjectRef.current;
      if (!projectId) return;

      try {
        const data = JSON.stringify(snapshot ?? blocksRef.current);
        void saveProjectFile(projectId, 'blocks.json', data).catch((err) => {
          console.warn('autosave failed', err);
        });
      } catch (err) {
        console.warn('autosave serialization failed', err);
      }

      // run elevator validator if this project is elevator
      try {
        if (projectId === 'آسانسور' && currentDialogueChapter) {
          const ok = validateElevatorChapter(snapshot ?? blocksRef.current, currentDialogueChapter);
          if (ok && !showNextButton) {
            setShowConfetti(true);
            setShowNextButton(true);
            setTimeout(() => setShowConfetti(false), 3500);
          }
        }
      } catch (e) {
        console.warn('validator check failed', e);
      }
    },
    [rawSubmitCapture, showNextButton, currentDialogueChapter],
  );

  // block updates & normalization
  const applyUpdatesAndNormalize = useCallback(
    (updates: Map<string, Partial<Block>>, capture = true) => {
      setBlocks((prev) => {
        let merged = prev.map((b) => (updates.has(b.id) ? { ...b, ...updates.get(b.id)! } : { ...b }));

        const parentToChild = new Map<string, string>();
        for (const b of merged) {
          if (b.parentId) parentToChild.set(b.parentId, b.id);
        }
        merged = merged.map((b) => ({ ...b, childId: parentToChild.get(b.id) ?? null }));

        const heads = merged.filter((b) => b.parentId == null);

        const horizStep = computeHorizStep(BLOCK_WIDTH, GAP_BETWEEN_BLOCKS);

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
            currX += horizStep;
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
    [BLOCK_WIDTH, submitCapture],
  );

  // block drag/drop hook
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

  useEffect(() => {
    selectedProjectRef.current = selectedProject ?? null;
  }, [selectedProject]);

  const { theme, cycleTheme } = useTheme('system');

  // If route param present, load that project's blocks and select it
  const params = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      // 1) Load projects index first
      let projectsIndex : any = [];
      try {
        projectsIndex = await loadProjects();
      } catch (e) {
        console.warn('loadProjects failed', e);
        // conservatively treat as no projects
        projectsIndex = [];
      }

      // If there are no projects at all -> go to project manager
      if (!projectsIndex || projectsIndex.length === 0) {
        navigate('/', { replace: true });
        return;
      }

      // If no route param -> nothing to load
      if (!params?.id) return;

      const originalProjectId = decodeURIComponent(params.id);
      let projectId = originalProjectId;

      // Build candidate keys to try (exact, .pack stripped, sanitized, trimmed)
      const candidates: string[] = [projectId];
      if (/\.pack$/i.test(projectId)) candidates.push(projectId.replace(/\.pack$/i, ''));
      const sanitized = projectId.replace(/[\/\\?#%*:|"<>]/g, '-');
      if (!candidates.includes(sanitized)) candidates.push(sanitized);
      const trimmed = sanitized.replace(/\s+/g, '-').replace(/[()]/g, '');
      if (!candidates.includes(trimmed)) candidates.push(trimmed);

      // Try to find an existing blocks.json among candidates
      let loaded = false;
      let successfulCandidate: string | null = null;

      for (const candidate of candidates) {
        try {
          const data = await readProjectFile(candidate, 'blocks.json');
          console.info('Trying project candidate:', candidate, '->', !!data);
          if (!data) continue;

          // parse and load
          let parsed: Block[];
          try {
            parsed = JSON.parse(data) as Block[];
          } catch (parseErr) {
            console.warn('Failed to parse blocks.json for', candidate, parseErr);
            continue;
          }

          setBlocks(parsed);
          blocksRef.current = parsed;
          rawSubmitCapture(parsed); // initial snapshot

          try {
            handleProjectSelect(candidate);
          } catch (selErr) {
            console.warn('handleProjectSelect failed for', candidate, selErr);
          }

          loaded = true;
          successfulCandidate = candidate;
          break;
        } catch (err) {
          console.warn('Error while reading project candidate', candidate, err);
        }
      }

      if (loaded) return;

      // --- Not loaded from any candidate ---
      // If the requested id exists in the projects index, treat as NEW (empty) project:
      const indexIds = (projectsIndex || []).map((p: any) => p.id);
      if (indexIds.includes(originalProjectId)) {
        // initialize empty project (no error)
        const emptyBlocks: Block[] = [];
        setBlocks(emptyBlocks);
        blocksRef.current = emptyBlocks;
        rawSubmitCapture(emptyBlocks);

        try {
          handleProjectSelect(originalProjectId);
        } catch (selErr) {
          console.warn('handleProjectSelect failed for (init)', originalProjectId, selErr);
        }

        // Persist empty blocks.json so next load finds it
        try {
          void saveProjectFile(originalProjectId, 'blocks.json', JSON.stringify([])).catch((e) =>
            console.warn('saveProjectFile(init empty) failed', e),
          );
        } catch (e) {
          console.warn('saveProjectFile threw synchronously', e);
        }

        return;
      }

      // If requested id is not in index -> show error and navigate back
      toast.error('پروژه یافت نشد یا فایل پروژه نامعتبر است. به صفحه پروژه‌ها بازگردانده می‌شوید.');
      navigate('/', { replace: true });
    })();
    // keep deps explicit
  }, [params?.id, navigate, handleProjectSelect, rawSubmitCapture]);

  const handleGreenFlagClick = useCallback(
    async (blockId: string) => {
      if (!isBluetoothConnected) {
        toast.info('You must connect to a device');
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

  // start dialogue and normalize messages (small helper)
  const normalizeMessagesForSides = (raw: any[]) => {
    return raw.map((m) => {
      const input = (m.charecter || "").trim();
      let name = input;
      let forcedSide: "left" | "right" | undefined = undefined;

      if (input.includes(":")) {
        const [base, suffix] = input.split(":");
        name = base;
        if (suffix === "left" || suffix === "right") forcedSide = suffix;
      } else {
        forcedSide = "left";
      }

      const normalized: any = {
        ...m,
        charecter: name,
        characterInfo: { name, forcedSide },
      };

      return normalized;
    });
  };

  const startDialogueForChapter = useCallback(
    async (chapterKey?: string | null) => {
      try {
        const chapterKeys = Object.keys(elevator);
        if (chapterKeys.length === 0) return;

        let key = chapterKey ?? chapterKeys[0];
        if (!key || !elevator[key]) {
          key = chapterKeys[0];
        }

        const rawMessages: any[] = Array.isArray(elevator[key]) ? elevator[key] : [];
        setCurrentDialogueChapter(key);
        const normalized = normalizeMessagesForSides(rawMessages);
        await dialogue(normalized as any);

        // After dialogue finishes, show tasklist popup if exists for selected project + chapter.
        try {
          const projId = selectedProjectRef.current ?? selectedProject ?? 'آسانسور';
          const chapterKeyForTasklist = key;
          const t = getTaskListForProject(projId, chapterKeyForTasklist);
          if (t && t.tasks && t.tasks.length > 0) {
            setActiveTaskList(t.tasks as TaskItem[]);
            setShowTaskList(true);
          }
        } catch (err) {
          console.warn('failed to load tasklist for project after dialogue', err);
        }
      } catch (err) {
        console.warn("startDialogueForChapter failed", err);
      }
    },
    [dialogue, selectedProject],
  );

  // If navigated with state requesting autoStartDialogue, start it
  useEffect(() => {
    const navState: any = (location && (location as any).state) || null;
    if (navState && navState.autoStartDialogue) {
      const requestedChapter = navState.startChapter ?? null;
      void startDialogueForChapter(requestedChapter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Next-chapter handler (now also advances session & updates project progress)
  const handleNextChapter = useCallback(async () => {
    setShowNextButton(false);

    const keys = Object.keys(elevator);
    if (!keys || keys.length === 0) return;

    const currentKey = currentDialogueChapter ?? keys[0];
    const idx = keys.indexOf(currentKey);
    const nextKey = idx >= 0 && idx + 1 < keys.length ? keys[idx + 1] : null;

    // Advance session step in storage (so when user returns to project selection the step is updated)
    try {
      const projectId = selectedProjectRef.current;
      if (projectId) {
        // advance session step by 1. provide totalChapters for calculating progress
        const totalChapters = keys.length;
        await advanceSessionStep(projectId, totalChapters);

        // reload projects index and update the progress value for UI
        try {
          const projectsIndex: any[] = (await loadProjects()) ?? [];
          const idxP = projectsIndex.findIndex((p) => p && p.id === projectId);
          if (idxP !== -1) {
            // fetch session to compute progress
            const session = await getSession(projectId);
            const step = session?.step ?? 1;
            const progress = Math.min(100, Math.round((step / Math.max(1, totalChapters)) * 100));
            projectsIndex[idxP] = {
              ...projectsIndex[idxP],
              progress,
            };
            await saveProjects(projectsIndex);
          }
        } catch (pe) {
          console.warn('Failed to update projects progress after advancing session', pe);
        }
      }
    } catch (err) {
      console.warn('advanceSessionStep failed', err);
    }

    if (nextKey) {
      await startDialogueForChapter(nextKey);
    } else {
      toast.info("فصل بعدی موجود نیست.");
    }
  }, [currentDialogueChapter, startDialogueForChapter]);

  // UI local state
  const [interactionMode, setInteractionMode] = useState<'runner' | 'deleter'>(reduxInteractionMode ?? 'runner');
  const [bluetoothOpen, setBluetoothOpen] = useState<boolean>(reduxBluetoothOpen ?? false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [blockPaletteBottom, setBlockPaletteBottom] = useState<number>(88);

  useEffect(() => {
    if (reduxInteractionMode && reduxInteractionMode !== interactionMode) {
      setInteractionMode(reduxInteractionMode);
    }
  }, [reduxInteractionMode]);

  useEffect(() => {
    if (typeof reduxBluetoothOpen === "boolean" && reduxBluetoothOpen !== bluetoothOpen) {
      setBluetoothOpen(reduxBluetoothOpen);
    }
  }, [reduxBluetoothOpen]);

  // fab items: include optional title so TypeScript matches usage
  const fabItems: Array<{ key: string; onClick: () => void; content: React.ReactNode; title?: string }> = [
    {
      key: 'bluetooth',
      onClick: () => setBluetoothOpen((p) => !p),
      content: <BluetoothIcon className="w-6 h-6" />,
      title: "بلوتوث"
    },
    {
      key: 'theme',
      onClick: cycleTheme,
      content: theme === 'system' ? <Monitor className="w-6 h-6" /> : theme === 'light' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />,
      title: "حالت شب/روز"
    },
    {
      key: 'selectProject',
      onClick: () => {
        if (!selectVisible) openSelectPopup();
        else closeSelectPopup();
      },
      content: <FolderOpenDot className="w-6 h-6" />,
      title: "پروژه"
    },
    {
      key: 'unit',
      onClick: cycleUnit,
      content: <div className="text-xs font-semibold select-none pointer-events-none">{unitLabel}</div>,
      title: "واحد"
    },
  ];

  const projects = ['آسانسور', 'جرثقیل', 'تله کابین'];
  const LEFT_TOGGLE_LEFT = 6;
  const LEFT_TOGGLE_BOTTOM = blockPaletteBottom;
  const toggleInteraction = () => setInteractionMode((prev) => (prev === 'runner' ? 'deleter' : 'runner'));

  return (
    <SoundContext.Provider value={playSnapSound}>
      <Header initialCollapsed={false} hasPrev={hasPrev} hasNext={hasNext} onPrev={goPrev} onNext={goNext} />

      {/* Emergency Stop: positioned above the left mode selector FAB so it looks integrated */}
      <div
        style={{
          position: 'fixed',
          left: LEFT_TOGGLE_LEFT,
          // place it above the mode FAB (approx offset = 88 px). Adjust if needed.
          bottom: LEFT_TOGGLE_BOTTOM + 80,
          zIndex: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <EmergencyStopButton isConnected={isBluetoothConnected} />
      </div>

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
            w-12 h-16 shadow-lg
            cursor-pointer select-none
            transition-transform duration-200 hover:scale-105 active:scale-95
            bg-white dark:bg-slate-800
            text-gray-700 dark:text-slate-100
            hover:bg-gray-50 dark:hover:bg-slate-700
          `}
          style={{
            borderTopLeftRadius: '30%',
            borderTopRightRadius: '30%',
            borderBottomLeftRadius: '15%',
            borderBottomRightRadius: '15%'
          }}
          title={interactionMode === 'runner' ? 'Switch to delete mode' : 'Switch to run mode'}
        >
          <div className='flex flex-col gap-2 justify-center items-center'>
          {interactionMode === 'runner' ? (
              <>
                <MousePointer2 className="w-5 h-5 mt-2" />
                <span className='text-xs'>اجرا</span></>
          ) : (
              <>
                <Trash2 className="w-5 h-5 mt-2" />
                <span className='text-xs'>حذف</span>
              </>
            )}
            </div>
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
          blockPaletteBottom={blockPaletteBottom}
          setBlockPaletteBottom={setBlockPaletteBottom}
        />

        {/* Confetti overlay (appears when validator passes) */}
        {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}

        {/* Next chapter rounded button (floating) */}
        {showNextButton && (
          <div className="fixed bottom-44 right-4 z-[9999]">
            <button
              onClick={handleNextChapter}
              aria-label="رفتن به فصل بعد"
              className="inline-flex items-center justify-center w-14 h-14 rounded-full shadow-lg text-white"
              style={{ background: "linear-gradient(180deg,#60a5fa,#0384d6)" }}
            >
              <SkipForward size={22} />
            </button>
          </div>
        )}

        {/* Timeline TaskList modal (shown after dialogue ends) */}
        {showTaskList && activeTaskList ? (
          <TimelineTaskList
            visible={showTaskList}
            onClose={() => {
              setShowTaskList(false);
              setActiveTaskList(null);
            }}
            tasks={activeTaskList}
            title={`${selectedProjectRef.current ?? selectedProject ?? ""} — تسک‌های فصل`}
          />
        ) : null}
      </div>
    </SoundContext.Provider>
  );
};

export default App;
