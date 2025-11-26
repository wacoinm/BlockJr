// src/components/project-selection/ProjectActionSheet.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { Play } from "lucide-react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

import { useNavigate } from "react-router";
import { saveProjectFile, readProjectFile, loadProjects, saveProjects } from "../../utils/projectStorage";
import { initSession, getSession } from "../../utils/sessionStorage";
import { getAllStories } from "../../utils/manifest";

type Checkpoint = { id: string; title?: string; locked?: boolean; description?: string };
type Project = {
  id: string;
  name: string;
  subtitle?: string;
  imgsPath?: string;
  progress?: number;
  checkpoints?: Checkpoint[];
  project?: any;
};

type Props = {
  project: Project;
  onClose: () => void;
};

const ANIM_MS = 320;
const SWIPE_CLOSE_THRESHOLD = 80; // px to trigger close on swipe

// helper to check if an image exists (using Image onload/onerror)
function checkImageExists(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const onLoad = () => {
      if (done) return;
      done = true;
      resolve(true);
    };
    const onErr = () => {
      if (done) return;
      done = true;
      resolve(false);
    };
    img.onload = onLoad;
    img.onerror = onErr;
    img.src = url;
    setTimeout(() => {
      if (!done) {
        done = true;
        resolve(false);
      }
    }, 2500);
  });
}

/** small slugify helper — keeps filenames safe and ascii-friendly */
function slugify(s?: string | null) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\-_]+/gi, "-")
    .replace(/_{2,}/g, "-")
    .replace(/\-+/g, "-")
    .replace(/(^\-|\-$)/g, "");
}

/** normalize a manifest storyModule path into a relative import path from this file */
function candidateFromStoryModule(storyModule?: string) {
  if (!storyModule) return null;
  let sm = storyModule;
  if (sm.startsWith("src/")) sm = sm.slice(4);
  if (sm.startsWith("/")) sm = sm.slice(1);
  const base = `../../${sm}`;
  const withoutIndex = base.replace(/\/index\.(ts|js)x?$/i, "");
  return { base, withoutIndex };
}

const ProjectActionSheet: React.FC<Props> = ({ project, onClose }) => {
  // derive checkpoints base (source, unlocked)
  const derivedCheckpointsBase = useMemo<Checkpoint[]>(() => {
    if (Array.isArray(project.checkpoints) && project.checkpoints.length > 0) {
      return project.checkpoints.map((c) => ({ ...c, locked: !!c.locked }));
    }
    if (project.project && typeof project.project === "object") {
      const keys = Object.keys(project.project);
      return keys.map((k) => ({ id: k, title: k, locked: false }));
    }
    return [];
  }, [project]);

  // sourceCheckpointsRef holds the canonical source (unlocked) list — import fallback/manifest will overwrite this
  const sourceCheckpointsRef = useRef<Checkpoint[]>(derivedCheckpointsBase);
  // sessionStepRef holds the latest numeric step used for locking
  const sessionStepRef = useRef<number | null>(null);

  // derivedCheckpoints is what we render (locked applied)
  const [derivedCheckpoints, setDerivedCheckpoints] = useState<Checkpoint[]>(() => {
    return derivedCheckpointsBase.map((c) => ({ ...c }));
  });

  // when base changes, update source ref and recompute derived
  useEffect(() => {
    sourceCheckpointsRef.current = derivedCheckpointsBase.slice();
    // recompute using current sessionStepRef (or fallback 1)
    const stepNow = sessionStepRef.current ?? 1;
    recomputeDerivedCheckpoints(stepNow);
  }, [derivedCheckpointsBase]);

  // ---------- helpers to coerce/parse numbers and apply locks ----------
  const toFiniteInt = (v: any, fallback: number) => {
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return fallback;
      const n = Number(t);
      if (Number.isFinite(n)) return Math.trunc(n);
      try {
        const parsed = JSON.parse(t);
        if (typeof parsed === "number" && Number.isFinite(parsed)) return Math.trunc(parsed);
      } catch {}
      return fallback;
    }
    return fallback;
  };

  const recomputeDerivedCheckpoints = (stepNum: number) => {
    // stepNum expected 1-based. clamp and apply
    const src = sourceCheckpointsRef.current ?? [];
    let s = typeof stepNum === "number" && Number.isFinite(stepNum) ? Math.trunc(stepNum) : 1;
    if (s <= 0) s = 1;
    if (src.length > 0) {
      s = Math.min(Math.max(1, s), src.length);
    }
    const out = src.map((c, i) => ({ ...c, locked: (i + 1) > s }));
    setDerivedCheckpoints(out);
  };

  // ---------- fallback: try multiple import candidates + manifest storyModule if we don't have checkpoints yet ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // if base already has checkpoints, we still may want to keep them; but if it's empty try import
        if ((derivedCheckpointsBase ?? []).length > 0) return;
        if (!project?.id) return;

        const candidates = new Set<string>();
        candidates.add(String(project.id));
        if (project.name) candidates.add(slugify(project.name));
        candidates.add(slugify(project.id));
        const asciiId = String(project.id || "").replace(/[^\x00-\x7F]/g, "");
        if (asciiId) candidates.add(slugify(asciiId));

        try {
          const stories = getAllStories() || [];
          for (const s of stories) {
            if (!s) continue;
            const pid = String(s.projectId || "");
            const normalizedPid = slugify(pid);
            if (normalizedPid && (normalizedPid === slugify(project.id) || normalizedPid === slugify(project.name))) {
              const candPaths = candidateFromStoryModule(s.storyModule);
              if (candPaths) {
                if (candPaths.base) candidates.add(candPaths.base.replace(/^src\//, "").replace(/^\/+/, ""));
                if (candPaths.withoutIndex) candidates.add(candPaths.withoutIndex.replace(/^src\//, "").replace(/^\/+/, ""));
              }
            }
            if (s.storyModule) {
              const candPaths = candidateFromStoryModule(s.storyModule);
              if (candPaths) {
                candidates.add(candPaths.base.replace(/^src\//, "").replace(/^\/+/, ""));
                candidates.add(candPaths.withoutIndex.replace(/^src\//, "").replace(/^\/+/, ""));
              }
            }
          }
        } catch {
          // ignore manifest read errors
        }

        for (const rawCand of Array.from(candidates)) {
          const cand = String(rawCand).replace(/^\/+/, "");
          if (!cand) continue;

          type StoryKey = 'car' | 'ماشین' | 'elevator' | 'tele-elev-crane';
          interface StoryModule { car?: Record<string, unknown>; [key: string]: Record<string, unknown> | undefined; }
          const importMap: Record<StoryKey, () => Promise<StoryModule>> = {
          };

          if (importMap[cand as StoryKey]) {
            try {
              const mod = await importMap[cand as StoryKey]();
              if (mod) {
                const storyObj = mod[project.id] ?? mod.default ?? mod[slugify(project.id)] ?? mod.car ?? mod;
                if (storyObj && typeof storyObj === "object") {
                  const keys = Object.keys(storyObj);
                  if (keys.length > 0) {
                    const cp = keys.map((k) => ({ id: k, title: k, locked: false })) as Checkpoint[];
                    if (!mounted) return;
                    // update canonical source AND recompute locks immediately
                    sourceCheckpointsRef.current = cp;
                    const stepNow = sessionStepRef.current ?? 1;
                    recomputeDerivedCheckpoints(stepNow);
                    return;
                  }
                }
              }
            } catch {
              // continue
            }
          }

          const tryPaths = [
            `../../assets/stories/${cand}.ts`,
            `../../assets/stories/car.ts`
          ];
          for (const p of tryPaths) {
            try {
              const mod = await import(/* @vite-ignore */ p).catch(() => null);
              if (mod) {
                const storyObj = mod[project.id] ?? mod.default ?? mod[slugify(project.id)] ?? mod;
                if (storyObj && typeof storyObj === "object") {
                  const keys = Object.keys(storyObj);
                  if (keys.length > 0) {
                    const cp = keys.map((k) => ({ id: k, title: k, locked: false })) as Checkpoint[];
                    if (!mounted) return;
                    sourceCheckpointsRef.current = cp;
                    const stepNow = sessionStepRef.current ?? 1;
                    recomputeDerivedCheckpoints(stepNow);
                    return;
                  }
                }
              }
            } catch {
              // continue
            }
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, derivedCheckpointsBase]);

  // overlay session progress/step for UI (robust) — centralized: when session read, update sessionStepRef and recompute from sourceCheckpointsRef
  const [sessionProgress, setSessionProgress] = useState<number | undefined>(project.progress ?? 0);
  const [sessionStep, setSessionStep] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!project?.id) return;
        let s: any = null;
        try {
          s = await getSession(project.id);
        } catch (err) {
          // getSession may throw in prod — we'll fallback to scanning localStorage if needed
          s = null;
        }

        // fallback: try to read a likely localStorage key if getSession returned nothing
        if (!s && typeof window !== "undefined" && window.localStorage) {
          const keysToTry = [
            `bj_session_${project.id}`,
            `session_${project.id}`,
            `bj_projects/${project.id}/session`,
            `bj_projects/${project.id}`,
            `session-${project.id}`,
            `session:${project.id}`
          ];
          for (const k of keysToTry) {
            try {
              const v = window.localStorage.getItem(k);
              if (!v) continue;
              try {
                s = JSON.parse(v);
              } catch {
                s = v; // raw
              }
              if (s) break;
            } catch { /* ignore */ }
          }
        }

        // now coerce numbers safely
        const defaultStep = 1;
        const parsedStep = s && (s.step ?? s.currentStep ?? s.index) !== undefined ? toFiniteInt(s.step ?? s.currentStep ?? s.index, defaultStep) : undefined;
        const parsedProgress = s && (s.progress ?? s.percent) !== undefined ? toFiniteInt(s.progress ?? s.percent, project.progress ?? 0) : undefined;

        // determine final stepNum (1-based), clamp later
        const stepNumRaw = parsedStep ?? defaultStep;
        // clamp to sensible range (1..N)
        let stepNum = typeof stepNumRaw === "number" && Number.isFinite(stepNumRaw) ? Math.trunc(stepNumRaw) : defaultStep;
        if (stepNum <= 0) stepNum = 1;
        const srcLen = sourceCheckpointsRef.current.length;
        if (srcLen > 0) {
          stepNum = Math.min(Math.max(1, stepNum), srcLen);
        }

        if (!mounted) return;
        sessionStepRef.current = stepNum;
        setSessionStep(stepNum);
        setSessionProgress(parsedProgress ?? project.progress ?? 0);

        // recompute derived checkpoints from canonical source using the computed stepNum
        recomputeDerivedCheckpoints(stepNum);
      } catch (err) {
        console.warn("ProjectActionSheet: failed to read session", err);
        // fallback: keep defaults
        sessionStepRef.current = 1;
        setSessionStep(null);
        setSessionProgress(project.progress ?? 0);
        recomputeDerivedCheckpoints(1);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project.progress]);

  // checkpoints used for rendering
  const checkpoints = derivedCheckpoints;

  // current selected checkpoint — pick last unlocked (most recent) or first
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    const lastUnlocked = [...checkpoints].reverse().find((c) => !c.locked);
    setCurrent(lastUnlocked?.id ?? checkpoints[0]?.id ?? null);
  }, [checkpoints, project]); // eslint-disable-line

  // rest of UI state & touch handlers (unchanged)
  const [isVisible, setIsVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const startYRef = useRef<number | null>(null);
  const lastTranslateRef = useRef(0);
  const dragAllowedRef = useRef(true);
  const startedInScrollRef = useRef(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const closeWithAnimation = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), ANIM_MS + 20);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    lastTranslateRef.current = 0;
    const target = e.target as Node;
    startedInScrollRef.current = !!(scrollRef.current && scrollRef.current.contains(target));
    if (startedInScrollRef.current && scrollRef.current) {
      dragAllowedRef.current = scrollRef.current.scrollTop === 0;
    } else {
      dragAllowedRef.current = true;
    }
    if (sheetRef.current) sheetRef.current.style.transition = "";
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    if (!dragAllowedRef.current) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy < 0) return;
    lastTranslateRef.current = dy;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
      sheetRef.current.style.boxShadow = `0 8px 30px rgba(2,6,23,${Math.max(0.06, 0.18 - dy / 800)})`;
    }
  };

  const onTouchEnd = () => {
    const dy = lastTranslateRef.current;
    startYRef.current = null;
    lastTranslateRef.current = 0;
    dragAllowedRef.current = true;
    startedInScrollRef.current = false;
    if (sheetRef.current) sheetRef.current.style.transition = `transform ${ANIM_MS}ms cubic-bezier(.22,.9,.32,1)`;
    if (dy >= SWIPE_CLOSE_THRESHOLD) {
      if (sheetRef.current) sheetRef.current.style.transform = `translateY(100%)`;
      setTimeout(() => onClose(), ANIM_MS + 10);
    } else {
      if (sheetRef.current) sheetRef.current.style.transform = `translateY(0)`;
    }
  };

  const currentCheckpoint = checkpoints.find((c) => c.id === current) ?? null;

  const navigate = useNavigate();

  const handlePlay = async () => {
    try {
      const projectId = project.id;
      if (!projectId) {
        console.warn("ProjectActionSheet: missing project.id");
        return;
      }

      const existing = await readProjectFile(projectId, "blocks.json");
      if (!existing) {
        const ok = await saveProjectFile(projectId, "blocks.json", JSON.stringify([]));
        if (!ok) {
          try {
            const key = `bj_projects/${projectId}/blocks.json`;
            if (typeof window !== "undefined" && window.localStorage) {
              window.localStorage.setItem(key, JSON.stringify([]));
            }
          } catch (err) {
            console.warn("fallback write to localStorage failed", err);
          }
        }
      }

      try {
        const idx = await loadProjects();
        const exists = Array.isArray(idx) && idx.some((p: any) => p && p.id === projectId);
        if (!exists) {
          const newEntry: any = {
            id: projectId,
            name: project.name ?? projectId,
            subtitle: project.subtitle ?? "",
            img: (project as any).img ?? "",
            progress: sessionProgress ?? 0,
          };
          const next = Array.isArray(idx) ? [...idx, newEntry] : [newEntry];
          await saveProjects(next);
        }
      } catch (err) {
        console.warn("ProjectActionSheet: ensuring project index failed", err);
      }

      try {
        await initSession(projectId);
      } catch (err) {
        console.warn("ProjectActionSheet: initSession failed", err);
      }

      setIsVisible(false);
      setTimeout(() => {
        onClose();
        navigate(`/project/${encodeURIComponent(projectId)}`, {
          state: {
            autoStartDialogue: true,
            startChapter: currentCheckpoint?.id ?? undefined,
          } as any,
        } as any);
      }, ANIM_MS + 10);
    } catch (err) {
      console.error("ProjectActionSheet: handlePlay error", err);
    }
  };

  // -------------------------
  // IMAGE logic for action sheet (unchanged)
  // -------------------------
  const [imageCandidates, setImageCandidates] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!project?.imgsPath) {
        const legacy = (project as any).img;
        if (legacy) {
          if (!mounted) return;
          setImageCandidates([legacy]);
          setCurrentImage(legacy);
          return;
        }
        const ph = "https://placehold.co/800x600?text=project";
        if (!mounted) return;
        setImageCandidates([ph]);
        setCurrentImage(ph);
        return;
      }

      const base = project.imgsPath.replace(/\/?$/, "/");
      const discovered: string[] = [];

      // Try to find images for each checkpoint
      for (const cp of checkpoints) {
        const patterns = [
          `${base}${cp.id}.png`,
          `${base}ch${cp.id}.png`,
          `${base}chapter-${cp.id}.png`,
          `${base}${cp.id.replace('chapter-', '')}.png`
        ];

        const numericMatch = cp.id.match(/\d+/);
        if (numericMatch) {
          patterns.push(`${base}${numericMatch[0]}.png`);
        }

        for (const pattern of patterns) {
          // eslint-disable-next-line no-await-in-loop
          if (await checkImageExists(pattern)) {
            discovered.push(pattern);
            break;
          }
        }
      }

      if (discovered.length === 0) {
        const MAX_PROBE = 20;
        for (let i = 1; i <= MAX_PROBE; i++) {
          const candCh = `${base}ch${i}.png`;
          // eslint-disable-next-line no-await-in-loop
          if (await checkImageExists(candCh)) {
            discovered.push(candCh);
            continue;
          }
          const candNum = `${base}${i}.png`;
          // eslint-disable-next-line no-await-in-loop
          if (await checkImageExists(candNum)) {
            discovered.push(candNum);
          }
        }
      }

      if (discovered.length === 0) {
        const thumb = `${base}thumb.png`;
        if (await checkImageExists(thumb)) discovered.push(thumb);
      }

      if (discovered.length === 0 && (project as any).img) {
        discovered.push((project as any).img);
      }

      if (discovered.length === 0) {
        discovered.push("https://placehold.co/800x600?text=project");
      }

      if (!mounted) return;
      const uniq = Array.from(new Set(discovered));
      setImageCandidates(uniq);
      let lastUnlockedIndex = -1;
      for (let i = checkpoints.length - 1; i >= 0; i--) {
        const c = checkpoints[i];
        if (!c.locked) {
          lastUnlockedIndex = i;
          break;
        }
      }
      if (lastUnlockedIndex >= 0) {
        setCurrentImage(uniq[lastUnlockedIndex] ?? uniq[0] ?? null);
      } else {
        setCurrentImage(uniq[0] ?? null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [project?.imgsPath, checkpoints]);

  // when checkpoint changes: attempt to swap to checkpoint-specific image (with fade)
  useEffect(() => {
    if (!current) return;
    (async () => {
      const base = project.imgsPath ? project.imgsPath.replace(/\/?$/, "/") : null;
      if (base) {
        const patterns = [
          `${base}${current}.png`,
          `${base}ch${current}.png`,
          `${base}chapter-${current}.png`,
          `${base}${current.replace('chapter-', '')}.png`
        ];

        const numericMatch = current.match(/\d+/);
        if (numericMatch) {
          patterns.push(`${base}${numericMatch[0]}.png`);
        }

        for (const pattern of patterns) {
          if (await checkImageExists(pattern)) {
            setIsFading(true);
            setTimeout(() => {
              setCurrentImage(pattern);
              setIsFading(false);
            }, 160);
            return;
          }
        }
      }

      const idx = Math.max(0, checkpoints.findIndex((c) => c.id === current));
      if (imageCandidates.length > 0) {
        const pick = imageCandidates[idx % imageCandidates.length];
        setIsFading(true);
        setTimeout(() => {
          setCurrentImage(pick);
          setIsFading(false);
        }, 160);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      {/* backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity ${isVisible ? "opacity-40" : "opacity-0"}`}
        onClick={closeWithAnimation}
      />

      {/* sheet container */}
      <div
        role="dialog"
        aria-modal="true"
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative w-full max-w-3xl rounded-t-2xl bg-white dark:bg-neutral-900 p-4 shadow-xl touch-pan-y"
        style={{
          transform: isVisible ? "translateY(0)" : "translateY(100%)",
          transition: `transform ${ANIM_MS}ms cubic-bezier(.22,.9,.32,1)`,
          maxHeight: "calc(100vh - 80px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="mx-auto w-12 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 mb-3" />

        <div className="flex flex-col md:flex-row gap-4" style={{ flex: 1, minHeight: 0 }}>
          {/* IMAGE + DESCRIPTION column */}
          <div className="w-full md:w-1/2 flex-shrink-0 flex flex-col" style={{ minHeight: 0 }}>
            <div
              className="relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 aspect-[11/9] md:aspect-[16/9]"
            >
              <div
                className="w-full h-full"
                style={{ position: "relative" }}
              >
                <div 
                  className="w-full h-full absolute inset-0 bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center"
                >
                  <div className="text-neutral-400 dark:text-neutral-500">No Image</div>
                </div>
                
                {currentImage && (
                  <img
                    key={currentImage}
                    src={currentImage}
                    alt={project.name}
                    className="w-full h-full object-cover transition-opacity duration-300"
                    style={{ opacity: isFading ? 0 : 1, position: "absolute", inset: 0 }}
                    onError={(e) => {
                      console.warn('Image failed to load:', currentImage);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>

              <button
                onClick={async () => {
                  await handlePlay();
                }}
                className="absolute right-3 bottom-3 rounded-full p-3 bg-green-500 text-white shadow"
                aria-label="شروع"
              >
                <Play className="w-4 h-4" />
              </button>

              <div className="absolute left-3 top-3 w-14 h-14 bg-white/90 rounded-full p-1">
                <CircularProgressbar
                  value={typeof sessionProgress === "number" ? sessionProgress : project.progress ?? 0}
                  text={`${Math.round(typeof sessionProgress === "number" ? sessionProgress : project.progress ?? 0)}%`}
                  styles={buildStyles({
                    textSize: "28px",
                    pathColor: "#16a34a",
                    textColor: "#064e3b",
                    trailColor: "#d1fae5",
                  })}
                />
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-2xl">{project.name}</div>
            <div className="text-md text-neutral-500 mt-1">{project.subtitle}</div>
          </div>
          {/* CHECKPOINT column: make this the only scrollable area */}
          <div
            ref={scrollRef}
            className="flex-1 text-right w-full md:w-1/2"
            style={{
              overflowY: "auto",
              minHeight: 0,
            }}
          >
            <div className="my-3 text-right">
              <div className="text-sm font-medium mb-1">توضیحات مرحله</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800 p-3 rounded-md">
                {project.subtitle || currentCheckpoint?.description || ""}
              </div>
            </div>
            

            <div className="mt-3">
              <div className="text-sm font-medium mb-2">مراحل (Checkpoint)</div>
              <div className="space-y-2 px-0">
                {checkpoints.map((c) => {
                  const isCurrent = c.id === current;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (!c.locked) setCurrent(c.id);
                      }}
                      disabled={c.locked}
                      className={`w-full p-3 rounded-md text-right flex items-center justify-between ${
                        isCurrent
                          ? "bg-sky-50 dark:bg-sky-900/30 border border-sky-300"
                          : c.locked
                          ? "bg-neutral-100 dark:bg-neutral-800 opacity-60"
                          : "bg-white dark:bg-neutral-900"
                      }`}
                    >
                      <div>
                        <div className="text-sm">{c.title}</div>
                        <div className="text-xs text-neutral-400">
                          {isCurrent ? "فعلی" : c.locked ? "قفل شده" : sessionStep ? `قابل اجرا تا ${sessionStep}` : ""}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-400">{c.locked ? "🔒" : "›"}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* footer buttons */}
        <hr className="border-t-2 mt-4 border-emerald-800"/>
      </div>
    </div>
  );
};

export default ProjectActionSheet;
