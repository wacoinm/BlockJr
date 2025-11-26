export type BlockType =
  | "up"
  | "down"
  | "delay"
  | "green-flag"
  | "forward"
  | "backward"
  | "clockwise"
  | "countclockwise"
  | "lamp-on"
  | "lamp-off"
  | "speed-low"
  | "speed-high"
  | "shoot";

export interface Block {
  id: string;
  type: BlockType;
  value?: number; // For delay block
  x: number;
  y: number;
  // New properties for chaining
  parentId: string | null;
  childId: string | null;
}
