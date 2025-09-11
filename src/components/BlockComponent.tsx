import React, { useState, useContext, useEffect } from 'react';
import { ArrowBigUpDash, ArrowBigDownDash, Clock, Play, X } from 'lucide-react';
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
      case 'up':
        return 'bg-blue-500 shadow-blue-600 bg-gradient-to-b from-blue-400 to-blue-600 dark:from-blue-700 dark:to-blue-900 dark:shadow-black/40';
      case 'down':
        return 'bg-red-500 shadow-red-600 bg-gradient-to-b from-red-400 to-red-600 dark:from-red-700 dark:to-red-900 dark:shadow-black/40';
      case 'delay':
        return 'bg-yellow-500 shadow-yellow-600 bg-gradient-to-b from-yellow-300 to-yellow-500 dark:from-amber-700 dark:to-amber-800 dark:shadow-black/30';
      case 'green-flag':
        return 'bg-green-500 shadow-green-600 bg-gradient-to-b from-green-400 to-green-600 dark:from-emerald-700 dark:to-emerald-900 dark:shadow-black/30';
      default:
        return 'bg-gray-500 shadow-gray-600 bg-gradient-to-b from-gray-400 to-gray-600 dark:from-slate-700 dark:to-slate-800 dark:shadow-black/30';
    }
  };

  const getBlockIcon = () => {
    const baseIconClass = 'text-white';

    if (isPaletteBlock) {
      switch (block.type) {
        case 'up': return <ArrowBigUpDash className={`w-10 h-10 md:w-12 md:h-12 ${baseIconClass}`} />;
        case 'down': return <ArrowBigDownDash className={`w-10 h-10 md:w-12 md:h-12 ${baseIconClass}`} />;
        case 'delay': return <Clock className={`w-8 h-8 md:w-8 md:h-8 ${baseIconClass}`} />;
        case 'green-flag': return <Play className={`w-8 h-8 md:w-8 md:h-8 ${baseIconClass}`} />;
        default: return null;
      }
    } else {
      switch (block.type) {
        case 'up': return <ArrowBigUpDash className={`w-10 h-10 md:w-12 md:h-12 ${baseIconClass}`} />;
        case 'down': return <ArrowBigDownDash className={`w-10 h-10 md:w-12 md:h-12 ${baseIconClass}`} />;
        case 'delay': return <Clock className={`w-8 h-8 md:w-6 md:h-6 ${baseIconClass}`} />;
        case 'green-flag': return <Play className={`w-8 h-8 md:w-6 md:h-6 ${baseIconClass}`} />;
        default: return null;
      }
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
    const value = parseInt(tempValue, 10) || 1;
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

  const sizeClasses = isPaletteBlock
    ? 'relative w-16 h-16 md:w-20 md:h-20 rounded-3xl'
    : 'relative w-12 h-12 md:w-16 md:h-16 rounded-2xl';

  const leftNotchClasses = isPaletteBlock
    ? 'absolute -left-3 top-1/2 transform -translate-y-1/2 w-4 h-7 md:w-5 md:h-8 rounded-l-lg bg-white/10 dark:bg-slate-800/30'
    : 'absolute -left-2 top-1/2 transform -translate-y-1/2 w-3 h-5 md:w-4 md:h-6 rounded-l-lg bg-white/10 dark:bg-slate-800/30';

  const leftNotchExtraBorder = 'border-r-2 border-white/20 dark:border-slate-600';

  const getNotchColor = (type: string) => {
    switch (type) {
      case 'up':
        return 'bg-blue-500 dark:bg-blue-800';
      case 'down':
        return 'bg-red-500 dark:bg-red-800';
      case 'delay':
        return 'bg-yellow-500 dark:bg-amber-700';
      case 'green-flag':
        return 'bg-green-500 dark:bg-emerald-800';
      default:
        return 'bg-gray-500 dark:bg-slate-700';
    }
  };

  const rightNotchBase = isPaletteBlock
  ? `absolute -right-3 top-1/2 transform -translate-y-1/2 w-4 h-8 md:w-5 md:h-10 rounded-r-lg border-r-2 border-t-2 border-b-2 border-white/20 dark:border-slate-700 ${getNotchColor(block.type)}`
  : `absolute -right-2 top-1/2 transform -translate-y-1/2 w-3 h-6 md:w-4 md:h-8 rounded-r-lg border-r-2 border-t-2 border-b-2 border-white/20 dark:border-slate-700 ${getNotchColor(block.type)}`;

  return (
    <div className="relative group" style={style}>
      <div
        className={`
          ${sizeClasses}
          ${getBlockColor(block.type)}
          shadow-lg hover:shadow-xl
          flex items-center justify-center
          border-2 border-white/20 dark:border-white/8
          cursor-pointer select-none
          transform transition-all duration-200 hover:scale-105 active:scale-95
        `}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        onClick={handleClick}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center justify-center">
          {getBlockIcon()}
        </div>

        {block.type !== 'green-flag' && (
          <div className={`${leftNotchClasses} ${leftNotchExtraBorder}`} />
        )}

        {(block.childId === null || block.childId === undefined) && block.type !== 'green-flag' && (
          <div className={rightNotchBase} />
        )}

        {block.type === 'green-flag' && (
          <div className={rightNotchBase} />
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
              className="w-10 h-7 md:w-12 md:h-8 text-center border-2 border-yellow-400 rounded-lg bg-white text-gray-800 font-bold text-sm dark:bg-slate-800 dark:text-slate-200 dark:border-amber-600"
              min="1"
              max="10"
              autoFocus
            />
          ) : (
            <div className="w-8 h-8 md:w-8 md:h-8 bg-white rounded-lg border-2 border-yellow-400 flex items-center justify-center text-gray-800 font-bold text-sm shadow-sm dark:bg-slate-800 dark:text-slate-200 dark:border-amber-600">
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
          className="absolute -top-2 -right-2 w-5 h-5 md:w-6 md:h-6 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
          aria-label="remove block"
        >
          <X className="w-3 h-3 md:w-4 md:h-4" />
        </button>
      )}
    </div>
  );
};
