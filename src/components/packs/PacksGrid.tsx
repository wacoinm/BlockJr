// src/components/packs/PacksGrid.tsx
import React, { useCallback, useEffect, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import PackCard from "./PackCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Pack = {
  id: string;
  name: string;
  description?: string;
  items?: string[];
  qr?: string;
};

const PacksGrid: React.FC<{
  packs: Pack[];
  view: "list" | "carousel";
  onSelectPack?: (packId: string) => void;
}> = ({ packs, view, onSelectPack }) => {
  if (!packs || packs.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-surface dark:bg-[color:var(--card-dark)] text-center">
        هیچ پَکی یافت نشد — برای افزودن پَک از QR استفاده کنید.
      </div>
    );
  }

  if (view === "list") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {packs.map((p) => (
          <PackCard
            key={p.id}
            {...p}
            big
            onOpen={() => onSelectPack?.(p.id)}
          />
        ))}
      </div>
    );
  }

  return <EmblaInfiniteCarousel packs={packs} onSelectPack={onSelectPack} />;
};

export default PacksGrid;

/* ---------- Embla infinite carousel (robust looping + responsive) ---------- */

const EmblaInfiniteCarousel: React.FC<{
  packs: Pack[];
  onSelectPack?: (packId: string) => void;
}> = ({ packs, onSelectPack }) => {
  // slide width used for responsive sizing
  const slideWidthCss = "clamp(260px, 86vw, 380px)";

  const options = useMemo(
    () => ({
      loop: packs.length > 1,
      align: "center" as const,
      containScroll: false,
      skipSnaps: false,
      dragFree: false,
      slidesToScroll: 1,
      speed: 12,
    }),
    [packs.length]
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(options);
  const embla = emblaApi;

  const scrollPrev = useCallback(() => embla?.scrollPrev(), [embla]);
  const scrollNext = useCallback(() => embla?.scrollNext(), [embla]);

  useEffect(() => {
    if (!embla) return;
    requestAnimationFrame(() => {
      try {
        embla.reInit();
      } catch {}
    });

    let t: number | null = null;
    const onResize = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => embla.reInit(), 120);
    };
    window.addEventListener("resize", onResize);

    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [embla, packs.length]);

  useEffect(() => {
    if (!embla) return;
    const onPointerUp = () => embla.scrollTo(embla.selectedScrollSnap());
    embla.on("pointerUp", onPointerUp);
    return () => embla.off("pointerUp", onPointerUp);
  }, [embla]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") scrollPrev();
      else if (e.key === "ArrowRight") scrollNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scrollPrev, scrollNext]);

  return (
    <div className="relative">
      <div
        ref={emblaRef}
        className="embla overflow-hidden"
        style={{ boxSizing: "border-box", WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="embla__container flex gap-4"
          style={{
            alignItems: "stretch",
            paddingInline: `max(0px, calc((100vw - ${slideWidthCss}) / 2))`,
          }}
        >
          {packs.map((p) => (
            <div
              key={p.id}
              className="embla__slide"
              style={{
                flex: "0 0 auto",
                width: slideWidthCss,
                boxSizing: "border-box",
                scrollSnapAlign: "center",
              }}
            >
              <PackCard
                {...p}
                big
                compactCarousel
                onOpen={() => onSelectPack?.(p.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute left-1 top-1/2 -translate-y-1/2 z-20">
        <ChevronLeft
          onClick={scrollPrev}
          className="bg-white/90 dark:bg-[color:var(--card-dark)] p-2 rounded-full w-8 h-8 md:w-10 md:h-10"
        />
      </div>

      <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20">
        <ChevronRight
          onClick={scrollNext}
          className="p-2 rounded-full bg-white/90 shadow dark:bg-[color:var(--card-dark)] w-8 h-8 md:w-10 md:h-10"
        />
      </div>

      <style>{`
        .embla { scroll-snap-type: x mandatory; }
        .embla__container { display:flex; }
        .embla__slide { -webkit-overflow-scrolling: touch; }
      `}</style>
    </div>
  );
};
