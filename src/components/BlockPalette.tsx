import React from "react";
import { BlockComponent } from "./BlockComponent";
import { Block } from "../types/Block";

interface BlockPaletteProps {
  onBlockDrag: (
    block: Block,
    event: React.MouseEvent | React.TouchEvent
  ) => void;
}

const paletteBlocks: Block[] = [
  {
    id: "up-template",
    type: "up",
    x: 0,
    y: 0,
    parentId: null,
    childId: null,
  },
  {
    id: "down-template",
    type: "down",
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
];

export const BlockPalette: React.FC<BlockPaletteProps> = ({ onBlockDrag }) => {
  return (
    // Fixed and responsive: desktop -> top (md:top-4), mobile -> bottom-0
    <div
      className="fixed left-0 w-full z-40 bg-white border-t-2 border-gray-200 shadow-lg flex items-center justify-center px-4
                    h-20 md:h-24
                    bottom-0 md:bottom-auto md:top-4
                    "
    >
      <div className="flex space-x-4 md:space-x-6">
        {paletteBlocks.map((block) => (
          <div key={block.id} className="cursor-grab active:cursor-grabbing">
            <BlockComponent
              block={block}
              onDragStart={(e) => onBlockDrag(block, e)}
              isPaletteBlock
            />
          </div>
        ))}
      </div>
    </div>
  );
};
