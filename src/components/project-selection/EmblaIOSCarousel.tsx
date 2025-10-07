// src/components/project-selection/EmblaIOSCarousel.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Play, Lock } from "lucide-react";
import { getSession } from "../../utils/sessionStorage";

type Checkpoint = { id: string; title?: string; locked?: boolean };
type Project = {
  id: string;
  name: string;
  subtitle?: string;
  // directory path to project's pngs (e.g. "/scenes/elevator/")
  imgsPath?: string;
  progress?: number;
  checkpoints?: Checkpoint[];
  isLock?: boolean;
  lockReason?: string;
};

type DerivedProject = Project & {
  sessionStep?: number | null;
  derivedProgress?: number;
  totalChapters?: number | null;
};

type Props = {
  projects: Project[];
  onOpen: (p: Project) => void;
  repeatCount?: number;
};

const IMAGE_PROBE_MAX = 12; // try 1..12 by default
const ROTATE_MS = 3000; // 3 seconds

// small helper to test whether an image URL loads successfully
function probeImage(url: string): Promise<boolean> {
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

/**
 * Normalize imgsPath:
 * - If it's an absolute URL (http/https) leave as-is (ensure trailing slash).
 * - If it starts with "public/", convert to root-relative by removing "public/" and ensuring leading '/'.
 * - If it doesn't start with '/', prefix with '/' to resolve from site root.
 * - Ensure trailing slash.
 */
function normalizeImgsPath(raw?: string): string {
  if (!raw || raw.trim() === "") return "/";
  let p = raw.trim().replace(/\\/g, "/");

  // If it's a full URL, keep scheme and hostname, just ensure trailing slash
  if (/^https?:\/\//i.test(p)) {
    if (!p.endsWith("/")) p += "/";
    return p;
  }

  // convert public/... -> /...
  if (p.startsWith("public/")) p = p.replace(/^public\//, "/");

  // ensure leading slash
  if (!p.startsWith("/")) p = "/" + p;

  // ensure trailing slash
  if (!p.endsWith("/")) p += "/";

  return p;
}

const EmblaIOSCarousel: React.FC<Props> = ({ projects, onOpen }) => {
  const projectCount = projects.length;

  const emblaOptions = useMemo(
    () => ({
      loop: projectCount > 1,
      align: "center",
      containScroll: "trimSnaps",
      skipSnaps: false,
    }),
    [projectCount]
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(emblaOptions);

  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelectOrScroll = () => {
      try {
        const absIndex = (emblaApi as any).selectedScrollSnap?.() ?? 0;
        setSelectedIndex(absIndex);
      } catch {
        // ignore
      }
    };

    onSelectOrScroll();

    emblaApi.on("select", onSelectOrScroll);
    emblaApi.on("scroll", onSelectOrScroll);
    emblaApi.on("reInit", onSelectOrScroll);

    return () => {
      try {
        emblaApi.off("select", onSelectOrScroll);
        emblaApi.off("scroll", onSelectOrScroll);
        emblaApi.off("reInit", onSelectOrScroll);
      } catch {
        // ignore
      }
    };
  }, [emblaApi]);

  const scrollToLogical = useCallback(
    (logicalIdx: number) => {
      if (!emblaApi) return;
      const target = logicalIdx % Math.max(1, projectCount);
      try {
        emblaApi.scrollTo(target);
      } catch {
        // ignore
      }
    },
    [emblaApi, projectCount]
  );

  const logicalSelected = projectCount
    ? ((selectedIndex % projectCount) + projectCount) % projectCount
    : 0;

  // Derived projects overlaying session data (progress & step) and trying to discover total chapters
  const [derivedProjects, setDerivedProjects] = useState<DerivedProject[]>(
    () =>
      projects.map((p) => ({
        ...p,
        derivedProgress: p.progress ?? 0,
        totalChapters: p.checkpoints?.length ?? null,
      }))
  );

  useEffect(() => {
    // initialize with defaults based on incoming projects
    setDerivedProjects(
      projects.map((p) => ({
        ...p,
        derivedProgress: p.progress ?? 0,
        totalChapters: p.checkpoints?.length ?? null,
      }))
    );

    let mounted = true;

    (async () => {
      // for each project, read session and optionally try to infer total chapters from assets or story modules
      const next: DerivedProject[] = [];
      for (const p of projects) {
        const dp: DerivedProject = {
          ...p,
          derivedProgress: p.progress ?? 0,
          sessionStep: null,
          totalChapters: p.checkpoints?.length ?? null,
        };

        try {
          const s = await getSession(p.id);
          if (!mounted) return;
          if (s) {
            dp.derivedProgress =
              typeof s.progress === "number" ? s.progress : dp.derivedProgress;
            dp.sessionStep = typeof s.step === "number" ? s.step : null;
          }
        } catch (err) {
          console.warn("EmblaIOSCarousel: getSession failed for", p.id, err);
        }

        // If we don't have totalChapters, attempt to dynamically import a story module at ../../assets/stories/<id>
        if (dp.totalChapters == null) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const mod: any = await import(`../../assets/stories/${p.id}`).catch(
              () => null
            );
            if (mod) {
              const storyObj =
                mod[p.id] ?? mod.default ?? mod.elevator ?? mod;
              if (storyObj && typeof storyObj === "object") {
                const total = Object.keys(storyObj).length;
                if (total > 0) dp.totalChapters = total;
              }
            }
          } catch (err) {
            // ignore - dynamic import failed or path not present
            // eslint-disable-next-line no-console
            console.debug("EmblaIOSCarousel: no story module for", p.id);
          }
        }

        next.push(dp);
      }

      if (!mounted) return;
      setDerivedProjects(next);
    })();

    return () => {
      mounted = false;
    };
  }, [projects]);

  // ---------------------
  // Image loading & rotation per project
  // ---------------------
  const [projectImages, setProjectImages] = useState<Record<string, string[]>>(
    {}
  );

  const [projectCurrentIdx, setProjectCurrentIdx] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    // (re)probe images for any project that has imgsPath
    derivedProjects.forEach((p) => {
      const pid = p.id;
      if (!pid) return;
      if (projectImages[pid] && projectImages[pid].length > 0) return; // already loaded

      (async () => {
        const imgs: string[] = [];

        if (p.imgsPath) {
          const base = normalizeImgsPath(p.imgsPath);

          // Try numeric sequence 1..IMAGE_PROBE_MAX
          for (let i = 1; i <= IMAGE_PROBE_MAX; i++) {
            const url = `${base}${i}.png`;
            // eslint-disable-next-line no-await-in-loop
            const ok = await probeImage(url);
            if (ok) imgs.push(url);
          }

          // also try a thumb.png fallback
          if (imgs.length === 0) {
            const thumb = `${base}thumb.png`;
            if (await probeImage(thumb)) imgs.push(thumb);
          }
        }

        // if nothing discovered, attempt to fallback to any existing img field (backwards compat)
        if (imgs.length === 0 && (p as any).img) {
          imgs.push((p as any).img);
        }

        // finally fallback placeholder
        if (imgs.length === 0) {
          imgs.push("https://placehold.co/800x600?text=no+image");
        }

        setProjectImages((prev) => ({ ...prev, [pid]: imgs }));
        setProjectCurrentIdx((prev) => ({
          ...prev,
          [pid]: prev[pid] ?? 0,
        }));
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedProjects]);

  // setup rotation intervals per-project
  useEffect(() => {
    const timers: Record<string, number> = {};

    Object.keys(projectImages).forEach((pid) => {
      const imgs = projectImages[pid] ?? [];
      if (!imgs || imgs.length <= 1) return;

      // rotate only if there isn't already a timer
      if (timers[pid]) return;

      const id = window.setInterval(() => {
        setProjectCurrentIdx((prev) => {
          const cur = prev[pid] ?? 0;
          const nextIdx = (cur + 1) % Math.max(1, imgs.length);
          return { ...prev, [pid]: nextIdx };
        });
      }, ROTATE_MS);

      timers[pid] = id;
    });

    return () => {
      Object.values(timers).forEach((t) => window.clearInterval(t));
    };
  }, [projectImages]);

  const DotButton: React.FC<
    React.ComponentPropsWithRef<"button"> & { selected?: boolean }
  > = ({ children, selected, ...rest }) => {
    return (
      <button
        type="button"
        {...rest}
        className={
          "inline-flex items-center justify-center mx-1 p-0 border-0 bg-transparent rounded-full " +
          "hover:scale-110 transition-transform"
        }
      >
        <span
          className={
            "block rounded-full w-3.5 h-3.5 " +
            (selected
              ? "bg-neutral-900 dark:bg-neutral-100"
              : "ring-2 ring-neutral-300 dark:ring-neutral-700")
          }
        />
      </button>
    );
  };

  return (
    <div className="max-w-[48rem] mx-auto" aria-roledescription="carousel">
      {/* viewport */}
      <div
        className="overflow-hidden"
        ref={emblaRef}
        style={{ touchAction: "pan-y pinch-zoom" }}
      >
        {/* container: negative left margin to counter slide padding */}
        <div className="flex -ml-4 my-6">
          {derivedProjects.map((p, i) => {
            const isCenter = i === logicalSelected;
            const locked = !!p.isLock;

            const displayedProgress =
              typeof p.derivedProgress === "number"
                ? p.derivedProgress
                : p.progress ?? 0;
            const sessionStep =
              typeof p.sessionStep === "number" ? p.sessionStep : null;
            const totalChapters =
              typeof p.totalChapters === "number"
                ? p.totalChapters
                : p.checkpoints?.length ?? null;

            const chapterText =
              sessionStep != null
                ? totalChapters != null
                  ? `${sessionStep}/${totalChapters} مرحله`
                  : `${sessionStep} مرحله`
                : totalChapters != null
                ? `${totalChapters} مرحله`
                : `${p.checkpoints?.length ?? 0} مرحله`;

            const imgs = projectImages[p.id] ?? [];
            const curIdx = projectCurrentIdx[p.id] ?? 0;
            const currentSrc = imgs[curIdx] ?? "https://placehold.co/800x600?text=no+image";

            return (
              <div
                key={`${p.id}-${i}`}
                aria-hidden={!isCenter}
                className={
                  `flex-none basis-[80%] sm:basis-[50%] md:basis-[62%] pl-4 ` +
                  `transition-opacity duration-300 ${isCenter ? "opacity-100" : "opacity-50"}`
                }
              >
                <div
                  className={
                    `w-full max-w-[520px] rounded-xl overflow-hidden bg-white dark:bg-neutral-900 ` +
                    `box-border border border-[rgba(0,0,0,0.06)] transition-shadow transition-border ` +
                    `${isCenter ? "ring-4 ring-sky-200 shadow-[0_14px_36px_rgba(2,6,23,0.18)]" : ""}`
                  }
                  onClick={() => {
                    // only allow opening if center and not locked
                    if (isCenter && !locked) onOpen(p);
                  }}
                >
                  <div className="relative aspect-[11/9] md:aspect-[16/9] bg-gray-100">
                    {/* internal card carousel (auto-rotates every 3s) */}
                    <img
                      src={currentSrc}
                      alt={p.name}
                      className={`w-full h-full object-cover block transition-opacity duration-500 ${locked ? "filter blur-sm scale-[1.02]" : ""}`}
                      style={{ opacity: 1 }}
                    />

                    {/* LOCK overlay when project is locked */}
                    {locked ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
                        <div className="rounded-lg p-4 w-full max-w-[360px] text-center bg-white/60 dark:bg-black/50 backdrop-blur-md border border-[rgba(0,0,0,0.06)]">
                          <div className="flex flex-col items-center gap-2">
                            <div className="p-3 rounded-full bg-white/70 dark:bg-black/60 inline-flex">
                              <Lock className="w-10 h-10 text-neutral-800 dark:text-neutral-100" />
                            </div>
                            <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                              محتوای قفل شده
                            </div>
                            <div className="text-sm text-neutral-700 dark:text-neutral-300">
                              {p.lockReason
                                ? p.lockReason
                                : "برای باز کردن این بخش باید فصل قبلی کامل شود یا پرداخت انجام شود."}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      imgs.length > 1 ? (
                        <div className="absolute left-3 top-3 rounded-full p-1 bg-white/80 dark:bg-neutral-900/70 flex gap-1">
                          {imgs.map((_, j) => (
                            <span
                              key={j}
                              className={`w-1.5 h-1.5 rounded-full transition-all ${j === curIdx ? "scale-100 bg-green-600" : "opacity-30 bg-neutral-400"}`}
                            />
                          ))}
                        </div>
                      ) : null
                    )}

                    {/* Play button shown only when not locked */}
                    {!locked ? (
                      <div className="absolute right-3 bottom-3">
                        <button
                          onClick={() => {
                            if (!locked) onOpen(p);
                          }}
                          aria-label={`شروع ${p.name}`}
                          className="rounded-full p-2 inline-flex items-center justify-center shadow-md bg-green-600 text-white"
                        >
                          <Play className="w-6 h-6" />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className={`flex flex-col gap-3 mt-2 text-right p-3 ${isCenter ? "pointer-events-auto" : "pointer-events-none"}`}>
                    <div className="text-2xl md:text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
                      {p.name}
                    </div>
                    <div className="text-lg md:text-xl text-neutral-500 dark:text-neutral-400 mt-1">
                      {p.subtitle}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm md:text-lg text-neutral-500">
                      <div>پیشرفت: {Math.round(displayedProgress)}%</div>
                      <div className="text-neutral-400">{chapterText}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* dots */}
      <div className="mt-6 flex justify-center">
        <div className="flex flex-wrap justify-center items-center gap-3">
          {derivedProjects.map((_, idx) => (
            <DotButton
              key={idx}
              onClick={() => scrollToLogical(idx)}
              selected={idx === logicalSelected}
              aria-label={`برو به ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* select button */}
      <div className="mt-4 px-4">
        <button
          onClick={() => {
            const center = derivedProjects[logicalSelected];
            if (center && !center.isLock) onOpen(center);
          }}
          className="w-full py-3 rounded-xl text-center font-semibold bg-green-600 text-white shadow-lg"
          aria-label="انتخاب پروژه"
          aria-disabled={!!derivedProjects[logicalSelected]?.isLock}
        >
          انتخاب پروژه
        </button>
      </div>
    </div>
  );
};

export default EmblaIOSCarousel;
