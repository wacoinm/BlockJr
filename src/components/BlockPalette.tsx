// src/components/BlockPalette.tsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import { BlockComponent } from "./BlockComponent";
import { Block } from "../types/Block";
import { ChevronDown, ListFilter, Move, Wrench } from "lucide-react";
import { useAppSelector } from "../store/hooks";
import type { RootState } from "../store";

interface BlockPaletteProps {
  onBlockDrag?: (
    block: Block,
    event: React.MouseEvent | React.TouchEvent | React.DragEvent
  ) => void;
  selectedProject?: string | null;
}

// Palette blocks (all blocks are present here)
const paletteBlocks: Block[] = [
  { id: "up-template", type: "up", x: 0, y: 0, parentId: null, childId: null },
  {
    id: "down-template",
    type: "down",
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
  {
    id: "forward-template",
    type: "forward",
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
  {
    id: "backward-template",
    type: "backward",
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
  {
    id: "clockwise-template",
    type: "clockwise",
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
  {
    id: "countclockwise-template",
    type: "countclockwise",
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
  {
    id: "delay-template",
    type: "delay",
    value: 1,
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
  {
    id: "green-flag-template",
    type: "green-flag",
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
  {
    id: "lamp-on-template",
    type: "lamp-on",
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
  {
    id: "lamp-off-template",
    type: "lamp-off",
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
  {
    id: "speed-low-template",
    type: "speed-low",
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
  {
    id: "speed-high-template",
    type: "speed-high",
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
];

export const BlockPalette: React.FC<BlockPaletteProps> = ({
  onBlockDrag,
  selectedProject: selectedProjectProp,
}) => {
  // ALWAYS call hooks at top (avoid conditional hooks)
  const reduxSelectedProject = useAppSelector((s: RootState) =>
    s.projects ? s.projects.selectedProject : null
  );

  // prefer prop, else redux
  const selectedProject =
    typeof selectedProjectProp !== "undefined"
      ? selectedProjectProp
      : reduxSelectedProject ?? null;

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const [paletteHeight, setPaletteHeight] = useState<number>(0);

  // New refs for press / move handling
  const pointerStartY = useRef<number | null>(null);
  const activeBlockRef = useRef<Block | null>(null);
  const holdArmedRef = useRef<boolean>(false); // set true after hold timer fires
  const dragStartedRef = useRef<boolean>(false); // set true once onBlockDrag is called
  const movedTooFarBeforeHoldRef = useRef<boolean>(false); // cancel if user moves before hold completes

  const TOGGLE_WIDTH = 34;
  const [isOpen, setIsOpen] = useState<boolean>(true);

  // animation timing constants
  const PALETTE_TRANSITION_MS = 380;
  const PALETTE_BUFFER_MS = 60;

  // Project -> types mapping
  const projectMap: Record<string, string[]> = {
    elevator: ["green-flag", "up", "down", "delay"],
    bulldozer: [
      "green-flag",
      "forward",
      "backward",
      "clockwise",
      "countclockwise",
      "delay",
    ],
    "lift truck": [
      "green-flag",
      "forward",
      "backward",
      "clockwise",
      "countclockwise",
      "up",
      "down",
      "delay",
    ],
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
      return Array.from(
        new Set([...(projectMap[proj] || []), ...alwaysInclude])
      );
    } else if (proj && typeof proj === "string") {
      // project string provided but not in map => show everything (but keep alwaysInclude present)
      const unique = Array.from(
        new Set([
          ...allTypes.filter((t) => !alwaysInclude.includes(t)),
          ...alwaysInclude,
        ])
      );
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
    moves: new Set([
      "forward",
      "backward",
      "clockwise",
      "countclockwise",
      "up",
      "down",
    ]),
    utils: new Set(["delay", "speed-low", "speed-high", "lamp-on", "lamp-off"]),
  };

  const applyCategoryFilter = (types: string[], cat: Category): string[] => {
    if (cat === "all") return types;
    const allowed = categorySets[cat];
    return types.filter((t) => allowed.has(t));
  };

  // projectTypes: result of project filtering & ordering
  const [projectTypes, setProjectTypes] = useState<string[]>(() =>
    computeTypesForProject(selectedProject)
  );
  // displayedTypes: projectTypes after category filter (what is actually shown)
  const [displayedTypes, setDisplayedTypes] = useState<string[]>(() =>
    applyCategoryFilter(computeTypesForProject(selectedProject), category)
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
      removeDocumentListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ---------- New logic: hold -> only start drag once pointer moves above palette ----------
  // thresholds
  const HOLD_MS = 10;
  const MOVE_CANCEL_THRESHOLD = 8; // px: if moved this much before hold fires, cancel hold
  const START_DRAG_OFFSET = 10; // px above palette top to start actual drag

  // Helper: remove document listeners
  const removeDocumentListeners = () => {
    document.removeEventListener("touchmove", onDocumentTouchMove as any, {
      passive: false,
    });
    document.removeEventListener("touchend", onDocumentTouchEnd as any);
    document.removeEventListener("touchcancel", onDocumentTouchEnd as any);
    document.removeEventListener("mousemove", onDocumentMouseMove as any);
    document.removeEventListener("mouseup", onDocumentMouseUp as any);
  };

  // Document-level handlers to observe pointer movement while holding
  function onDocumentTouchMove(ev: TouchEvent) {
    if (!ev.touches || ev.touches.length === 0) return;
    const touch = ev.touches[0];
    const y = touch.clientY;
    const startY = pointerStartY.current;
    if (startY == null) return;

    // If hold not yet armed, cancel if moved too far (user is likely scrolling)
    if (!holdArmedRef.current) {
      if (Math.abs(y - startY) > MOVE_CANCEL_THRESHOLD) {
        movedTooFarBeforeHoldRef.current = true;
        if (holdTimer.current) {
          clearTimeout(holdTimer.current);
          holdTimer.current = null;
        }
        removeDocumentListeners();
      }
      return;
    }

    // If hold is armed but drag hasn't started: check if pointer moved above palette top to start drag
    if (holdArmedRef.current && !dragStartedRef.current) {
      const paletteTop =
        paletteRef.current?.getBoundingClientRect().top ?? Infinity;
      if (y < paletteTop - START_DRAG_OFFSET) {
        // start drag: call onBlockDrag with a synthetic React.TouchEvent wrapper if needed
        dragStartedRef.current = true;
        const synthetic = ev as unknown as React.TouchEvent;
        if (activeBlockRef.current) {
          (onBlockDrag ?? (() => {}))(activeBlockRef.current, synthetic);
        }
        // we can keep listening until touchend so parent can manage actual drag moves
      }
    }
  }

  function onDocumentTouchEnd(_ev: TouchEvent) {
    // reset everything
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdArmedRef.current = false;
    dragStartedRef.current = false;
    movedTooFarBeforeHoldRef.current = false;
    pointerStartY.current = null;
    activeBlockRef.current = null;
    removeDocumentListeners();
  }

  function onDocumentMouseMove(ev: MouseEvent) {
    const y = ev.clientY;
    const startY = pointerStartY.current;
    if (startY == null) return;

    if (!holdArmedRef.current) {
      if (Math.abs(y - startY) > MOVE_CANCEL_THRESHOLD) {
        movedTooFarBeforeHoldRef.current = true;
        if (holdTimer.current) {
          clearTimeout(holdTimer.current);
          holdTimer.current = null;
        }
        removeDocumentListeners();
      }
      return;
    }

    if (holdArmedRef.current && !dragStartedRef.current) {
      const paletteTop =
        paletteRef.current?.getBoundingClientRect().top ?? Infinity;
      if (y < paletteTop - START_DRAG_OFFSET) {
        dragStartedRef.current = true;
        const synthetic = ev as unknown as React.MouseEvent;
        if (activeBlockRef.current) {
          (onBlockDrag ?? (() => {}))(activeBlockRef.current, synthetic);
        }
      }
    }
  }

  function onDocumentMouseUp(_ev: MouseEvent) {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdArmedRef.current = false;
    dragStartedRef.current = false;
    movedTooFarBeforeHoldRef.current = false;
    pointerStartY.current = null;
    activeBlockRef.current = null;
    removeDocumentListeners();
  }

  // Start press (mouse or touch)
  const handlePressStart = (
    block: Block,
    e: React.MouseEvent | React.TouchEvent
  ) => {
    // store active block (we will only trigger onBlockDrag if pointer moves above palette after hold)
    activeBlockRef.current = block;
    movedTooFarBeforeHoldRef.current = false;
    dragStartedRef.current = false;
    holdArmedRef.current = false;

    // extract startY
    let clientY: number | null = null;
    if ("touches" in e && e.touches && e.touches.length > 0) {
      clientY = e.touches[0].clientY;
    } else if ("clientY" in e) {
      clientY = (e as React.MouseEvent).clientY;
    }
    pointerStartY.current = clientY;

    // attach document listeners (so we can observe movement even if pointer leaves element)
    document.addEventListener("touchmove", onDocumentTouchMove as any, {
      passive: false,
    });
    document.addEventListener("touchend", onDocumentTouchEnd as any);
    document.addEventListener("touchcancel", onDocumentTouchEnd as any);
    document.addEventListener("mousemove", onDocumentMouseMove as any);
    document.addEventListener("mouseup", onDocumentMouseUp as any);

    // start hold timer -> after HOLD_MS we set holdArmedRef to true.
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
    }
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      // Only arm the hold if the pointer hasn't moved away before hold completed
      if (!movedTooFarBeforeHoldRef.current) {
        holdArmedRef.current = true;
        // Note: we DO NOT call onBlockDrag here. We wait until user moves the pointer above paletteTop.
      } else {
        // moved too far before hold; treat as cancellation
        holdArmedRef.current = false;
        // cleanup will occur from the move handlers or end handlers
      }
    }, HOLD_MS);
  };

  // End press (mouse or touch)
  const handlePressEnd = () => {
    // cancel any pending hold
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    // if drag already started, let parent handle mouseup/touchend for actual drop handling, but reset here as well
    holdArmedRef.current = false;
    dragStartedRef.current = false;
    movedTooFarBeforeHoldRef.current = false;
    pointerStartY.current = null;
    activeBlockRef.current = null;
    removeDocumentListeners();
  };

  const toggleOpen = useCallback(() => {
    setIsOpen((s) => !s);
  }, []);

  const setCategoryAndAnimate = (cat: Category) => {
    // clicking same category does nothing
    if (cat === category) return;
    setCategory(cat);
  };

  const paletteTransform = isOpen
    ? "translateY(0)"
    : `translateY(calc(100% - ${TOGGLE_WIDTH}px))`;
  const paletteTransition = `transform ${PALETTE_TRANSITION_MS}ms cubic-bezier(.2,.9,.2,1)`;

  // Build filtered blocks in the order of displayedTypes
  const filteredBlocks: Block[] = displayedTypes
    .map((t) => typeMap[t])
    .filter((b): b is Block => !!b);

  // small helper for icon button styles
  const iconBtnBase =
    "inline-flex items-center justify-center w-8 h-8 rounded-md cursor-pointer select-none transition-transform active:scale-95";
  // compute chooser bottom offset so it sits just above the palette
  const chooserBottom = isOpen
    ? paletteHeight
      ? paletteHeight + 12
      : 84
    : TOGGLE_WIDTH + 12;

  return (
    <>
      {/* Toggle button (left) */}
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close palette" : "Open palette"}
        onClick={toggleOpen}
        className="fixed left-0 [bottom:calc(0px+var(--safe-area-inset-bottom))] z-50 focus:outline-none"
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
            transition:
              "transform 260ms cubic-bezier(.2,.9,.2,1), background 200ms",
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
          bottom: `calc(${chooserBottom - 4}px + var(--safe-area-inset-bottom))`,
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
              (category === "all"
                ? "bg-slate-100 dark:bg-slate-700"
                : "bg-transparent")
            }
            style={{
              borderRadius: 10,
              padding: 6,
            }}
          >
            <ListFilter
              size={16}
              className={
                category === "all"
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400"
              }
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
              (category === "moves"
                ? "bg-slate-100 dark:bg-slate-700"
                : "bg-transparent")
            }
            style={{
              borderRadius: 10,
              padding: 6,
            }}
          >
            <Move
              size={16}
              className={
                category === "moves"
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400"
              }
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
              (category === "utils"
                ? "bg-slate-100 dark:bg-slate-700"
                : "bg-transparent")
            }
            style={{
              borderRadius: 10,
              padding: 6,
            }}
          >
            <Wrench
              size={16}
              className={
                category === "utils"
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400"
              }
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
        <div
          ref={paletteRef}
          className={
            "flex overflow-x-auto overflow-y-hidden px-6 py-2 space-x-4 items-center " +
            "xs:justify-start md:justify-start ml-1 mb-[calc(0.2rem+var(--safe-area-inset-bottom))]"
          }
          style={{
            paddingLeft: 18,
            paddingRight: 18,
            WebkitOverflowScrolling: "touch" as any,
            position: "relative",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ minWidth: 8, marginBottom: `calc(4rem + var(--safe-area-inset-bottom))` }}  />
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
