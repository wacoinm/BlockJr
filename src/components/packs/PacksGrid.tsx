// src/components/packs/PacksGrid.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import PackCard from "./PackCard";

type Pack = {
  id: string;
  name: string;
  description?: string;
  items: string[];
  qr?: string;
};

const PacksGrid: React.FC<{ packs: Pack[]; view: "list" | "carousel" }> = ({ packs, view }) => {
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
          <PackCard key={p.id} {...p} big />
        ))}
      </div>
    );
  }

  return <EmblaInfiniteCarousel packs={packs} />;
};

export default PacksGrid;

/* ---------- Embla infinite carousel ---------- */

const EmblaInfiniteCarousel: React.FC<{ packs: Pack[] }> = ({ packs }) => {
  // options: loop always true when more than 1 item
  const options = useMemo(
    () => ({
      loop: packs.length > 1,
      align: "center",
      containScroll: "trimSnaps",
      skipSnaps: false,
    }),
    [packs.length]
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(options);
  const embla = emblaApi;

  const scrollPrev = useCallback(() => embla?.scrollPrev(), [embla]);
  const scrollNext = useCallback(() => embla?.scrollNext(), [embla]);

  // enable keyboard left/right
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
      <div ref={emblaRef} className="embla overflow-hidden">
        <div className="embla__container flex gap-4 px-4 py-6">
          {packs.map((p) => (
            <div key={p.id} className="embla__slide flex-shrink-0" style={{ minWidth: 300 }}>
              <PackCard {...p} big compactCarousel />
            </div>
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2">
        <button
          onClick={scrollPrev}
          aria-label="Previous pack"
          className="p-2 rounded-full bg-white/90 shadow dark:bg-[color:var(--card-dark)]"
        >
          ‹
        </button>
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <button
          onClick={scrollNext}
          aria-label="Next pack"
          className="p-2 rounded-full bg-white/90 shadow dark:bg-[color:var(--card-dark)]"
        >
          ›
        </button>
      </div>

      <style>{`
        /* small embla helpers (minimal CSS) */
        .embla__container { display: flex; align-items: stretch; }
        .embla__slide { scroll-snap-align: center; }
        .embla { -webkit-overflow-scrolling: touch; }
      `}</style>
    </div>
  );
};
