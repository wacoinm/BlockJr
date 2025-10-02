// src/components/project-selection/ProjectActionSheet.tsx
import React, { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

type Checkpoint = { id: string; title: string; locked?: boolean; description?: string };
type Project = {
  id: string;
  name: string;
  subtitle?: string;
  img?: string;
  imgMobile?: string;
  progress?: number;
  checkpoints?: Checkpoint[];
};

type Props = {
  project: Project;
  onClose: () => void;
};

const ANIM_MS = 320;
const SWIPE_CLOSE_THRESHOLD = 80; // px to trigger close on swipe

const ProjectActionSheet: React.FC<Props> = ({ project, onClose }) => {
  const checkpoints = project.checkpoints ?? [];
  const [current, setCurrent] = useState<string | null>(checkpoints.find((c) => !c.locked)?.id ?? checkpoints[0]?.id ?? null);
  const [isVisible, setIsVisible] = useState(true);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const checkpointsRef = useRef<HTMLDivElement | null>(null);

  // touch tracking refs (mutable so native handlers can read/write)
  const startYRef = useRef<number | null>(null);
  const lastTranslateRef = useRef(0);
  const initialScrollTopRef = useRef(0);
  const isSheetDraggingRef = useRef(false);

  useEffect(() => {
    setCurrent(checkpoints.find((c) => !c.locked)?.id ?? checkpoints[0]?.id ?? null);
  }, [project]); // eslint-disable-line

  const closeWithAnimation = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), ANIM_MS + 20);
  };

  // --- Native touch handlers (so we can control passive option) ---
  useEffect(() => {
    const node = sheetRef.current;
    if (!node) return;

    // start
    const handleTouchStart = (e: TouchEvent) => {
      startYRef.current = e.touches[0].clientY;
      lastTranslateRef.current = 0;
      isSheetDraggingRef.current = false;
      initialScrollTopRef.current = checkpointsRef.current ? checkpointsRef.current.scrollTop : 0;
      // stop any transition while dragging
      node.style.transition = "";
    };

    // move (must be passive: false to allow preventDefault)
    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const currentY = e.touches[0].clientY;
      const dy = currentY - startYRef.current;

      // if we haven't decided to drag sheet yet:
      if (!isSheetDraggingRef.current) {
        // start dragging sheet only when pulling down AND inner list is at top
        if (dy > 0 && (initialScrollTopRef.current === 0 || !checkpointsRef.current)) {
          isSheetDraggingRef.current = true;
          e.preventDefault(); // prevent page rubberband / inner scroll from interfering
        } else {
          // let inner scroll handle the gesture
          return;
        }
      }

      // if here, sheet dragging is active
      e.preventDefault();
      lastTranslateRef.current = Math.max(0, dy);
      node.style.transform = `translateY(${lastTranslateRef.current}px)`;
      node.style.boxShadow = `0 8px 30px rgba(2,6,23,${Math.max(0.06, 0.18 - lastTranslateRef.current / 800)})`;
    };

    // end
    const handleTouchEnd = () => {
      const dy = lastTranslateRef.current;
      startYRef.current = null;
      lastTranslateRef.current = 0;
      node.style.transition = `transform ${ANIM_MS}ms cubic-bezier(.22,.9,.32,1)`;

      if (isSheetDraggingRef.current) {
        isSheetDraggingRef.current = false;
        if (dy >= SWIPE_CLOSE_THRESHOLD) {
          // close
          node.style.transform = `translateY(100%)`;
          setTimeout(() => onClose(), ANIM_MS + 10);
        } else {
          // snap back
          node.style.transform = `translateY(0)`;
        }
      } else {
        // nothing special: ensure sheet is at resting position
        node.style.transform = `translateY(0)`;
      }
    };

    // attach listeners: touchmove must be passive:false
    node.addEventListener("touchstart", handleTouchStart, { passive: true });
    node.addEventListener("touchmove", handleTouchMove, { passive: false });
    node.addEventListener("touchend", handleTouchEnd, { passive: true });
    node.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchmove", handleTouchMove);
      node.removeEventListener("touchend", handleTouchEnd);
      node.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [onClose]);

  const currentCheckpoint = checkpoints.find((c) => c.id === current) ?? null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      {/* backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity ${isVisible ? "opacity-40" : "opacity-0"}`}
        onClick={closeWithAnimation}
      />

      {/* sheet container: constrained height, hidden overflow; internal layout manages scroll only for checkpoints */}
      <div
        role="dialog"
        aria-modal="true"
        ref={sheetRef}
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
        {/* drag handle */}
        <div className="mx-auto w-12 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 mb-3" />

        {/* content area: takes remaining height and splits into image/description and checkpoints.
            Using flex so checkpoints column becomes the only scrollable area.
        */}
        <div className="flex flex-col md:flex-row gap-4" style={{ flex: 1, minHeight: 0 }}>
          {/* IMAGE + DESCRIPTION column */}
          <div className="w-full md:w-1/2 flex-shrink-0 flex flex-col" style={{ minHeight: 0 }}>
            <div
              className="relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800"
              style={{
                maxHeight: "55vh",
                height: "100%",
                minHeight: 120,
              }}
            >
              <img
                src={project.img}
                srcSet={project.imgMobile ? `${project.imgMobile} 480w, ${project.img} 800w` : undefined}
                sizes="(max-width: 640px) 90vw, 360px"
                alt={project.name}
                className="w-full h-full object-cover"
                style={{ display: "block" }}
              />

              <button
                onClick={() => {
                  console.log("play", project.id, current);
                }}
                className="absolute right-3 bottom-3 rounded-full p-3 bg-green-500 text-white shadow"
                aria-label="شروع"
              >
                <Play className="w-4 h-4" />
              </button>

              <div className="absolute left-3 top-3 w-14 h-14 bg-white/90 rounded-full p-1">
                <CircularProgressbar
                  value={project.progress ?? 0}
                  text={`${project.progress ?? 0}%`}
                  styles={buildStyles({
                    textSize: "28px",
                    pathColor: "#16a34a",
                    textColor: "#064e3b",
                    trailColor: "#d1fae5",
                  })}
                />
              </div>
            </div>

            {/* description sits under image (not scrollable) */}
            <div className="mt-3 text-right">
              <div className="text-sm font-medium mb-1">توضیحات مرحله</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800 p-3 rounded-md">
                {currentCheckpoint?.description ?? `توضیحات برای "${currentCheckpoint?.title ?? "مرحله"}" موجود نیست.`}
              </div>
            </div>
          </div>

          {/* CHECKPOINT column: only this scrolls */}
          <div
            ref={checkpointsRef}
            className="flex-1 text-right w-full md:w-1/2"
            style={{
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              minHeight: 0,
            }}
          >
            <div className="font-semibold text-lg">{project.name}</div>
            <div className="text-sm text-neutral-500 mt-1">{project.subtitle}</div>

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
                        <div className="text-xs text-neutral-400">{isCurrent ? "فعلی" : c.locked ? "قفل شده" : ""}</div>
                      </div>
                      <div className="text-xs text-neutral-400">{c.locked ? "🔒" : "›"}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* footer buttons (not part of checkpoint scroll) */}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={closeWithAnimation} className="px-4 py-2 rounded-md border">
            بستن
          </button>
          <button
            onClick={() => {
              console.log("load checkpoint", current);
            }}
            className="px-4 py-2 rounded-md bg-green-600 text-white"
          >
            رفتن به بخش
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectActionSheet;
