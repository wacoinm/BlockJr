import React, { useRef, useEffect } from "react";
import { BlockComponent } from "./BlockComponent";
import { Block } from "../types/Block";

interface BlockPaletteProps {
  onBlockDrag: (
    block: Block,
    event: React.MouseEvent | React.TouchEvent | React.DragEvent
  ) => void;
}

const paletteBlocks: Block[] = [
  { id: "up-template", type: "up", x: 0, y: 0, parentId: null, childId: null },
  { id: "down-template", type: "down", x: 0, y: 0, parentId: null, childId: null },
  { id: "delay-template", type: "delay", value: 1, x: 0, y: 0, parentId: null, childId: null },
  { id: "green-flag-template", type: "green-flag", x: 0, y: 0, parentId: null, childId: null },
];

export const BlockPalette: React.FC<BlockPaletteProps> = ({ onBlockDrag }) => {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    e.persist?.();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      onBlockDrag(block, e as any);
    }, 400);
  };

  const handlePressEnd = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  return (
    <div
      className={
        // mobile-first: fixed bottom bar
        "fixed left-0 bottom-0 w-full z-40 bg-white shadow-inner border-t border-gray-200 " +
        // desktop overrides
        "md:top-4 md:bottom-auto md:left-0 md:right-0 md:w-full md:flex md:items-center md:justify-center md:shadow-lg"
      }
    >
      <div
        className={
          // base mobile: horizontal scroll, left aligned
          "flex overflow-x-auto overflow-y-hidden px-6 py-2 space-x-4 items-center " +
          // xs+: center items
          "xs:justify-center " +
          // desktop: remove scroll, center nicely
          "md:overflow-visible md:px-4 md:py-3 md:space-x-6 md:justify-center"
        }
      >
        {paletteBlocks.map((block) => (
          <div
            key={block.id}
            className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={(e) => handlePressStart(block, e)}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={(e) => handlePressStart(block, e)}
            onTouchEnd={handlePressEnd}
            onTouchCancel={handlePressEnd}
          >
            <BlockComponent
              block={block}
              // remove direct onDragStart — we handle it manually after long press
              isPaletteBlock
              style={{ width: 64, height: 64 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
