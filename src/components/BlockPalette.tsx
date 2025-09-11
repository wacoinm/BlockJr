// src/components/BlockPalette.tsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import { BlockComponent } from "./BlockComponent";
import { Block } from "../types/Block";
import { ChevronDown } from "lucide-react";

interface BlockPaletteProps {
  onBlockDrag: (
    block: Block,
    event: React.MouseEvent | React.TouchEvent | React.DragEvent
  ) => void;
}

const paletteBlocks: Block[] = [
  { id: "up-template", type: "up", x: 0, y: 0, parentId: null, childId: null },
  { id: "down-template", type: "down", x: 0, y: 0, parentId: null, childId: null },
  { id: "forward-template", type: "forward", x: 0, y: 0, parentId: null, childId: null },
  { id: "backward-template", type: "backward", x: 0, y: 0, parentId: null, childId: null },
  { id: "clockwise-template", type: "clockwise", x: 0, y: 0, parentId: null, childId: null },
  { id: "countclockwise-template", type: "countclockwise", x: 0, y: 0, parentId: null, childId: null },
  { id: "delay-template", type: "delay", value: 1, x: 0, y: 0, parentId: null, childId: null },
  { id: "green-flag-template", type: "green-flag", x: 0, y: 0, parentId: null, childId: null },
];

export const BlockPalette: React.FC<BlockPaletteProps> = ({ onBlockDrag }) => {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const paletteRef = useRef<HTMLDivElement | null>(null);
  const [paletteHeight, setPaletteHeight] = useState<number>(0);

  const TOGGLE_WIDTH = 34;

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

  useEffect(() => {
    return () => {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
    };
  }, []);

  const handlePressStart = (
    block: Block,
    e: React.MouseEvent | React.TouchEvent
  ) => {
    // long-press (200ms) to start drag for mobile
    e.persist?.();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      onBlockDrag(block, e);
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

  const paletteTransform = isOpen
    ? "translateY(0)"
    : `translateY(calc(100% - ${TOGGLE_WIDTH}px))`;

  const paletteTransition = "transform 380ms cubic-bezier(.2,.9,.2,1)";

  return (
    <>
      {/* Toggle button */}
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

      {/* Palette container */}
      <div
        className={
          "fixed left-0 bottom-0 w-full z-40 bg-white dark:bg-slate-900 " +
          "shadow-inner border-t border-gray-200 dark:border-slate-700 " +
          "md:top-4 md:bottom-auto md:left-0 md:right-0 md:w-full " +
          "md:flex md:items-center md:justify-center md:shadow-lg"
        }
        style={{
          transform: paletteTransform,
          transition: paletteTransition,
          paddingLeft: TOGGLE_WIDTH + 8,
        }}
      >
        <div
          ref={paletteRef}
          className={
            "flex overflow-x-auto overflow-y-hidden px-6 py-2 space-x-4 items-center " +
            "xs:justify-center " +
            "md:overflow-visible md:px-4 md:py-3 md:space-x-6 md:justify-center"
          }
          style={{
            willChange: "transform, opacity",
          }}
        >
          {paletteBlocks.map((block, idx) => {
            const baseDelay = 40;
            const openDelay = idx * baseDelay;
            const closeDelay = (paletteBlocks.length - idx) * 28;
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
        </div>
      </div>
    </>
  );
};

export default BlockPalette;
