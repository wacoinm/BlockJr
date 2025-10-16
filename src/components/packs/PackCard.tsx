// src/components/packs/PackCard.tsx
import React, { useEffect, useState } from "react";

/** map item key -> emoji (برای اطمینان از اینکه در همه محیط‌ها نمایش دارد) */
const ITEM_ICON: Record<string, string> = {
  "تله کابین": "🚠",
  "آسانسور": "🛗",
  "جرثقیل": "🏗️",
  "lift truck": "🚚",
  buildozer: "🚜",
  default: "🚗",
};

function pickEmoji(item: string) {
  return ITEM_ICON[item] ?? ITEM_ICON.default;
}

/** generate soft gradient based on id (light mode) */
function idToGradientLight(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1} 80% 72%), hsl(${h2} 80% 62%))`;
}

/** cheerful/different gradient for dark mode (not too dark, playful) */
function idToGradientDark(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 45) % 360;
  const c1 = `hsl(${h1} 65% 45%)`;
  const c2 = `hsl(${h2} 65% 38%)`;
  return `linear-gradient(135deg, ${c1}, ${c2})`;
}

/** determine whether dark mode is active (class-based or prefers-color-scheme) */
function detectDarkMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (document.documentElement.classList.contains("dark")) return true;
  } catch {}
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
  } catch {
    return false;
  }
}

const PackCard: React.FC<
  {
    id: string;
    name: string;
    description?: string;
    items: string[];
    qr?: string;
    big?: boolean;
    compactCarousel?: boolean;
    onOpen?: (id: string) => void;
  }
> = ({ id, name, description, items, qr, big, compactCarousel, onOpen }) => {
  const [isDark, setIsDark] = useState<boolean>(() => detectDarkMode());
  const [bg, setBg] = useState<string>(() => (detectDarkMode() ? idToGradientDark(id) : idToGradientLight(id)));

  useEffect(() => {
    setBg(isDark ? idToGradientDark(id) : idToGradientLight(id));
  }, [id, isDark]);

  useEffect(() => {
    // listen to prefers-color-scheme changes and also to class flipping if applicable
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent | MediaQueryList) => {
        // avoid mixing || and ?? in one expression; compute prefers explicitly
        const prefers = (e as any).matches ?? false;
        const classDark = document.documentElement.classList.contains("dark");
        setIsDark(classDark || prefers);
      };
      if (mq.addEventListener) mq.addEventListener("change", handler);
      else if (mq.addListener) mq.addListener(handler);

      // also observe class changes on <html> (in case dark mode toggled by class)
      const obs = new MutationObserver(() => {
        const classDark = document.documentElement.classList.contains("dark");
        const prefers = mq?.matches ?? false;
        setIsDark(classDark || prefers);
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

      return () => {
        try {
          if (mq) {
            if (mq.removeEventListener) mq.removeEventListener("change", handler);
            else if (mq.removeListener) mq.removeListener(handler);
          }
        } catch {}
        obs.disconnect();
      };
    } catch {
      // ignore
    }
  }, []);

  const style: React.CSSProperties = {
    background: bg,
  };

  return (
    <div
      className={`rounded-3xl p-4 shadow-xl text-right text-white ${big ? "h-full" : ""}`}
      style={style}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg md:text-xl font-bold">{name}</div>
          {description && <div className="text-sm opacity-90 mt-1">{description}</div>}
          <div className="mt-3 flex gap-2 flex-wrap">
            {items.map((it) => (
              <div key={it} className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs">
                <span className="text-sm">{pickEmoji(it)}</span>
                <span className="truncate max-w-[12rem]">{it}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 ml-2">
          <div className="w-16 h-16 rounded-xl bg-white/25 flex items-center justify-center text-2xl font-bold">
            {name.slice(0, 1)}
          </div>
          <button
            onClick={() => onOpen?.(id)}
            className="px-3 py-1 rounded-lg bg-white text-black text-sm"
            aria-label={`open-${id}`}
          >
            باز کن
          </button>
        </div>
      </div>

      <div className="mt-3 text-xs opacity-80 flex justify-between items-center">
        <div>QR: {qr ? qr.slice(0, 6) + "…" : "—"}</div>
        <div className="text-[11px]">آیتم‌ها: {items.length}</div>
      </div>
    </div>
  );
};

export default PackCard;
