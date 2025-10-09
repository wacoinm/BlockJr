// src/components/project-selection/ProjectActionSheet.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { Play } from "lucide-react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

import { useNavigate } from "react-router";
import { saveProjectFile, readProjectFile, loadProjects, saveProjects } from "../../utils/projectStorage";
import { initSession, getSession } from "../../utils/sessionStorage";

type Checkpoint = { id: string; title?: string; locked?: boolean; description?: string };
type Project = {
  id: string;
  name: string;
  subtitle?: string;
  // imgsPath should be a public path (served from /), e.g. "/scenes/elevator/chapters/"
  imgsPath?: string;
  progress?: number;
  checkpoints?: Checkpoint[];
  project?: any; // elevator object etc
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
    // avoid accidental relative resolution issues by using the url as-is
    img.src = url;
    // safety timeout
    setTimeout(() => {
      if (!done) {
        done = true;
        resolve(false);
      }
    }, 2500);
  });
}

const ProjectActionSheet: React.FC<Props> = ({ project, onClose }) => {
  // derive checkpoints:
  const derivedCheckpointsBase = useMemo<Checkpoint[]>(() => {
    if (Array.isArray(project.checkpoints) && project.checkpoints.length > 0) {
      return project.checkpoints;
    }
    if (project.project && typeof project.project === "object") {
      const keys = Object.keys(project.project);
      return keys.map((k) => ({
        id: k,
        title: k,
        locked: false,
        description: undefined,
      }));
    }
    return [];
  }, [project]);

  // session-aware checkpoints (we'll overlay locked/current based on session.step)
  const [derivedCheckpoints, setDerivedCheckpoints] = useState<Checkpoint[]>(derivedCheckpointsBase);

  useEffect(() => {
    setDerivedCheckpoints(derivedCheckpointsBase);
  }, [derivedCheckpointsBase]);

  // overlay session progress/step for UI
  const [sessionProgress, setSessionProgress] = useState<number | undefined>(project.progress ?? 0);
  const [sessionStep, setSessionStep] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!project?.id) return;
        const s = await getSession(project.id);
        if (!mounted) return;
        if (s) {
          setSessionProgress(typeof s.progress === "number" ? s.progress : project.progress ?? 0);
          setSessionStep(typeof s.step === "number" ? s.step : null);

          const base = derivedCheckpointsBase.map((c, i) => {
            const step = s.step ?? 1;
            const isLocked = i + 1 > step;
            return { ...c, locked: !!isLocked };
          });
          setDerivedCheckpoints(base);
        } else {
          setSessionProgress(project.progress ?? 0);
          setSessionStep(null);
          setDerivedCheckpoints(derivedCheckpointsBase);
        }
      } catch (err) {
        console.warn("ProjectActionSheet: failed to read session", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [project?.id, project.progress, derivedCheckpointsBase]);

  const checkpoints = derivedCheckpoints;

  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    setCurrent([...checkpoints].reverse().find(c => !c.locked)?.id ?? checkpoints[0]?.id ?? null);
  }, [project, checkpoints]); // eslint-disable-line

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
  // IMAGE logic for action sheet (improved)
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

      for (const cp of checkpoints) {
        const cand = `${base}${cp.id}.png`;
        // eslint-disable-next-line no-await-in-loop
        if (await checkImageExists(cand)) {
          discovered.push(cand);
        } else {
          const maybeNum = `${base}ch${cp.id}.png`;
          // eslint-disable-next-line no-await-in-loop
          if (await checkImageExists(maybeNum)) {
            discovered.push(maybeNum);
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
        const candidate1 = `${base}${current}.png`;
        if (await checkImageExists(candidate1)) {
          setIsFading(true);
          setTimeout(() => {
            setCurrentImage(candidate1);
            setIsFading(false);
          }, 160);
          return;
        }
        const candidate2 = `${base}ch${current}.png`;
        if (await checkImageExists(candidate2)) {
          setIsFading(true);
          setTimeout(() => {
            setCurrentImage(candidate2);
            setIsFading(false);
          }, 160);
          return;
        }
        const numericMatch = current.match(/\d+/);
        if (numericMatch) {
          const candidate3 = `${base}${numericMatch[0]}.png`;
          if (await checkImageExists(candidate3)) {
            setIsFading(true);
            setTimeout(() => {
              setCurrentImage(candidate3);
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
            {/* CHANGED: use an aspect-ratio container so image is visible on mobile and desktop equally */}
            <div
              className="relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 aspect-[11/9] md:aspect-[16/9]"
            >
              <div
                className="w-full h-full"
                style={{ position: "relative" }}
              >
                <img
                  src={currentImage ?? "https://placehold.co/800x600?text=project"}
                  alt={project.name}
                  className="w-full h-full object-cover transition-opacity duration-300"
                  style={{ opacity: isFading ? 0 : 1, position: "absolute", inset: 0 }}
                />
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
                {currentCheckpoint?.description ?? (typeof project.project?.[currentCheckpoint?.id] === "string" ? project.project[currentCheckpoint?.id] : project.project?.[currentCheckpoint?.id]?.[0]?.text || project.project?.[currentCheckpoint?.id]?.[0]?.message || project.project?.[currentCheckpoint?.id]?.dialogue?.[0]?.text || project.project?.[currentCheckpoint?.id]?.blocks?.[0]?.text || `توضیحات برای "${currentCheckpoint?.title ?? "مرحله"}" موجود نیست.`)}
              </div>
            </div>
            <div className="font-semibold text-lg">{project.name}</div>
            <div className="text-sm text-neutral-500 mt-1">{project.subtitle}</div>

            <div className="mt-3">
              <div className="text-sm font-medium mb-2">مراحل (Checkpoint)</div>
              <div className="space-y-2 px-0">
                {checkpoints.map((c, idx) => {
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
        <hr className="border-t-2 border-emerald-800"/>
      </div>
    </div>
  );
};

export default ProjectActionSheet;
