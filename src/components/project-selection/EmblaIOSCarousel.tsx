// src/components/project-selection/EmblaIOSCarousel.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Play } from "lucide-react";
import "./embla.css";

type Checkpoint = { id: string; title: string; locked?: boolean };
type Project = {
  id: string;
  name: string;
  subtitle?: string;
  img?: string;
  progress?: number;
  checkpoints?: Checkpoint[];
};

type Props = {
  projects: Project[];
  onOpen: (p: Project) => void;
  repeatCount?: number; // kept for compatibility if callers pass it (not used)
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

  // absolute selected snap index (0..n-1)
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // sync selection with embla
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

  const logicalSelected = projectCount ? ((selectedIndex % projectCount) + projectCount) % projectCount : 0;

  const DotButton: React.FC<React.ComponentPropsWithRef<"button">> = (props) => {
    const { children, ...rest } = props;
    return <button type="button" {...rest}>{children}</button>;
  };

  return (
    <div className="embla" aria-roledescription="carousel">
      <div className="embla__viewport" ref={emblaRef as any}>
        <div className="embla__container">
          {projects.map((p, i) => {
            // add `is-selected` on the slide element for CSS-only opacity control
            const isCenter = i === logicalSelected;
            return (
              <div
                className={`embla__slide ${isCenter ? "is-selected" : ""}`}
                key={`${p.id}-${i}`}
                aria-hidden={!isCenter}
              >
                <div className={`embla-card ${isCenter ? "embla__card--center" : ""}`}>
                  <div className="embla-card__media">
                    <img src={p.img} alt={p.name} className="embla-card__img" />
                    <div className="embla-card__play">
                      <button
                        onClick={() => onOpen(p)}
                        aria-label={`شروع ${p.name}`}
                        className="embla-card__play-btn"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="embla-card__body text-right p-3">
                    <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{p.name}</div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{p.subtitle}</div>
                    <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                      <div>پیشرفت: {p.progress ?? 0}%</div>
                      <div className="text-neutral-400">{p.checkpoints?.length ?? 0} مرحله</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="embla__controls embla__controls--no-buttons">
        <div className="embla__dots embla__dots--center">
          {projects.map((_, idx) => (
            <DotButton
              key={idx}
              onClick={() => scrollToLogical(idx)}
              className={`embla__dot`.concat(idx === logicalSelected ? " embla__dot--selected" : "")}
              aria-label={`برو به ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 px-4">
        <button
          onClick={() => {
            const center = projects[logicalSelected];
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
