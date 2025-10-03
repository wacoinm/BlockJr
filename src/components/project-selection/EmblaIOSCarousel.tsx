// src/components/project-selection/EmblaIOSCarousel.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Play } from "lucide-react";
import { getSession } from "../../utils/sessionStorage";

type Checkpoint = { id: string; title?: string; locked?: boolean };
type Project = {
  id: string;
  name: string;
  subtitle?: string;
  img?: string;
  progress?: number;
  checkpoints?: Checkpoint[];
};

type DerivedProject = Project & {
  // overlays from session / discovered story
  sessionStep?: number | null;
  derivedProgress?: number;
  totalChapters?: number | null;
};

type Props = {
  projects: Project[];
  onOpen: (p: Project) => void;
  repeatCount?: number;
};

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
    () => projects.map((p) => ({ ...p, derivedProgress: p.progress ?? 0, totalChapters: p.checkpoints?.length ?? null }))
  );

  useEffect(() => {
    // initialize with defaults based on incoming projects
    setDerivedProjects(projects.map((p) => ({ ...p, derivedProgress: p.progress ?? 0, totalChapters: p.checkpoints?.length ?? null })));

    let mounted = true;

    (async () => {
      // for each project, read session and optionally try to infer total chapters from assets
      const next: DerivedProject[] = [];
      for (const p of projects) {
        const dp: DerivedProject = {
          ...p,
          derivedProgress: p.progress ?? 0,
          sessionStep: null,
          totalChapters: p.checkpoints?.length ?? null,
        };

        try {
          // read session (if exists) and use its progress/step
          const s = await getSession(p.id);
          if (!mounted) return;
          if (s) {
            dp.derivedProgress = typeof s.progress === "number" ? s.progress : dp.derivedProgress;
            dp.sessionStep = typeof s.step === "number" ? s.step : null;
          }
        } catch (err) {
          // ignore session read errors
          // eslint-disable-next-line no-console
          console.warn("EmblaIOSCarousel: getSession failed for", p.id, err);
        }

        // If we don't have totalChapters, attempt to dynamically import a story module at ../../assets/stories/<id>
        if (dp.totalChapters == null) {
          try {
            // dynamic import - may fail if there's no matching file; that's OK and expected for many projects
            // try heuristics: module may export named object (e.g. export const elevator = {...}) or default
            // attempt import; bundlers allow dynamic import but may not include every path — wrap in try/catch
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            // use import() so Vite/webpack handle it
            // note: this dynamic import may be tree-shaken away in some bundlers if not present — catch failures
            // Use relative path from this file to stories dir.
            // We silence TS error by using any.
            // eslint-disable-next-line no-await-in-loop
            const mod: any = await import(`../../assets/stories/${p.id}`).catch(() => null);
            if (mod) {
              // determine exported story object (named export or default)
              const storyObj = mod[p.id] ?? mod.default ?? mod.elevator ?? mod;
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

  const DotButton: React.FC<React.ComponentPropsWithRef<"button"> & { selected?: boolean }> = ({
    children,
    selected,
    ...rest
  }) => {
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
    <div
      className="max-w-[48rem] mx-auto"
      aria-roledescription="carousel"
    >
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

            // compute displayed values: progress uses session overlay if present
            const displayedProgress = typeof p.derivedProgress === "number" ? p.derivedProgress : p.progress ?? 0;
            const sessionStep = typeof p.sessionStep === "number" ? p.sessionStep : null;
            const totalChapters = typeof p.totalChapters === "number" ? p.totalChapters : (p.checkpoints?.length ?? null);

            // show text for مرحله: prefer "current / total" when sessionStep available
            const chapterText =
              sessionStep != null
                ? totalChapters != null
                  ? `${sessionStep}/${totalChapters} مرحله`
                  : `${sessionStep} مرحله`
                : totalChapters != null
                ? `${totalChapters} مرحله`
                : `${p.checkpoints?.length ?? 0} مرحله`;

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
                    if (isCenter) onOpen(p);
                  }}
                >
                  <div className="relative aspect-[11/9] md:aspect-[16/9] bg-gray-100">
                    <img
                      src={p.img}
                      alt={p.name}
                      className="w-full h-full object-cover block"
                    />
                    <div className="absolute right-3 bottom-3">
                      <button
                        onClick={() => onOpen(p)}
                        aria-label={`شروع ${p.name}`}
                        className="rounded-full p-2 inline-flex items-center justify-center shadow-md bg-green-600 text-white"
                      >
                        <Play className="w-6 h-6" />
                      </button>
                    </div>
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
            if (center) onOpen(center);
          }}
          className="w-full py-3 rounded-xl text-center font-semibold bg-green-600 text-white shadow-lg"
          aria-label="انتخاب پروژه"
        >
          انتخاب پروژه
        </button>
      </div>
    </div>
  );
};

export default EmblaIOSCarousel;
