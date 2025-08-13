import { useState, useCallback, useEffect, useRef } from 'react';
import { Block } from '../types/Block';

export interface DragDropOptions {
  onDrop: (position: { x: number; y: number }, block: Block) => void;
  onDrag: (position: { x: number; y: number }, block: Block, offset: {x: number, y: number}) => void;
  onDragStart: (block: Block, e: React.MouseEvent | React.TouchEvent) => Block;
  onDragEnd: () => void;
}

export const useDragDrop = ({ onDrop, onDrag, onDragStart, onDragEnd }: DragDropOptions) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<Block | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !draggedBlock) return;
    
    // Prevent default behavior like text selection or page scrolling on touch devices
    e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    onDrag({ x: clientX, y: clientY }, draggedBlock, dragOffsetRef.current);
  }, [isDragging, draggedBlock, onDrag]);

  const handleDragEnd = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !draggedBlock) return;

    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;

    setIsDragging(false);
    onDrop({ x: clientX, y: clientY }, draggedBlock);
    setDraggedBlock(null);
    onDragEnd();
  }, [isDragging, draggedBlock, onDrop, onDragEnd]);

  const handleDragStart = useCallback((block: Block, e: React.MouseEvent | React.TouchEvent) => {
    // Stop propagation to prevent parent elements from handling the event
    e.stopPropagation();

    const blockToDrag = onDragStart(block, e);
    if (!blockToDrag) return;
    
    setDraggedBlock(blockToDrag);
    setIsDragging(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragOffsetRef.current = {
      x: clientX - blockToDrag.x,
      y: clientY - blockToDrag.y,
    };
  }, [onDragStart]);

  useEffect(() => {
    // Add event listeners when a drag starts
    if (isDragging) {
      // Use a single end listener for both mouse and touch events
      const endListener = (e: MouseEvent | TouchEvent) => handleDragEnd(e);

      // Add listeners for move and end events
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', endListener);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', endListener);

      // Cleanup function to remove listeners when the drag ends or component unmounts
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', endListener);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', endListener);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  return {
    isDragging,
    draggedBlock,
    handleDragStart
  };
};
