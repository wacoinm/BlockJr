// src/components/project-selection/EmblaIOSCarousel.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Play } from "lucide-react";

/**
 * EmblaIOSCarousel (refined)
 * - center card scales only (neighbors remain normal)
 * - select button disabled during drag/scroll until carousel is settled
 * - responsive sizing and peek of neighbors on mobile (under md)
 * - prevents border overflow, uses embla events for reliable UX
 */

type Checkpoint = { id: string; title: string; locked?: boolean };
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
  projects: Project[];
  onOpen: (p: Project) => void;
};

const EmblaIOSCarousel: React.FC<Props> = ({ projects, onOpen }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    containScroll: "trimSnaps",
    skipSnaps: false,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettled, setIsSettled] = useState(true); // true when not moving and snap settled
  const progressRef = useRef(0);

  // Update selected index when Embla signals a select
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    // don't force-settled here — we rely on 'settle' event for final settled state
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    const handleScroll = () => {
      progressRef.current = emblaApi.scrollProgress();
      setIsSettled(false);
    };

    const handlePointerDown = () => {
      setIsDragging(true);
      setIsSettled(false);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      // settled state will be updated by 'settle' event
    };

    const handleSettle = () => {
      // embla finished animating to a snap
      setIsSettled(true);
      onSelect();
    };

    emblaApi.on("scroll", handleScroll);
    emblaApi.on("pointerDown", handlePointerDown);
    emblaApi.on("pointerUp", handlePointerUp);
    emblaApi.on("select", onSelect);
    emblaApi.on("settle", handleSettle);

    // initial select
    onSelect();

    return () => {
      emblaApi.off("scroll", handleScroll);
      emblaApi.off("pointerDown", handlePointerDown);
      emblaApi.off("pointerUp", handlePointerUp);
      emblaApi.off("select", onSelect);
      emblaApi.off("settle", handleSettle);
    };
  }, [emblaApi, onSelect]);

  // compute transform style for slide (center scales; others fixed)
  const computeStyle = (index: number) => {
    if (!emblaApi) {
      return {};
    }

    const snapList = emblaApi.scrollSnapList();
    const slidesCount = snapList.length || projects.length;
    const scrollProgress = emblaApi.scrollProgress(); // normalized
    const target = snapList[index] ?? 0;

    let diff = (scrollProgress - target) * slidesCount;
    if (diff > slidesCount / 2) diff -= slidesCount;
    if (diff < -slidesCount / 2) diff += slidesCount;

    const absDiff = Math.abs(diff);

    const CENTER_THRESHOLD = 0.45;

    const maxScale = 1.12;
    const minScale = 0.92;
    let scale = minScale;
    let translateY = 0;
    let opacity = 1;
    let zIndex = 10 - Math.round(absDiff * 10);

    if (absDiff <= CENTER_THRESHOLD) {
      const t = 1 - absDiff / CENTER_THRESHOLD; // 0..1
      scale = minScale + (maxScale - minScale) * t;
      translateY = -10 * t; // more lift for center
      opacity = 1;
      zIndex = 100;
    } else {
      scale = minScale;
      translateY = 0;
      opacity = Math.max(0.85, 1 - absDiff * 0.12);
      zIndex = Math.max(1, 10 - Math.round(absDiff * 6));
    }

    return {
      transform: `translateY(${translateY}px) scale(${scale})`,
      transition: "transform 260ms cubic-bezier(.22,.9,.32,1), opacity 260ms ease",
      zIndex,
      opacity,
    } as React.CSSProperties;
  };

  const centerProject = projects[selectedIndex] ?? projects[0];

  return (
    <div className="relative">
      {/* Embla viewport; ensure overflow hidden */}
      <div className="embla overflow-hidden" ref={emblaRef as any}>
        {/* container has padding so neighbors peek */}
        <div className="embla__container flex items-center gap-3 px-6">
          {projects.map((p, i) => {
            const isCenter = i === selectedIndex;
            const imgDesktop = p.img;
            const imgMobile = p.imgMobile ?? (p.img ? p.img.replace("800x600", "480x360") : undefined);
            return (
              <div
                key={p.id}
                className="embla__slide flex-shrink-0 px-1"
                style={{
                  minWidth: "68%", // mobile: show left/right peek
                  maxWidth: "420px",
                }}
              >
                <div
                  className="relative rounded-2xl overflow-hidden shadow-lg bg-white dark:bg-surface"
                  style={{
                    ...computeStyle(i),
                    border: isCenter ? "3px solid rgba(125,211,252,0.95)" : "1px solid rgba(0,0,0,0.06)",
                    boxShadow: isCenter ? "0 12px 28px rgba(2,6,23,0.16)" : undefined,
                    willChange: "transform, opacity, box-shadow",
                    boxSizing: "border-box",
                    // ensure the inner content doesn't overflow
                    maxWidth: "100%",
                    // apply brightness filter for non-center
                    filter: isCenter ? "brightness(1)" : "brightness(0.78) saturate(0.96)",
                  }}
                >
                  {/* image */}
                  <div className="relative aspect-[16/9] bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
                    <img
                      src={imgDesktop}
                      srcSet={imgMobile ? `${imgMobile} 480w, ${imgDesktop} 800w` : undefined}
                      sizes="(max-width: 640px) 70vw, 420px"
                      alt={p.name}
                      className="w-full h-full object-cover"
                      style={{ display: "block" }}
                    />
                    <div className="absolute right-3 bottom-3">
                      <button
                        onClick={() => {
                          if (!isSettled || isDragging) return;
                          onOpen(p);
                        }}
                        aria-label={`شروع ${p.name}`}
                        className={`rounded-full p-3 flex items-center justify-center shadow-lg ${
                          isCenter ? "bg-green-500 text-white" : "bg-white/90 text-gray-800"
                        }`}
                      >
                        <Play className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* content */}
                  <div className="p-4 text-right">
                    <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{p.name}</div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{p.subtitle}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-neutral-500">پیشرفت: {p.progress ?? 0}%</div>
                      <div className="text-xs text-neutral-400">{p.checkpoints?.length ?? 0} مرحله</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* nav overlay (left/right) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2">
        <button
          onClick={() => emblaApi?.scrollPrev()}
          aria-label="قبلی"
          className="pointer-events-auto bg-white/85 dark:bg-neutral-800/85 p-2 rounded-full shadow-md backdrop-blur-md hover:scale-105 transition-transform"
        >
          ‹
        </button>
        <button
          onClick={() => emblaApi?.scrollNext()}
          aria-label="بعدی"
          className="pointer-events-auto bg-white/85 dark:bg-neutral-800/85 p-2 rounded-full shadow-md backdrop-blur-md hover:scale-105 transition-transform"
        >
          ›
        </button>
      </div>

      {/* pagination dots */}
      <div className="mt-4 flex justify-center gap-2">
        {projects.map((_, idx) => (
          <button
            key={idx}
            onClick={() => emblaApi?.scrollTo(idx)}
            className={`w-2.5 h-2.5 rounded-full ${idx === selectedIndex ? "bg-sky-400" : "bg-neutral-300 dark:bg-neutral-700"}`}
            aria-label={`برو به ${idx + 1}`}
          />
        ))}
      </div>

      {/* BIG select button for mobile — disable while dragging/scrolling until settled */}
      <div className="mt-4 px-4">
        <button
          onClick={() => {
            if (!centerProject) return;
            if (isDragging || !isSettled) return; // disable action during drag/scroll
            onOpen(centerProject);
          }}
          disabled={!centerProject || isDragging || !isSettled}
          className={`w-full py-3 rounded-xl text-center font-semibold transition-all ${
            !centerProject || isDragging || !isSettled
              ? "bg-neutral-300 text-neutral-500 cursor-not-allowed"
              : "bg-green-600 text-white shadow-lg"
          }`}
          aria-label="انتخاب پروژه"
        >
          انتخاب پروژه
        </button>
      </div>
    </div>
  );
};

export default EmblaIOSCarousel;
