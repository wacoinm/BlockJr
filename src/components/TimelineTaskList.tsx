// src/components/TimelineTaskList.tsx
import React, { useEffect, useState, useRef } from "react";
import { X, Play, CheckCircle, Lock, Circle } from "lucide-react";

/*
  TimelineTaskList (Final Revision)
  - Prevents horizontal scroll.
  - Uses clamp() for responsive font sizes on titles/buttons.
  - Glassmorphism background with backdrop blur.
  - Dark mode supported.
  - Collapsible timeline items, only one open at a time.
  - No overflow/overlap even on very small screens.
*/

export type TaskItem = {
  id: string;
  title: string;
  description?: string;
  shortDescription?: string;
  type?: "image" | "video" | "text";
  mediaUrl?: string;
  mediaText?: string;
  locked?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  tasks: TaskItem[];
  title?: string;
};

const PLACEHOLDER = (text = "project") =>
  `https://placehold.co/800x600?text=${encodeURIComponent(text)}`;

const TimelineTaskList: React.FC<Props> = ({ visible, onClose, tasks, title }) => {
  const [statuses, setStatuses] = useState<("locked" | "pending" | "done")[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const s = tasks.map((t) => (t.locked ? "locked" : "locked"));
    const firstUnlocked = tasks.findIndex((t) => !t.locked);
    if (firstUnlocked >= 0) s[firstUnlocked] = "pending";
    else if (s.length > 0) s[0] = "pending";
    setStatuses(s);
    setOpenIndex(null);
  }, [tasks, visible]);

  if (!visible) return null;

  const toggleOpen = (idx: number) => {
    if (statuses[idx] === "locked") return;
    setOpenIndex((p) => (p === idx ? null : idx));
    setStatuses((prev) => {
      const next = [...prev];
      next[idx] = "done";
      if (idx + 1 < next.length && next[idx + 1] === "locked") next[idx + 1] = "pending";
      return next;
    });
  };

  const icon = (s: "locked" | "pending" | "done") => {
    if (s === "done")
      return (
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30 shadow-sm">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-300" />
        </div>
      );
    if (s === "locked")
      return (
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 shadow-sm">
          <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </div>
      );
    return (
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/20 shadow-sm">
        <Circle className="w-4 h-4 text-blue-600 dark:text-blue-300" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[999]" aria-modal="true" role="dialog">
      {/* background blur */}
      <div
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 bg-white/20 dark:bg-black/30 backdrop-blur-3xl"
      />

      {/* main modal container */}
      <div
        ref={containerRef}
        className="relative w-full max-w-5xl mx-2 sm:mx-4 rounded-2xl overflow-hidden overflow-x-hidden"
        style={{
          maxHeight: "calc(100vh - 72px)",
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(25px) saturate(180%)",
          WebkitBackdropFilter: "blur(25px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.4)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
          <div className="text-right flex-1 min-w-0">
            <div className="font-semibold text-[clamp(1rem,2.8vw,1.3rem)] text-slate-900 dark:text-slate-100 truncate">
              {title ?? "تسک‌ها"}
            </div>
            <div className="text-[clamp(0.7rem,1.8vw,0.9rem)] text-slate-500 dark:text-slate-400">
              فصل جاری را دنبال کنید
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5 text-slate-700 dark:text-slate-200" />
          </button>
        </div>

        {/* Body */}
        <div
          className="px-3 sm:px-4 pb-6 overflow-y-auto overflow-x-hidden"
          style={{ maxHeight: "calc(100vh - 160px)" }}
        >
          <div className="relative w-full">
            {/* timeline line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-400/30 to-blue-300/10 sm:left-[70px] left-[48px]"
              aria-hidden
            />

            <div className="flex flex-col gap-6 mt-6">
              {tasks.map((t, i) => {
                const s = statuses[i] ?? "locked";
                const open = openIndex === i;
                return (
                  <div key={t.id} className="relative flex items-start w-full overflow-x-hidden">
                    {/* icon column */}
                    <div className="z-10 flex-shrink-0 w-24 sm:w-36 pr-2 sm:pr-3 flex flex-col items-center">
                      {icon(s)}
                    </div>

                    {/* task card */}
                    <div className="flex-1 z-20 w-full overflow-hidden">
                      <div
                        className={`rounded-xl overflow-hidden transition-all duration-300 ${
                          open ? "shadow-lg" : "shadow-sm"
                        } bg-white/70 dark:bg-slate-900/60 backdrop-blur-md`}
                      >
                        <div className="px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                          <div className="flex-1 text-right min-w-[40%]">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 text-[clamp(0.9rem,2.2vw,1rem)] leading-snug">
                              {t.title}
                            </div>
                            {!open && t.type !== "image" && t.type !== "video" && (
                              <div className="text-[clamp(0.75rem,1.9vw,0.85rem)] text-slate-600 dark:text-slate-300 line-clamp-1">
                                {t.shortDescription ??
                                  (t.description
                                    ? t.description.slice(0, 100) + "..."
                                    : "توضیحات موجود نیست")}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            <span
                              className={`text-[clamp(0.7rem,1.7vw,0.8rem)] font-medium px-2 py-[2px] rounded ${
                                s === "done"
                                  ? "bg-green-50 text-green-800"
                                  : s === "locked"
                                  ? "bg-slate-50 text-slate-500"
                                  : "bg-blue-50 text-blue-800"
                              }`}
                            >
                              {s === "done" ? "انجام‌شده" : s === "locked" ? "قفل" : "فعال"}
                            </span>

                            <button
                              onClick={() => toggleOpen(i)}
                              disabled={s === "locked"}
                              className={`px-3 py-1 rounded-md text-[clamp(0.75rem,2vw,0.9rem)] transition ${
                                s === "locked"
                                  ? "opacity-50 cursor-not-allowed"
                                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              {open ? "بستن" : s === "done" ? "مشاهده مجدد" : "باز کردن"}
                            </button>
                          </div>
                        </div>

                        {/* collapsible section */}
                        <div
                          className="px-3 sm:px-4 overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(.2,.9,.2,1)]"
                          style={{
                            maxHeight: open ? 600 : 0,
                            opacity: open ? 1 : 0,
                          }}
                        >
                          <div className="pb-3 text-right text-slate-700 dark:text-slate-300 text-[clamp(0.8rem,2vw,0.9rem)] leading-relaxed">
                            {t.description ?? "توضیحات این بخش"}
                          </div>

                          {t.type === "video" && (
                            <div className="rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 mb-3">
                              <img
                                src={t.mediaUrl ?? PLACEHOLDER(t.mediaText ?? "Video")}
                                alt={t.title}
                                className="w-full h-48 object-cover"
                              />
                              <div className="p-3">
                                <a
                                  href={t.mediaUrl ?? "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 text-blue-700 dark:text-blue-300 text-[clamp(0.75rem,1.8vw,0.9rem)]"
                                >
                                  <Play className="w-4 h-4" /> تماشای ویدیو
                                </a>
                              </div>
                            </div>
                          )}

                          {t.type === "image" && (
                            <img
                              src={t.mediaUrl ?? PLACEHOLDER(t.mediaText ?? "Image")}
                              alt={t.title}
                              className="w-full h-48 object-cover rounded-lg mb-3"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineTaskList;
