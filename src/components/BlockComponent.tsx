import React, { useState, useContext, useEffect } from 'react';
import {
  ArrowBigUpDash,
  ArrowBigDownDash,
  ArrowBigRightDash,
  ArrowBigLeftDash,
  Clock,
  Play,
  RotateCw,
  RotateCcw,
  X,
  Lightbulb,
  LightbulbOff,
  Turtle,
  Rabbit,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Block } from '../types/Block';
import { SoundContext } from '../App';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { RootState } from '../store';
import { updateBlock as updateBlockAction, removeBlock as removeBlockAction } from '../store/slices/blocksSlice';

interface BlockComponentProps {
  block?: Block; // optional: read from store by id if only id provided
  blockId?: string;
  onDragStart?: (e: React.MouseEvent | React.TouchEvent) => void;
  onGreenFlagClick?: () => void;
  onDelayChange?: (value: number) => void;
  onRemove?: () => void;
  isPaletteBlock?: boolean;
  style?: React.CSSProperties;
}

const clampDelay = (v: number) => Math.max(1, Math.min(10, v));

export const BlockComponent: React.FC<BlockComponentProps> = ({
  block: blockProp,
  blockId,
  onDragStart,
  onGreenFlagClick,
  onDelayChange,
  onRemove,
  isPaletteBlock = false,
  style = {}
}) => {
  const dispatch = useAppDispatch();
  const playSnapSound = useContext(SoundContext);

  // ---- hooks must be unconditional (moved here) ----
  const [_, set_] = useState(false);

  // read from store unconditionally (selector param typed)
  const blockFromStore = useAppSelector((s: RootState) =>
    blockId ? s.blocks.blocks.find((b) => b.id === blockId) : undefined
  );

  // effect uses optional chaining, safe even if block is undefined
  useEffect(() => {
    set_((s) => s); // no-op to preserve hook ordering
  }, []); // keep dependency simple; block.value isn't required for ordering

  const block = blockProp ?? blockFromStore;
  if (!block) return null;

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
      case 'forward':
        return 'bg-indigo-500 shadow-indigo-600 bg-gradient-to-b from-indigo-400 to-indigo-600 dark:from-indigo-700 dark:to-indigo-900 dark:shadow-black/40';
      case 'backward':
        return 'bg-orange-500 shadow-orange-600 bg-gradient-to-b from-orange-400 to-orange-600 dark:from-orange-700 dark:to-orange-900 dark:shadow-black/40';
      case 'clockwise':
        return 'bg-pink-500 shadow-pink-600 bg-gradient-to-b from-pink-400 to-pink-600 dark:from-fuchsia-700 dark:to-fuchsia-900 dark:shadow-black/40';
      case 'countclockwise':
        return 'bg-teal-500 shadow-teal-600 bg-gradient-to-b from-teal-400 to-teal-600 dark:from-red-700 dark:to-red-900 dark:shadow-black/40';
      case 'lamp-on':
        return 'bg-amber-400 shadow-amber-500 bg-gradient-to-b from-amber-300 to-amber-500 dark:from-amber-700 dark:to-amber-900 dark:shadow-black/30';
      case 'lamp-off':
        return 'bg-gray-400 shadow-gray-500 bg-gradient-to-b from-gray-300 to-gray-500 dark:from-gray-700 dark:to-gray-900 dark:shadow-black/30';
      case 'speed-low':
        return 'bg-cyan-400 shadow-cyan-500 bg-gradient-to-b from-cyan-300 to-cyan-500 dark:from-cyan-700 dark:to-cyan-900 dark:shadow-black/30';
      case 'speed-high':
        return 'bg-purple-500 shadow-purple-600 bg-gradient-to-b from-purple-400 to-purple-600 dark:from-purple-700 dark:to-purple-900 dark:shadow-black/40';
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
        case 'forward': return <ArrowBigRightDash className={`w-10 h-10 md:w-12 md:h-12 ${baseIconClass}`} />;
        case 'backward': return <ArrowBigLeftDash className={`w-10 h-10 md:w-12 md:h-12 ${baseIconClass}`} />;
        case 'delay': return <Clock className={`w-8 h-8 md:w-8 md:h-8 ${baseIconClass}`} />;
        case 'green-flag': return <Play className={`w-8 h-8 md:w-8 md:h-8 ${baseIconClass}`} />;
        case 'clockwise': return <RotateCw className={`w-8 h-8 md:w-10 md:h-10 ${baseIconClass}`} />;
        case 'countclockwise': return <RotateCcw className={`w-8 h-8 md:w-10 md:h-10 ${baseIconClass}`} />;
        case 'lamp-on': return <Lightbulb className={`w-8 h-8 md:w-10 md:h-10 ${baseIconClass}`} />;
        case 'lamp-off': return <LightbulbOff className={`w-8 h-8 md:w-10 md:h-10 ${baseIconClass}`} />;
        case 'speed-low': return <Turtle className={`w-8 h-8 md:w-10 md:h-10 ${baseIconClass}`} />;
        case 'speed-high': return <Rabbit className={`w-8 h-8 md:w-10 md:h-10 ${baseIconClass}`} />;
        default: return null;
      }
    } else {
      switch (block.type) {
        case 'up': return <ArrowBigUpDash className={`w-10 h-10 md:w-12 md:h-12 ${baseIconClass}`} />;
        case 'down': return <ArrowBigDownDash className={`w-10 h-10 md:w-12 md:h-12 ${baseIconClass}`} />;
        case 'forward': return <ArrowBigRightDash className={`w-8 h-8 md:w-10 md:h-10 ${baseIconClass}`} />;
        case 'backward': return <ArrowBigLeftDash className={`w-8 h-8 md:w-10 md:h-10 ${baseIconClass}`} />;
        case 'delay': return <Clock className={`w-8 h-8 md:w-6 md:h-6 ${baseIconClass}`} />;
        case 'green-flag': return <Play className={`w-8 h-8 md:w-6 md:h-6 ${baseIconClass}`} />;
        case 'clockwise': return <RotateCw className={`w-7 h-7 md:w-8 md:h-8 ${baseIconClass}`} />;
        case 'countclockwise': return <RotateCcw className={`w-7 h-7 md:w-8 md:h-8 ${baseIconClass}`} />;
        case 'lamp-on': return <Lightbulb className={`w-7 h-7 md:w-8 md:h-8 ${baseIconClass}`} />;
        case 'lamp-off': return <LightbulbOff className={`w-7 h-7 md:w-8 md:h-8 ${baseIconClass}`} />;
        case 'speed-low': return <Turtle className={`w-7 h-7 md:w-8 md:h-8 ${baseIconClass}`} />;
        case 'speed-high': return <Rabbit className={`w-7 h-7 md:w-8 md:h-8 ${baseIconClass}`} />;
        default: return null;
      }
    }
  };

  const handleClick = () => {
    if (block.type === 'green-flag') {
      if (onGreenFlagClick) onGreenFlagClick();
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
      case 'up': return 'bg-blue-500 dark:bg-blue-800';
      case 'down': return 'bg-red-500 dark:bg-red-800';
      case 'delay': return 'bg-yellow-500 dark:bg-amber-700';
      case 'green-flag': return 'bg-green-500 dark:bg-emerald-800';
      case 'forward': return 'bg-indigo-500 dark:bg-indigo-800';
      case 'backward': return 'bg-orange-500 dark:bg-orange-800';
      case 'clockwise': return 'bg-pink-500 dark:bg-fuchsia-800';
      case 'countclockwise': return 'bg-teal-500 dark:bg-red-800';
      case 'lamp-on': return 'bg-amber-400 dark:bg-amber-700';
      case 'lamp-off': return 'bg-gray-400 dark:bg-gray-700';
      case 'speed-low': return 'bg-cyan-400 dark:bg-cyan-700';
      case 'speed-high': return 'bg-purple-500 dark:bg-purple-700';
      default: return 'bg-gray-500 dark:bg-slate-700';
    }
  };

  const rightNotchBase = isPaletteBlock
    ? `absolute -right-3 top-1/2 transform -translate-y-1/2 w-4 h-8 md:w-5 md:h-10 rounded-r-lg border-r-2 border-t-2 border-b-2 border-white/20 dark:border-slate-700 ${getNotchColor(block.type)}`
    : `absolute -right-2 top-1/2 transform -translate-y-1/2 w-3 h-6 md:w-4 md:h-8 rounded-r-lg border-r-2 border-t-2 border-b-2 border-white/20 dark:border-slate-700 ${getNotchColor(block.type)}`;

  // delay chevron button styles (small, same bg as delay block)
  const delayBtnBase = `
    absolute left-1/2 transform -translate-x-1/2
    flex items-center justify-center
    border-2 border-white/20 dark:border-slate-700
    text-white cursor-pointer select-none
    transition-all duration-150
    active:scale-95
  `;

  const delayBtnUpClass = `${getBlockColor('delay')} ${delayBtnBase} rounded-t-lg rounded-b-none w-8 h-6 md:w-10 md:h-7`;
  const delayBtnDownClass = `${getBlockColor('delay')} ${delayBtnBase} rounded-b-lg rounded-t-none w-8 h-6 md:w-10 md:h-7`;

  // handlers for chevrons (use prop handlers when provided; otherwise dispatch update)
  const handleDelayIncrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = typeof block.value === 'number' ? block.value : 1;
    const next = clampDelay(current + 1);
    if (onDelayChange) {
      onDelayChange(next);
    } else {
      dispatch(updateBlockAction({ ...block, value: next }));
    }
    playSnapSound?.();
  };

  const handleDelayDecrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = typeof block.value === 'number' ? block.value : 1;
    const next = clampDelay(current - 1);
    if (onDelayChange) {
      onDelayChange(next);
    } else {
      dispatch(updateBlockAction({ ...block, value: next }));
    }
    playSnapSound?.();
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
    } else {
      dispatch(removeBlockAction(block.id));
    }
    playSnapSound?.();
  };

  return (
    <div className="relative group" style={style}>
      {/* Delay chevrons (above and below) - only for real blocks, not palette */}
      {block.type === 'delay' && !isPaletteBlock && (
        <>
          <button
            onClick={handleDelayIncrease}
            onMouseDown={(e) => e.stopPropagation()}
            className={delayBtnUpClass}
            aria-label="increase delay"
            style={{ bottom: '100%' }}
            title="Increase delay"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          <button
            onClick={handleDelayDecrease}
            onMouseDown={(e) => e.stopPropagation()}
            className={delayBtnDownClass}
            aria-label="decrease delay"
            style={{ top: '100%' }}
            title="Decrease delay"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </>
      )}

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
        <div className="flex items-center justify-center relative">
          {getBlockIcon()}

          {block.type === 'delay' && (
            <div className="absolute right-0 bottom-0 transform translate-x-1/4 translate-y-1/4">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-white text-yellow-600 dark:bg-slate-900 dark:text-yellow-400 flex items-center justify-center text-xs font-bold border-2 border-white/30">
                {typeof block.value === 'number' ? block.value : 1}
              </div>
            </div>
          )}
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

      {!isPaletteBlock && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
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

export default BlockComponent;
