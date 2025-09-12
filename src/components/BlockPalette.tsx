// src/components/BlockPalette.tsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import { BlockComponent } from "./BlockComponent";
import { Block } from "../types/Block";
import { ChevronDown, ListFilter, Move, Wrench } from "lucide-react";

interface BlockPaletteProps {
  onBlockDrag: (
    block: Block,
    event: React.MouseEvent | React.TouchEvent | React.DragEvent
  ) => void;
  selectedProject?: string | null;
}

// Palette blocks (all blocks are present here)
const paletteBlocks: Block[] = [
  { id: "up-template", type: "up", x: 0, y: 0, parentId: null, childId: null },
  { id: "down-template", type: "down", x: 0, y: 0, parentId: null, childId: null },
  { id: "forward-template", type: "forward", x: 0, y: 0, parentId: null, childId: null },
  { id: "backward-template", type: "backward", x: 0, y: 0, parentId: null, childId: null },
  { id: "clockwise-template", type: "clockwise", x: 0, y: 0, parentId: null, childId: null },
  { id: "countclockwise-template", type: "countclockwise", x: 0, y: 0, parentId: null, childId: null },
  { id: "delay-template", type: "delay", value: 1, x: 0, y: 0, parentId: null, childId: null },
  { id: "green-flag-template", type: "green-flag", x: 0, y: 0, parentId: null, childId: null },
  { id: "lamp-on-template", type: "lamp-on", x: 0, y: 0, parentId: null, childId: null },
  { id: "lamp-off-template", type: "lamp-off", x: 0, y: 0, parentId: null, childId: null },
  { id: "speed-low-template", type: "speed-low", x: 0, y: 0, parentId: null, childId: null },
  { id: "speed-high-template", type: "speed-high", x: 0, y: 0, parentId: null, childId: null },
];

export const BlockPalette: React.FC<BlockPaletteProps> = ({ onBlockDrag, selectedProject }) => {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const [paletteHeight, setPaletteHeight] = useState<number>(0);

  const TOGGLE_WIDTH = 34;
  const [isOpen, setIsOpen] = useState<boolean>(true);

  // animation timing constants
  const PALETTE_TRANSITION_MS = 380;
  const PALETTE_BUFFER_MS = 60;

  // Project -> types mapping
  const projectMap: Record<string, string[]> = {
    elevator: ["green-flag", "up", "down", "delay"],
    bulldozer: ["green-flag", "forward", "backward", "clockwise", "countclockwise", "delay"],
    "lift truck": ["green-flag", "forward", "backward", "clockwise", "countclockwise", "up", "down", "delay"],
  };

  const alwaysInclude = ["speed-low", "speed-high", "lamp-on", "lamp-off"];

  // helper map type -> block for quick lookup
  const typeMap: Record<string, Block> = {};
  for (const b of paletteBlocks) {
    typeMap[b.type] = b;
  }

  const computeTypesForProject = (proj?: string | null): string[] => {
    const allTypes = paletteBlocks.map((b) => b.type);

    if (proj && projectMap[proj]) {
      // project-specific ordering, but ensure alwaysInclude are appended once
      return Array.from(new Set([...(projectMap[proj] || []), ...alwaysInclude]));
    } else if (proj && typeof proj === "string") {
      // project string provided but not in map => show everything (but keep alwaysInclude present)
      const unique = Array.from(new Set([...allTypes.filter((t) => !alwaysInclude.includes(t)), ...alwaysInclude]));
      return unique;
    } else {
      // no project selected: show all types (original order)
      return allTypes;
    }
  };

  // Category config
  type Category = "all" | "moves" | "utils";
  const [category, setCategory] = useState<Category>("all");

  const categorySets: Record<Category, Set<string>> = {
    all: new Set(paletteBlocks.map((b) => b.type)),
    moves: new Set(["forward", "backward", "clockwise", "countclockwise", "up", "down"]),
    utils: new Set(["delay", "speed-low", "speed-high", "lamp-on", "lamp-off"]),
  };

  const applyCategoryFilter = (types: string[], cat: Category): string[] => {
    if (cat === "all") return types;
    const allowed = categorySets[cat];
    return types.filter((t) => allowed.has(t));
  };

  // projectTypes: result of project filtering & ordering
  const [projectTypes, setProjectTypes] = useState<string[]>(() => computeTypesForProject(selectedProject));
  // displayedTypes: projectTypes after category filter (what is actually shown)
  const [displayedTypes, setDisplayedTypes] = useState<string[]>(
    () => applyCategoryFilter(computeTypesForProject(selectedProject), category)
  );

  // Measure palette height so toggle button and chooser can match it
  useEffect(() => {
    const measure = () => {
      if (paletteRef.current) {
        setPaletteHeight(paletteRef.current.offsetHeight);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (swapTimer.current) clearTimeout(swapTimer.current);
    };
  }, []);

  // If selectedProject changes, animate palette close, swap types, then open
  useEffect(() => {
    const nextProjectTypes = computeTypesForProject(selectedProject);

    const equal =
      nextProjectTypes.length === projectTypes.length &&
      nextProjectTypes.every((t, i) => t === projectTypes[i]);
    if (equal) return;

    // close palette, swap array after transition, then open
    setIsOpen(false);
    if (swapTimer.current) clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(() => {
      swapTimer.current = null;
      setProjectTypes(nextProjectTypes);
      // after project types updated, also update displayed types according to current category
      const nextDisplayed = applyCategoryFilter(nextProjectTypes, category);
      setDisplayedTypes(nextDisplayed);
      // ensure the re-open animation runs in the next frame
      requestAnimationFrame(() => setIsOpen(true));
    }, PALETTE_TRANSITION_MS + PALETTE_BUFFER_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  // If category changes, animate palette close, swap displayed types, then open
  useEffect(() => {
    const nextDisplayed = applyCategoryFilter(projectTypes, category);

    const equal =
      nextDisplayed.length === displayedTypes.length &&
      nextDisplayed.every((t, i) => t === displayedTypes[i]);
    if (equal) return;

    setIsOpen(false);
    if (swapTimer.current) clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(() => {
      swapTimer.current = null;
      setDisplayedTypes(nextDisplayed);
      requestAnimationFrame(() => setIsOpen(true));
    }, PALETTE_TRANSITION_MS + PALETTE_BUFFER_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const handlePressStart = (block: Block, e: React.MouseEvent | React.TouchEvent) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    // small hold delay to start drag
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      onBlockDrag(block, e as any);
    }, 200);
  };

  const handlePressEnd = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const toggleOpen = useCallback(() => {
    setIsOpen((s) => !s);
  }, []);

  const setCategoryAndAnimate = (cat: Category) => {
    // clicking same category does nothing
    if (cat === category) return;
    setCategory(cat);
  };

  const paletteTransform = isOpen ? "translateY(0)" : `translateY(calc(100% - ${TOGGLE_WIDTH}px))`;
  const paletteTransition = `transform ${PALETTE_TRANSITION_MS}ms cubic-bezier(.2,.9,.2,1)`;

  // Build filtered blocks in the order of displayedTypes
  const filteredBlocks: Block[] = displayedTypes
    .map((t) => typeMap[t])
    .filter((b): b is Block => !!b);

  // small helper for icon button styles
  const iconBtnBase =
    "inline-flex items-center justify-center w-8 h-8 rounded-md cursor-pointer select-none transition-transform active:scale-95";
  const iconSelectedInner = "rounded-md px-1.5 py-1";
  const iconUnselectedInner = "";

  // compute chooser bottom offset so it sits just above the palette
  // when palette is open: place chooser above paletteHeight + 12
  // when palette is closed: place chooser above the visible toggle area (approx TOGGLE_WIDTH) + 12
  const chooserBottom = isOpen ? (paletteHeight ? paletteHeight + 12 : 84) : TOGGLE_WIDTH + 12;

  return (
    <>
      {/* Toggle button (left) */}
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close palette" : "Open palette"}
        onClick={toggleOpen}
        className="fixed left-0 bottom-0 z-50 focus:outline-none"
        style={{
          height: paletteHeight || 72,
          width: TOGGLE_WIDTH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="flex items-center justify-center rounded-r-md shadow-sm 
                     bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
          style={{
            width: TOGGLE_WIDTH - 8,
            height: (paletteHeight || 72) - 12,
            backdropFilter: "blur(6px)",
            boxShadow: "0 6px 20px rgba(2,6,23,0.08)",
            transition: "transform 260ms cubic-bezier(.2,.9,.2,1), background 200ms",
          }}
        >
          <ChevronDown
            size={18}
            className="text-slate-900 dark:text-slate-100 transition-transform duration-300"
            style={{
              transform: `rotate(${isOpen ? 0 : 180}deg)`,
            }}
          />
        </div>
      </button>

      {/* Category chooser - OUTSIDE palette with full border & bg */}
      <div
        aria-label="Palette category chooser"
        role="tablist"
        style={{
          position: "fixed",
          right: 5,
          bottom: chooserBottom - 8,
          zIndex: 60,
        }}
      >
        <div
          className={
            "flex items-center space-x-2 px-3 py-2 rounded-lg shadow-sm " +
            "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
          }
          style={{
            minWidth: 120,
            // subtle backdrop blur for nicer look on some UIs
            backdropFilter: "blur(6px)",
          }}
        >
          {/* All */}
          <button
            aria-pressed={category === "all"}
            title="All"
            onClick={() => setCategoryAndAnimate("all")}
            className={
              iconBtnBase +
              " " +
              (category === "all" ? "bg-slate-100 dark:bg-slate-700" : "bg-transparent")
            }
            style={{
              borderRadius: 10,
              padding: 6,
            }}
          >
            <ListFilter
              size={16}
              className={category === "all" ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}
            />
          </button>

          {/* Moves */}
          <button
            aria-pressed={category === "moves"}
            title="Moves"
            onClick={() => setCategoryAndAnimate("moves")}
            className={
              iconBtnBase +
              " " +
              (category === "moves" ? "bg-slate-100 dark:bg-slate-700" : "bg-transparent")
            }
            style={{
              borderRadius: 10,
              padding: 6,
            }}
          >
            <Move
              size={16}
              className={category === "moves" ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}
            />
          </button>

          {/* Utils */}
          <button
            aria-pressed={category === "utils"}
            title="Utils"
            onClick={() => setCategoryAndAnimate("utils")}
            className={
              iconBtnBase +
              " " +
              (category === "utils" ? "bg-slate-100 dark:bg-slate-700" : "bg-transparent")
            }
            style={{
              borderRadius: 10,
              padding: 6,
            }}
          >
            <Wrench
              size={16}
              className={category === "utils" ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}
            />
          </button>
        </div>
      </div>

      {/* Palette container */}
      <div
        className={
          "fixed left-0 bottom-0 w-full z-40 bg-white dark:bg-slate-900 " +
          "shadow-inner border-t border-gray-200 dark:border-slate-700 " +
          "md:top-4 md:bottom-auto md:left-0 md:right-0 md:w-full md:shadow-lg"
        }
        style={{
          transform: paletteTransform,
          transition: paletteTransition,
        }}
      >
        {/* 
          Inner scroll area:
          - always allow horizontal scrolling (overflow-x-auto) on all sizes including desktop
          - add extra left/right padding so blocks can scroll partially into view
          - keep items inline with flex, and prevent wrapping
        */}
        <div
          ref={paletteRef}
          className={
            "flex overflow-x-auto overflow-y-hidden px-6 py-2 space-x-4 items-center " +
            "xs:justify-start md:justify-start ml-1"
          }
          style={{
            // Add extra horizontal padding so user can scroll blocks slightly off-edge.
            // Adjust values if you want more/less 'peek' space.
            paddingLeft: 18,
            paddingRight: 18,
            // ensure touch scrolling is smooth
            WebkitOverflowScrolling: "touch" as any,
            position: "relative",
            whiteSpace: "nowrap", // ensure one row
          }}
        >
          <div style={{ minWidth: 8 }} />
          {filteredBlocks.map((block, idx) => {
            const baseDelay = 40;
            const openDelay = idx * baseDelay;
            const closeDelay = (filteredBlocks.length - idx) * 28;
            const appliedDelay = isOpen ? openDelay : closeDelay;

            const scale = isOpen ? 1 : 0.62;
            const opacity = isOpen ? 1 : 0;
            const translateY = isOpen ? "0px" : "6px";

            return (
              <div
                key={block.id}
                className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
                onMouseDown={(e) => handlePressStart(block, e)}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onTouchStart={(e) => handlePressStart(block, e)}
                onTouchEnd={handlePressEnd}
                onTouchCancel={handlePressEnd}
                style={{
                  transitionProperty: "transform, opacity",
                  transitionDuration: "360ms",
                  transitionTimingFunction: "cubic-bezier(.2,.9,.2,1)",
                  transitionDelay: `${appliedDelay}ms`,
                  transform: `translateY(${translateY}) scale(${scale})`,
                  opacity,
                  willChange: "transform, opacity",
                }}
              >
                <BlockComponent
                  block={block}
                  isPaletteBlock
                  style={{ width: 64, height: 64 }}
                />
              </div>
            );
          })}
          <div style={{ minWidth: 8 }} />
        </div>
      </div>
    </>
  );
};

export default BlockPalette;
