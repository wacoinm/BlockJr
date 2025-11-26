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
import { buildCommandQueue } from './utils/blockExecutor';
import bluetoothService from './utils/bluetoothService';
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
import { useDispatch } from 'react-redux';
import type { RootState } from './store';
import { setCurrentChapter, setMessages } from './store/slices/storySlice';

import { computeHorizStep, GAP_BETWEEN_BLOCKS } from './constants/spacing';

import { saveProjectFile, readProjectFile, loadProjects, saveProjects } from './utils/projectStorage';
import { useParams, useNavigate, useLocation } from 'react-router';

import Confetti from 'react-confetti';
import { useDialogue } from 'dialogue-story';
import { validateBlocksAgainstRuleSets } from './utils/validator';
import { advanceSessionStep, getSession } from './utils/sessionStorage';

/* Timeline tasklist imports */
import TimelineTaskList, { TaskItem } from './components/TimelineTaskList';

/* Emergency stop button (styled FAB) */
import EmergencyStopButton from './components/EmergencyStopButton';

export const SoundContext = createContext<() => void>(() => {});

const FIRST_RUN_KEY = 'blockjr:firstRunDone';
const STORY_STATE_KEY = 'blockjr:storyState';
const STORY_TASKS_KEY = 'blockjr:storyTasks';
const STORY_NEXT_KEY = 'blockjr:storyNext';

/** helper: map Persian project name → story key */
function mapProjectToStoryKey(projectId?: string | null): 'car' | 'crane' | 'catapult' {
  if (!projectId) return 'car';
  if (projectId === 'جرثقیل') return 'crane';
  if (projectId === 'منجنیق') return 'catapult';
  return 'car';
}

/** helper: dynamic import JSON story based on storyKey */
async function loadStoryByKey(
  storyKey: 'car' | 'crane' | 'catapult',
): Promise<Record<string, any[]>> {
  try {
    let mod: any;
    if (storyKey === 'crane') {
      mod = await import('./assets/stories/crane.json');
    } else if (storyKey === 'catapult') {
      mod = await import('./assets/stories/catapult.json');
    } else {
      // car (default)
      mod = await import('./assets/stories/car.json');
    }
    const story = (mod && mod.default) || mod;
    return (story || {}) as Record<string, any[]>;
  } catch (err) {
    console.warn('Failed to load story JSON for key', storyKey, err);
    try {
      const fallbackMod: any = await import('./assets/stories/car.json');
      const fallbackStory = (fallbackMod && fallbackMod.default) || fallbackMod;
      return (fallbackStory || {}) as Record<string, any[]>;
    } catch (fallbackErr) {
      console.warn('Failed to load fallback car.json story', fallbackErr);
      return {};
    }
  }
}

const App: React.FC = () => {
  const dispatch = useDispatch();
  // read UI values from redux; cast to any for properties that may not be typed
  const reduxInteractionMode = useAppSelector((s: RootState) =>
    s.ui ? (s.ui as any).interactionMode : undefined,
  );
  const reduxBluetoothOpen = useAppSelector((s: RootState) =>
    s.ui ? (s.ui as any).bluetoothOpen : undefined,
  );

  // local blocks + history
  const [blocks, setBlocks] = useState<Block[]>([]);
  const blocksRef = useRef<Block[]>(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // capture history hook (we will wrap submitCapture for autosave)
  const {
    submitCapture: rawSubmitCapture,
    goPrev,
    goNext,
    hasPrev,
    hasNext,
  } = useCaptureHistory(blocksRef, setBlocks);

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
  const [currentDialogueChapter, setCurrentDialogueChapter] = useState<string | null>(null);
  const [showNextButton, setShowNextButton] = useState(false);
  const setNextButton = useCallback(
    (flag: boolean, chapter?: string | null) => {
      setShowNextButton(flag);
      try {
        if (typeof window === 'undefined') return;
        if (flag) {
          window.localStorage.setItem(
            STORY_NEXT_KEY,
            JSON.stringify({ chapter: chapter ?? currentDialogueChapter, show: true }),
          );
        } else {
          window.localStorage.removeItem(STORY_NEXT_KEY);
        }
      } catch (err) {
        console.warn('Failed to persist next-button state', err);
      }
    },
    [currentDialogueChapter],
  );

  // derived map for quick lookup
  const blocksMap = useMemo(
    () => new Map<string, Block>(blocks.map((b) => [b.id, b])),
    [blocks],
  );

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

  // Dialogue + validation UI state
  const { dialogue } = useDialogue();
  const location = useLocation();
  const [showConfetti, setShowConfetti] = useState(false);
  const [activeValidator, setActiveValidator] = useState<{
    id?: string | null;
    states: string[][];
    blockTypes?: string[] | null;
    taskId?: string | null;
  } | null>(null);
  const [chapterMessages, setChapterMessages] = useState<any[]>([]);
  const [lastDialogueBatch, setLastDialogueBatch] = useState<any[] | null>(null);
  const [messageCursor, setMessageCursor] = useState<number>(0);
  const [blockingItem, setBlockingItem] = useState<any | null>(null);
  const [pendingResumeAfterValidation, setPendingResumeAfterValidation] =
    useState<boolean>(false);

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

      try {
        if (currentDialogueChapter && activeValidator && activeValidator.states?.length) {
          const ok =
            validateBlocksAgainstRuleSets(snapshot ?? blocksRef.current, {
              states: activeValidator.states,
              blockTypes: activeValidator.blockTypes ?? undefined,
            }) ?? false;

          if (ok && !showNextButton) {
            setShowConfetti(true);
            setNextButton(true, currentDialogueChapter);
            setTimeout(() => setShowConfetti(false), 3500);
            setPendingResumeAfterValidation(true);
          }
        }
      } catch (e) {
        console.warn('validator check failed', e);
      }
    },
    [rawSubmitCapture, showNextButton, currentDialogueChapter, activeValidator, setNextButton],
  );

  // block updates & normalization
  const applyUpdatesAndNormalize = useCallback(
    (updates: Map<string, Partial<Block>>, capture = true) => {
      setBlocks((prev) => {
        let merged = prev.map((b) =>
          updates.has(b.id) ? { ...b, ...updates.get(b.id)! } : { ...b },
        );

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
  } = useProjects('ماشین');

  useEffect(() => {
    selectedProjectRef.current = selectedProject ?? null;
  }, [selectedProject]);

  const createTaskFromMessage = useCallback(
    (m: any, idx: number): TaskItem | null => {
      if (!m || m.type === 'dialogue') return null;

      const deriveTaskType = (meta: any): TaskItem['type'] => {
        const t = (meta?.taskType ?? '').toString().toLowerCase();
        if (t.includes('video')) return 'video';
        if (t.includes('image')) return 'image';
        if (t.includes('mission') || t.includes('challenge') || t.includes('task')) return 'task';
        return meta?.mediaUrl ? 'image' : 'text';
      };

      const blockingMeta = m.meta ?? {};
      return {
        id: blockingMeta.id ?? `task-${idx}`,
        title:
          blockingMeta.title ??
          blockingMeta.mediaText ??
          (m.type === 'validator' ? 'اعتبارسنجی بلوک‌ها' : 'تسک'),
        description:
          blockingMeta.description ??
          blockingMeta.shortDescription ??
          blockingMeta.notes ??
          undefined,
        mediaUrl: blockingMeta.mediaUrl ?? undefined,
        mediaText: blockingMeta.mediaText ?? undefined,
        locked: typeof blockingMeta.locked === 'boolean' ? blockingMeta.locked : false,
        type: m.type === 'validator' ? 'validator' : deriveTaskType(blockingMeta),
      };
    },
    [],
  );

  const persistActiveTasks = useCallback(
    (tasks: TaskItem[]) => {
      try {
        if (typeof window === 'undefined') return;
        if (!tasks || tasks.length === 0) return;
        window.localStorage.setItem(
          STORY_TASKS_KEY,
          JSON.stringify({ chapter: currentDialogueChapter, tasks }),
        );
      } catch (err) {
        console.warn('persistActiveTasks failed', err);
      }
    },
    [currentDialogueChapter],
  );

  const playUntilBlocking = useCallback(
    async (msgs: any[], startIdx: number) => {
      let idx = startIdx;
      while (idx < msgs.length) {
        const m = msgs[idx];
        if (m && m.type && m.type !== 'dialogue') {
          setNextButton(false);
          setShowConfetti(false);
          setMessageCursor(idx);
          setBlockingItem(m);
          if (m.type === 'validator' && m.meta && Array.isArray(m.meta.states)) {
            const states = (m.meta.states as any[]).filter((s) => Array.isArray(s)) as string[][];
            setActiveValidator({
              id: m.meta.id ?? m.meta.taskId ?? null,
              states,
              blockTypes: Array.isArray(m.meta.blockTypes) ? m.meta.blockTypes : null,
              taskId: m.meta.taskId ?? null,
            });
          } else {
            setActiveValidator(null);
          }

          const blockingMeta = m.meta ?? {};
          const asTask = createTaskFromMessage({ ...m, meta: blockingMeta }, idx);
          const combinedTasks = asTask ? [asTask] : [];
          setActiveTaskList(combinedTasks);
          persistActiveTasks(combinedTasks);
          setShowTaskList(true);
          return;
        }

        // collect dialogue run
        const dialogBatch: any[] = [];
        while (idx < msgs.length) {
          const d = msgs[idx];
          if (d && d.type && d.type !== 'dialogue') break;
          dialogBatch.push(d);
          idx += 1;
        }
        if (dialogBatch.length > 0) {
          setLastDialogueBatch(dialogBatch);
          await dialogue(dialogBatch as any);
        }
      }

      // reached end of chapter without blocking
      setBlockingItem(null);
      setActiveValidator(null);
      setShowTaskList(false);
      setNextButton(true);
      setPendingResumeAfterValidation(false);
    },
    [dialogue, persistActiveTasks, createTaskFromMessage, setNextButton, setLastDialogueBatch],
  );

  const normalizeMessagesForSides = (raw: any[]) => {
    return raw.map((m) => {
      const input = (m.charecter || '').trim();
      let name = input;
      let forcedSide: 'left' | 'right' | undefined = undefined;

      if (input.includes(':')) {
        const [base, suffix] = input.split(':');
        name = base;
        if (suffix === 'left' || suffix === 'right') forcedSide = suffix;
      } else {
        forcedSide = 'left';
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
        const projectId = selectedProjectRef.current ?? selectedProject ?? 'ماشین';
        const storyKey = mapProjectToStoryKey(projectId);
        const story = await loadStoryByKey(storyKey);

        const chapterKeys = Object.keys(story);
        if (chapterKeys.length === 0) return;

        let key = chapterKey ?? chapterKeys[0];
        if (!key || !story[key]) {
          key = chapterKeys[0];
        }

        const rawMessages: any[] = Array.isArray(story[key]) ? story[key] : [];
        setNextButton(false);
        setShowConfetti(false);

        const chapterValidatorEntry = rawMessages.find(
          (m) =>
            m &&
            m.type === 'validator' &&
            m.meta &&
            Array.isArray(m.meta.states) &&
            m.meta.states.length > 0,
        );
        if (chapterValidatorEntry) {
          const states = (chapterValidatorEntry.meta.states as any[]).filter((s) =>
            Array.isArray(s),
          ) as string[][];
          setActiveValidator({
            id: chapterValidatorEntry.meta.id ?? chapterValidatorEntry.meta.taskId ?? null,
            states,
            blockTypes: Array.isArray(chapterValidatorEntry.meta.blockTypes)
              ? chapterValidatorEntry.meta.blockTypes
              : null,
            taskId: chapterValidatorEntry.meta.taskId ?? null,
          });
        } else {
          setActiveValidator(null);
        }

        setCurrentDialogueChapter(key);
        const normalized = normalizeMessagesForSides(rawMessages);
        setChapterMessages(normalized);
        setLastDialogueBatch(null);
        setMessageCursor(0);
        setBlockingItem(null);
        setPendingResumeAfterValidation(false);

        // Save to redux store
        dispatch(setCurrentChapter(key));
        dispatch(setMessages({ chapter: key, messages: normalized }));

        // Persist last chapter/messages so replay buttons stay enabled after refresh
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              STORY_STATE_KEY,
              JSON.stringify({ chapter: key, messages: normalized }),
            );
          }
        } catch (err) {
          console.warn('Failed to persist story state', err);
        }

        await playUntilBlocking(normalized, 0);
      } catch (err) {
        console.warn('startDialogueForChapter failed', err);
      }
    },
    [selectedProject, dispatch, playUntilBlocking, setNextButton],
  );

  const { theme, cycleTheme } = useTheme('system');

  // Rehydrate last chapter/messages so replay/task buttons are enabled after refresh
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = window.localStorage.getItem(STORY_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const chapterFromStorage = parsed?.chapter;
      const messagesFromStorage = parsed?.messages;
      if (!chapterFromStorage || !Array.isArray(messagesFromStorage) || messagesFromStorage.length === 0)
        return;

      setCurrentDialogueChapter((prev) => prev ?? chapterFromStorage);
      setChapterMessages((prev) => (prev && prev.length > 0 ? prev : messagesFromStorage));
      setMessageCursor(0);
      setBlockingItem(null);
      setPendingResumeAfterValidation(false);

      dispatch(setCurrentChapter(chapterFromStorage));
      dispatch(setMessages({ chapter: chapterFromStorage, messages: messagesFromStorage }));

      try {
        const rawNext = window.localStorage.getItem(STORY_NEXT_KEY);
        if (rawNext) {
          const parsedNext = JSON.parse(rawNext);
          if (parsedNext?.chapter === chapterFromStorage && parsedNext?.show) {
            setNextButton(true, chapterFromStorage);
          } else {
            setNextButton(false);
          }
        }
      } catch (err) {
        console.warn('Failed to rehydrate next-button state', err);
        setNextButton(false);
      }

      try {
        const rawTasks = window.localStorage.getItem(STORY_TASKS_KEY);
        if (rawTasks) {
          const parsedTasks = JSON.parse(rawTasks);
          if (parsedTasks?.chapter === chapterFromStorage && Array.isArray(parsedTasks?.tasks)) {
            setActiveTaskList(parsedTasks.tasks);
          }
        }
      } catch (err) {
        console.warn('Failed to rehydrate story tasks', err);
      }
    } catch (err) {
      console.warn('Failed to rehydrate story state', err);
    }
  }, [dispatch, setNextButton]);

  const handleReplayTasks = useCallback(() => {
    let tasksToShow = activeTaskList;
    const buildTaskFromMessage = (msg: any, idx: number) =>
      createTaskFromMessage(msg, idx);

    if ((!tasksToShow || tasksToShow.length === 0) && blockingItem) {
      const built = buildTaskFromMessage(blockingItem, messageCursor);
      tasksToShow = built ? [built] : tasksToShow;
    }

    if (!tasksToShow || tasksToShow.length === 0) {
      try {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem(STORY_TASKS_KEY);
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.chapter === currentDialogueChapter && Array.isArray(parsed?.tasks)) {
            tasksToShow = parsed.tasks;
          }
        }
      } catch (err) {
        console.warn('handleReplayTasks rehydrate failed', err);
      }
    }

    if ((!tasksToShow || tasksToShow.length === 0) && chapterMessages && chapterMessages.length > 0) {
      const clampedCursor = Math.min(
        Math.max(messageCursor ?? 0, 0),
        chapterMessages.length - 1,
      );
      const fromCursor = buildTaskFromMessage(chapterMessages[clampedCursor], clampedCursor);
      if (fromCursor) {
        tasksToShow = [fromCursor];
      } else {
        for (let i = clampedCursor; i >= 0; i -= 1) {
          const candidate = chapterMessages[i];
          if (candidate && candidate.type && candidate.type !== 'dialogue') {
            const built = buildTaskFromMessage(candidate, i);
            if (built) {
              tasksToShow = [built];
              break;
            }
          }
        }
      }
    }

    if (tasksToShow && tasksToShow.length > 0) {
      setActiveTaskList(tasksToShow);
      setShowTaskList(true);
      persistActiveTasks(tasksToShow);
    }
  }, [
    activeTaskList,
    blockingItem,
    chapterMessages,
    currentDialogueChapter,
    messageCursor,
    persistActiveTasks,
    createTaskFromMessage,
  ]);

  const handleReplayDialogue = useCallback(async () => {
    try {
      if (lastDialogueBatch && lastDialogueBatch.length > 0) {
        await dialogue(lastDialogueBatch as any);
        return;
      }

      if (chapterMessages && chapterMessages.length > 0) {
        const dialoguesOnly = chapterMessages.filter((m) => m && (!m.type || m.type === 'dialogue'));
        if (dialoguesOnly.length > 0) {
          await dialogue(dialoguesOnly as any);
        }
      }
    } catch (err) {
      console.warn('handleReplayDialogue failed', err);
    }
  }, [dialogue, lastDialogueBatch, chapterMessages]);

  // If route param present, load that project's blocks and select it
  const params = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      // 1) Load projects index first
      let projectsIndex: any = [];
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

          // First-run: if this is the very first app run ever (localStorage), start the dialogue & tasklist
          try {
            if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
              const already = window.localStorage.getItem(FIRST_RUN_KEY);
              if (!already) {
                window.localStorage.setItem(FIRST_RUN_KEY, '1');
                // start default chapter (fire and forget)
                void startDialogueForChapter(null);
              }
            }
          } catch (err) {
            console.warn('failed to check/set localStorage first-run flag', err);
          }

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

        // First-run: if this is the very first app run ever (localStorage), start the dialogue & tasklist
        try {
          if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
            const already = window.localStorage.getItem(FIRST_RUN_KEY);
            if (!already) {
              window.localStorage.setItem(FIRST_RUN_KEY, '1');
              void startDialogueForChapter(null);
            }
          }
        } catch (err) {
          console.warn('failed to check/set localStorage first-run flag (init empty)', err);
        }

        return;
      }

      // If requested id is not in index -> show error and navigate back
      toast.error(
        'پروژه یافت نشد یا فایل پروژه نامعتبر است. به صفحه پروژه‌ها بازگردانده می‌شوید.',
      );
      navigate('/', { replace: true });
    })();
    // keep deps explicit
  }, [params?.id, navigate, handleProjectSelect, rawSubmitCapture, startDialogueForChapter]);

  // ---------- execution UI state ----------
  const [isExecuting, setIsExecuting] = useState(false);
  // set of block ids currently muted (grayscaled). We store as Set for quick lookup.
  const [mutedBlockIds, setMutedBlockIds] = useState<Set<string>>(new Set());
  // ref to current execution queue (array of { id, cmd })
  const executingQueueRef = useRef<{ id: string; cmd: string }[] | null>(null);
  const executingAbortRef = useRef<{ aborted: boolean }>({ aborted: false });

  // MAIN execution routine: execute chain step-by-step, waiting OK between sends
  const executeChain = useCallback(
    async (flagBlockId: string) => {
      if (isExecuting) {
        toast.info('فرایند قبل در حال اجراست...');
        return;
      }

      const flag = blocksMap.get(flagBlockId);
      if (!flag) return;
      if (!flag.childId) return;

      const chain = getChain(flag.childId);
      if (!chain || chain.length === 0) return;

      // Build the queue from the chain: each entry maps to the block id that produced the command
      const queue = buildCommandQueue(chain, unitValue);
      if (!queue || queue.length === 0) {
        toast.info('هیچ فرمانی برای اجرا وجود ندارد.');
        return;
      }

      // initial muted set: all unique ids in the queue
      const initialMuted = new Set<string>(queue.map((q) => q.id));
      setMutedBlockIds(new Set(initialMuted));
      executingQueueRef.current = queue;
      executingAbortRef.current = { aborted: false };
      setIsExecuting(true);

      try {
        // ensure we are connected
        const connected = await bluetoothService.isConnected();
        if (!connected) {
          toast.info('You must connect to a device');
          setIsExecuting(false);
          setMutedBlockIds(new Set());
          executingQueueRef.current = null;
          return;
        }

        // Iterate queue: send and wait for OK for each cmd
        for (let idx = 0; idx < queue.length; idx += 1) {
          const item = queue[idx];
          if (!item) continue;
          if (executingAbortRef.current.aborted) {
            throw new Error('aborted');
          }

          // send the command
          try {
            console.debug('[App] sending:', item.cmd);
            await bluetoothService.sendString(item.cmd);
          } catch (sendErr) {
            console.error('Failed to send command:', sendErr);
            toast.error('خطا هنگام ارسال فرمان بلوتوث.');
            throw sendErr;
          }

          // Wait for OK (with timeout). We listen with a dedicated subscriber for OK and resolve when OK received.
          try {
            await new Promise<void>(async (resolve, reject) => {
              let timeoutId: number | null = null;
              let unsub: (() => void) | null = null;
              try {
                unsub = await bluetoothService.onOK(() => {
                  if (timeoutId) window.clearTimeout(timeoutId);
                  resolve();
                });
              } catch (err) {
                console.warn('onOK subscribe failed', err);
                reject(err);
                return;
              }

              // Timeout fallback (8s)
              timeoutId = window.setTimeout(() => {
                try {
                  if (unsub) unsub();
                } catch {}
                reject(new Error('OK timeout'));
              }, 8000);
            });
          } catch (okErr) {
            console.error('OK wait failed:', okErr);
            toast.error('پاسخ OK از دستگاه دریافت نشد. اجرای زنجیره متوقف شد.');
            throw okErr;
          }

          // On OK -> remove this block id from muted set (restore UI)
          setMutedBlockIds((prev) => {
            const next = new Set<string>(prev);
            next.delete(item.id);
            return next;
          });
        }

        // finished successfully
        toast.success('زنجیره اجرا شد.');
      } catch (e) {
        console.warn('Execution aborted/failed', e);
      } finally {
        // cleanup
        setIsExecuting(false);
        setMutedBlockIds(new Set());
        executingQueueRef.current = null;
        executingAbortRef.current = { aborted: false };
      }
    },
    [isExecuting, blocksMap, getChain, unitValue],
  );

  // cancel running execution (if any)
  const cancelExecution = useCallback(() => {
    if (!isExecuting) return;
    executingAbortRef.current.aborted = true;
    setIsExecuting(false);
    setMutedBlockIds(new Set());
    executingQueueRef.current = null;
    toast.info('Execution cancelled.');
  }, [isExecuting]);

  // ---------- handlers ----------
  const handleGreenFlagClick = useCallback(
    async (blockId: string) => {
      await executeChain(blockId);
    },
    [executeChain],
  );

  const handleDelayChange = useCallback(
    (blockId: string, value: number) => {
      setBlocks((prev) =>
        prev.map((block) => (block.id === blockId ? { ...block, value } : block)),
      );
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
    [blocks, blocksMap, getChain, playSnapSound, submitCapture],
  );

  // If navigated with state requesting autoStartDialogue, start it
  useEffect(() => {
    const navState: any = (location && (location as any).state) || null;
    if (
      navState &&
      navState.autoStartDialogue &&
      !window.localStorage.getItem(FIRST_RUN_KEY)
    ) {
      const requestedChapter = navState.startChapter ?? null;
      void startDialogueForChapter(requestedChapter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Next handler: resume story after blocking or advance chapter if end reached
  const handleNextChapter = useCallback(async () => {
    setNextButton(false);
    setShowConfetti(false);

    if (blockingItem) {
      const nextIdx = messageCursor + 1;
      setShowTaskList(false);
      setActiveTaskList(null);
      setBlockingItem(null);
      setActiveValidator(null);
      setPendingResumeAfterValidation(false);
      await playUntilBlocking(chapterMessages, nextIdx);
      return;
    }

    const projectId = selectedProjectRef.current ?? selectedProject ?? 'ماشین';
    const storyKey = mapProjectToStoryKey(projectId);
    const story = await loadStoryByKey(storyKey);
    const keys = Object.keys(story);
    if (!keys || keys.length === 0) return;

    const currentKey = currentDialogueChapter ?? keys[0];
    const idx = keys.indexOf(currentKey);
    const nextKey = idx >= 0 && idx + 1 < keys.length ? keys[idx + 1] : null;

    // Advance session step in storage (so when user returns to project selection the step is updated)
    try {
      if (projectId) {
        const totalChapters = keys.length;
        await advanceSessionStep(projectId, totalChapters);

        // reload projects index and update the progress value for UI
        try {
          const projectsIndex: any[] = (await loadProjects()) ?? [];
          const idxP = projectsIndex.findIndex((p) => p && p.id === projectId);
          if (idxP !== -1) {
            const session = await getSession(projectId);
            const step = session?.step ?? 1;
            const progress = Math.min(
              100,
              Math.round((step / Math.max(1, totalChapters)) * 100),
            );
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
      toast.info('فصل بعدی موجود نیست.');
    }
  }, [
    blockingItem,
    messageCursor,
    playUntilBlocking,
    chapterMessages,
    currentDialogueChapter,
    startDialogueForChapter,
    setNextButton,
    selectedProject,
  ]);

  const handleTaskComplete = useCallback(() => {
    setShowTaskList(false);
    setActiveTaskList(null);
    if (blockingItem && blockingItem.type !== 'validator') {
      setShowConfetti(true);
      setNextButton(true);
      setTimeout(() => setShowConfetti(false), 2500);
    }
  }, [blockingItem, setNextButton]);

  // UI local state
  const [interactionMode, setInteractionMode] = useState<'runner' | 'deleter'>(
    reduxInteractionMode ?? 'runner',
  );
  const [bluetoothOpen, setBluetoothOpen] = useState<boolean>(
    reduxBluetoothOpen ?? false,
  );
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [blockPaletteBottom, setBlockPaletteBottom] = useState<number>(88);

  useEffect(() => {
    if (reduxInteractionMode && reduxInteractionMode !== interactionMode) {
      setInteractionMode(reduxInteractionMode);
    }
  }, [reduxInteractionMode, interactionMode]);

  useEffect(() => {
    if (typeof reduxBluetoothOpen === 'boolean' && reduxBluetoothOpen !== bluetoothOpen) {
      setBluetoothOpen(reduxBluetoothOpen);
    }
  }, [reduxBluetoothOpen, bluetoothOpen]);

  // fab items: include optional title so TypeScript matches usage
  const fabItems: Array<{
    key: string;
    onClick: () => void;
    content: React.ReactNode;
    title?: string;
  }> = [
    {
      key: 'bluetooth',
      onClick: () => setBluetoothOpen((p) => !p),
      content: <BluetoothIcon className="w-6 h-6" />,
      title: 'بلوتوث',
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
      title: 'حالت شب/روز',
    },
    // {
    //   key: 'selectProject',
    //   onClick: () => {
    //     if (!selectVisible) openSelectPopup();
    //     else closeSelectPopup();
    //   },
    //   content: <FolderOpenDot className="w-6 h-6" />,
    //   title: 'پروژه',
    // },
    {
      key: 'unit',
      onClick: cycleUnit,
      content: (
        <div className="text-xs font-semibold select-none pointer-events-none">
          {unitLabel}
        </div>
      ),
      title: 'واحد',
    },
  ];

  const projects = ['ماشین', 'جرثقیل', 'منجنیق'];
  const LEFT_TOGGLE_LEFT = 6;
  const LEFT_TOGGLE_BOTTOM = blockPaletteBottom;
  const toggleInteraction = () =>
    setInteractionMode((prev) => (prev === 'runner' ? 'deleter' : 'runner'));

  return (
    <SoundContext.Provider value={playSnapSound}>
      <Header
        initialCollapsed={false}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={goPrev}
        onNext={goNext}
      />

      {/* Emergency Stop: positioned above the left mode selector FAB so it looks integrated */}
      <div
        style={{
          position: 'fixed',
          left: LEFT_TOGGLE_LEFT,
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
            borderBottomRightRadius: '15%',
          }}
          title={
            interactionMode === 'runner'
              ? 'Switch to delete mode'
              : 'Switch to run mode'
          }
        >
          <div className="flex flex-col gap-2 justify-center items-center">
            {interactionMode === 'runner' ? (
              <>
                <MousePointer2 className="w-5 h-5 mt-2" />
                <span className="text-xs">اجرا</span>
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5 mt-2" />
                <span className="text-xs">حذف</span>
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
          setShowTaskList={setShowTaskList}
          setActiveTaskList={setActiveTaskList}
          onReplayDialogue={handleReplayDialogue}
          onReplayTasks={handleReplayTasks}
          mutedBlockIds={mutedBlockIds}
        />

        {/* Confetti overlay (appears when validator passes) */}
        {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}

        {/* Next chapter rounded button (floating) */}
        {showNextButton && (
          <div className="fixed bottom-[40vh] right-4 z-[40]">
            <button
              onClick={handleNextChapter}
              aria-label="رفتن به فصل بعد"
              className="inline-flex items-center justify-center w-14 h-14 rounded-full shadow-lg text-white"
              style={{ background: 'linear-gradient(180deg,#60a5fa,#0384d6)' }}
            >
              <SkipForward size={22} />
            </button>
          </div>
        )}

        {/* Timeline TaskList modal (shown after dialogue ends) */}
        {showTaskList && activeTaskList ? (
          <TimelineTaskList
            visible={showTaskList}
            onClose={handleTaskComplete}
            tasks={activeTaskList}
            title={`${selectedProjectRef.current ?? selectedProject ?? ''} — تسک‌های فصل`}
          />
        ) : null}
      </div>
    </SoundContext.Provider>
  );
};

export default App;
