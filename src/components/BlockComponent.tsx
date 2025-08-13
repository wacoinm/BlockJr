import React, { useState, useContext, useEffect } from 'react';
import { ArrowUp, ArrowDown, Clock, Play, X } from 'lucide-react';
import { Block } from '../types/Block';
import { SoundContext } from '../App';

interface BlockComponentProps {
  block: Block;
  onDragStart?: (e: React.MouseEvent | React.TouchEvent) => void;
  onGreenFlagClick?: () => void;
  onDelayChange?: (value: number) => void;
  onRemove?: () => void;
  isPaletteBlock?: boolean;
  style?: React.CSSProperties;
}

export const BlockComponent: React.FC<BlockComponentProps> = ({
  block,
  onDragStart,
  onGreenFlagClick,
  onDelayChange,
  onRemove,
  isPaletteBlock = false,
  style = {}
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(block.value?.toString() || '1');
  const playSnapSound = useContext(SoundContext);

  useEffect(() => {
    if (block.value !== undefined) {
      setTempValue(block.value.toString());
    }
  }, [block.value]);

  const getBlockColor = (type: string) => {
    switch (type) {
      case 'up': return 'bg-blue-500 shadow-blue-600';
      case 'down': return 'bg-red-500 shadow-red-600';
      case 'delay': return 'bg-yellow-500 shadow-yellow-600';
      case 'green-flag': return 'bg-green-500 shadow-green-600';
      default: return 'bg-gray-500 shadow-gray-600';
    }
  };

  const getBlockIcon = () => {
    switch (block.type) {
      case 'up': return <ArrowUp className="w-4 h-4 md:w-6 md:h-6 text-white" />;
      case 'down': return <ArrowDown className="w-4 h-4 md:w-6 md:h-6 text-white" />;
      case 'delay': return <Clock className="w-4 h-4 md:w-6 md:h-6 text-white" />;
      case 'green-flag': return <Play className="w-4 h-4 md:w-6 md:h-6 text-white" />;
      default: return null;
    }
  };

  const handleClick = () => {
    if (block.type === 'green-flag' && onGreenFlagClick) {
      onGreenFlagClick();
    } else if (block.type === 'delay' && !isPaletteBlock) {
      setIsEditing(true);
    }
  };

  const handleDelaySubmit = () => {
    const value = parseInt(tempValue) || 1;
    onDelayChange?.(Math.max(1, Math.min(10, value)));
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleDelaySubmit();
    } else if (e.key === 'Escape') {
      setTempValue(block.value?.toString() || '1');
      setIsEditing(false);
    }
  };

  return (
    <div className="relative group" style={style}>
      <div
        className={`
          relative w-12 h-12 md:w-16 md:h-16 rounded-2xl cursor-pointer select-none
          transform transition-all duration-200 hover:scale-105 active:scale-95
          ${getBlockColor(block.type)}
          shadow-lg hover:shadow-xl
          flex items-center justify-center
          border-2 border-white/20
        `}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        onClick={handleClick}
      >
        <div className="flex items-center justify-center">
          {getBlockIcon()}
        </div>

        {/* left notch */}
        {block.type !== 'green-flag' && (
          <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-3 h-5 md:w-4 md:h-6 bg-white/10 rounded-l-lg" />
        )}

        {/* right notch when no child (visual connector) */}
        {(block.childId === null || block.childId === undefined) && block.type !== 'green-flag' && (
          <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-3 h-6 md:w-4 md:h-8 bg-inherit rounded-r-lg border-r-2 border-t-2 border-b-2 border-white/20" />
        )}

        {block.type === 'green-flag' && (
            <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-3 h-6 md:w-4 md:h-8 bg-inherit rounded-r-lg border-r-2 border-t-2 border-b-2 border-white/20" />
        )}
      </div>

      {block.type === 'delay' && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
          {isEditing && !isPaletteBlock ? (
            <input
              type="number"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleDelaySubmit}
              onKeyDown={handleKeyPress}
              className="w-10 h-7 md:w-12 md:h-8 text-center border-2 border-yellow-400 rounded-lg bg-white text-gray-800 font-bold text-sm"
              min="1"
              max="10"
              autoFocus
            />
          ) : (
            <div className="w-8 h-8 md:w-8 md:h-8 bg-white rounded-lg border-2 border-yellow-400 flex items-center justify-center text-gray-800 font-bold text-sm shadow-sm">
              {block.value || 1}
            </div>
          )}
        </div>
      )}

      {!isPaletteBlock && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
            playSnapSound();
          }}
          className="absolute -top-2 -right-2 w-5 h-5 md:w-6 md:h-6 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center hover:bg-red-600"
          aria-label="remove block"
        >
          <X className="w-3 h-3 md:w-4 md:h-4" />
        </button>
      )}
    </div>
  );
};
