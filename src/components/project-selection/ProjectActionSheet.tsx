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

  const [isVisible, setIsVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null); // <-- new: scrollable container ref

  const startYRef = useRef<number | null>(null);
  const lastTranslateRef = useRef(0);

  // controls whether the sheet should handle dragging for the current touch
  const dragAllowedRef = useRef(true);
  // remembers whether the touch started inside the scrollable checkpoint column
  const startedInScrollRef = useRef(false);

  useEffect(() => {
    setCurrent(checkpoints.find((c) => !c.locked)?.id ?? checkpoints[0]?.id ?? null);
  }, [project]); // eslint-disable-line

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, [])

  const closeWithAnimation = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), ANIM_MS + 20);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    lastTranslateRef.current = 0;

    // detect if the touch began inside the scrollable area
    const target = e.target as Node;
    startedInScrollRef.current = !!(scrollRef.current && scrollRef.current.contains(target));

    if (startedInScrollRef.current && scrollRef.current) {
      // if the scroll container is not at the top, let it handle touch (don't start dragging sheet)
      dragAllowedRef.current = scrollRef.current.scrollTop === 0;
    } else {
      // touch started outside the scroll container -> sheet can be dragged
      dragAllowedRef.current = true;
    }

    if (sheetRef.current) sheetRef.current.style.transition = "";
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;

    // if drag isn't allowed (e.g., user started dragging a scroller that can scroll), do nothing
    if (!dragAllowedRef.current) return;

    const dy = e.touches[0].clientY - startYRef.current;

    // only handle downward movement for dismiss (ignore upward moves)
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
      // animate sheet offscreen then close
      if (sheetRef.current) sheetRef.current.style.transform = `translateY(100%)`;
      setTimeout(() => onClose(), ANIM_MS + 10);
    } else {
      // snap back
      if (sheetRef.current) sheetRef.current.style.transform = `translateY(0)`;
    }
  };

  const currentCheckpoint = checkpoints.find((c) => c.id === current) ?? null;

  return (
    // very high z to overlap header
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
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative w-full max-w-3xl rounded-t-2xl bg-white dark:bg-neutral-900 p-4 shadow-xl touch-pan-y"
        style={{
          transform: isVisible ? "translateY(0)" : "translateY(100%)",
          transition: `transform ${ANIM_MS}ms cubic-bezier(.22,.9,.32,1)`,
          maxHeight: "calc(100vh - 80px)",
          overflow: "hidden", // <-- prevent full-sheet scroll
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* drag handle */}
        <div className="mx-auto w-12 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 mb-3" />

        {/* content area: takes remaining height and splits into image/description and checkpoints.
            Using flex so we can make checkpoints column scrollable independently.
        */}
        <div className="flex flex-col md:flex-row gap-4" style={{ flex: 1, minHeight: 0 }}>
          {/* IMAGE + DESCRIPTION column */}
          <div className="w-full md:w-1/2 flex-shrink-0 flex flex-col" style={{ minHeight: 0 }}>
            {/* image wrapper: on desktop we want it to fill available height; on mobile it will be natural height but capped */}
            <div
              className="relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800"
              style={{
                // ensure image never overflows viewport; on md it will expand to fill column height
                maxHeight: "55vh",
                height: "100%", // allows md column to stretch
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

          {/* CHECKPOINT column: make this the only scrollable area */}
          <div
            ref={scrollRef} // <-- attach ref here
            className="flex-1 text-right w-full md:w-1/2"
            style={{
              // IMPORTANT: make this a scroll container inside the sheet
              overflowY: "auto",
              minHeight: 0, // allow proper flex scrolling
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
