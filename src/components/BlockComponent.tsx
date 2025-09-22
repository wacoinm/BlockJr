// src/components/BlockComponent.tsx
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
  block?: Block;
  blockId?: string;
  onDragStart?: (e: React.MouseEvent | React.TouchEvent) => void;
  onGreenFlagClick?: () => void;
  onDelayChange?: (value: number) => void;
  onRemove?: () => void;
  isPaletteBlock?: boolean;
  style?: React.CSSProperties;
  size?: number;
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
  style = {},
  size: sizeProp
}) => {
  const dispatch = useAppDispatch();
  const playSnapSound = useContext(SoundContext);

  const [_, set_] = useState(false);

  const blockFromStore = useAppSelector((s: RootState) =>
    blockId ? s.blocks.blocks.find((b) => b.id === blockId) : undefined
  );

  useEffect(() => {
    set_((s) => s);
  }, []);

  const block = blockProp ?? blockFromStore;
  if (!block) return null;

  // ---------- SIZE ----------
  const parseSizeFromStyle = (s: React.CSSProperties | undefined) => {
    if (!s) return undefined;
    const w = s.width;
    const h = s.height;
    if (typeof w === 'number') return Math.round(w);
    if (typeof h === 'number') return Math.round(h);
    if (typeof w === 'string' && w.endsWith('px')) return Math.round(parseFloat(w));
    if (typeof h === 'string' && h.endsWith('px')) return Math.round(parseFloat(h));
    return undefined;
  };
  const styleSize = parseSizeFromStyle(style);
  const defaultPaletteSize = 80;
  const defaultWorkspaceSize = 56;
  const finalSize = sizeProp ?? styleSize ?? (isPaletteBlock ? defaultPaletteSize : defaultWorkspaceSize);

  // ---------- GEOMETRY ----------
  const iconSize = Math.round(finalSize * (isPaletteBlock ? 0.56 : 0.46));
  const notchW = Math.max(14, Math.round(finalSize * (isPaletteBlock ? 0.32 : 0.26)));
  const notchH = Math.max(14, Math.round(finalSize * (isPaletteBlock ? 0.52 : 0.44)));
  const notchHRight = Math.round(notchH * 1.05);

  const borderRadiusPx = Math.round(finalSize * (isPaletteBlock ? 0.24 : 0.18));
  const removeBtnSize = Math.max(16, Math.round(finalSize * 0.22));
  const delayBadgeSize = Math.max(12, Math.round(finalSize * 0.18));

  // ---------- COLORS ----------
  const getBlockColor = (type: string) => {
    switch (type) {
      case 'up': return 'bg-blue-500 shadow-blue-600 bg-gradient-to-b from-blue-400 to-blue-600 dark:from-blue-700 dark:to-blue-900 dark:shadow-black/40';
      case 'down': return 'bg-red-500 shadow-red-600 bg-gradient-to-b from-red-400 to-red-600 dark:from-red-700 dark:to-red-900 dark:shadow-black/40';
      case 'delay': return 'bg-yellow-500 shadow-yellow-600 bg-gradient-to-b from-yellow-300 to-yellow-500 dark:from-amber-700 dark:to-amber-800 dark:shadow-black/30';
      case 'green-flag': return 'bg-green-500 shadow-green-600 bg-gradient-to-b from-green-400 to-green-600 dark:from-emerald-700 dark:to-emerald-900 dark:shadow-black/30';
      case 'forward': return 'bg-indigo-500 shadow-indigo-600 bg-gradient-to-b from-indigo-400 to-indigo-600 dark:from-indigo-700 dark:to-indigo-900 dark:shadow-black/40';
      case 'backward': return 'bg-orange-500 shadow-orange-600 bg-gradient-to-b from-orange-400 to-orange-600 dark:from-orange-700 dark:to-orange-900 dark:shadow-black/40';
      case 'clockwise': return 'bg-pink-500 shadow-pink-600 bg-gradient-to-b from-pink-400 to-pink-600 dark:from-fuchsia-700 dark:to-fuchsia-900 dark:shadow-black/40';
      case 'countclockwise': return 'bg-teal-500 shadow-teal-600 bg-gradient-to-b from-teal-400 to-teal-600 dark:from-red-700 dark:to-red-900 dark:shadow-black/40';
      case 'lamp-on': return 'bg-amber-400 shadow-amber-500 bg-gradient-to-b from-amber-300 to-amber-500 dark:from-amber-700 dark:to-amber-900 dark:shadow-black/30';
      case 'lamp-off': return 'bg-gray-400 shadow-gray-500 bg-gradient-to-b from-gray-300 to-gray-500 dark:from-gray-700 dark:to-gray-900 dark:shadow-black/30';
      case 'speed-low': return 'bg-cyan-400 shadow-cyan-500 bg-gradient-to-b from-cyan-300 to-cyan-500 dark:from-cyan-700 dark:to-cyan-900 dark:shadow-black/30';
      case 'speed-high': return 'bg-purple-500 shadow-purple-600 bg-gradient-to-b from-purple-400 to-purple-600 dark:from-purple-700 dark:to-purple-900 dark:shadow-black/40';
      default: return 'bg-gray-500 shadow-gray-600 bg-gradient-to-b from-gray-400 to-gray-600 dark:from-slate-700 dark:to-slate-800 dark:shadow-black/30';
    }
  };

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

  // ---------- ICONS ----------
  const baseIconColor = 'text-white';
  const getBlockIcon = () => {
    switch (block.type) {
      case 'up': return <ArrowBigUpDash size={iconSize} className={baseIconColor} />;
      case 'down': return <ArrowBigDownDash size={iconSize} className={baseIconColor} />;
      case 'forward': return <ArrowBigRightDash size={iconSize} className={baseIconColor} />;
      case 'backward': return <ArrowBigLeftDash size={iconSize} className={baseIconColor} />;
      case 'delay': return <Clock size={Math.round(iconSize * 0.9)} className={baseIconColor} />;
      case 'green-flag': return <Play size={Math.round(iconSize * 0.9)} className={baseIconColor} />;
      case 'clockwise': return <RotateCw size={iconSize} className={baseIconColor} />;
      case 'countclockwise': return <RotateCcw size={iconSize} className={baseIconColor} />;
      case 'lamp-on': return <Lightbulb size={iconSize} className={baseIconColor} />;
      case 'lamp-off': return <LightbulbOff size={iconSize} className={baseIconColor} />;
      case 'speed-low': return <Turtle size={iconSize} className={baseIconColor} />;
      case 'speed-high': return <Rabbit size={iconSize} className={baseIconColor} />;
      default: return null;
    }
  };

  // ---------- HANDLERS ----------
  const handleDelayIncrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = typeof block.value === 'number' ? block.value : 1;
    const next = clampDelay(current + 1);
    if (onDelayChange) onDelayChange(next);
    else dispatch(updateBlockAction({ ...block, value: next }));
    playSnapSound?.();
  };

  const handleDelayDecrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = typeof block.value === 'number' ? block.value : 1;
    const next = clampDelay(current - 1);
    if (onDelayChange) onDelayChange(next);
    else dispatch(updateBlockAction({ ...block, value: next }));
    playSnapSound?.();
  };

  const handleRemove = () => {
    if (onRemove) onRemove();
    else dispatch(removeBlockAction(block.id));
    playSnapSound?.();
  };

  // ---------- CLASSES ----------
  const sizeClasses = isPaletteBlock ? 'relative rounded-3xl' : 'relative rounded-2xl';
  const leftNotchClasses = 'absolute top-1/2 transform -translate-y-1/2 rounded-l-lg bg-white/10 dark:bg-slate-800/30';
  const leftNotchExtraBorder = 'border-r-2 border-white/20 dark:border-slate-600';
  const rightNotchClassBase = `${getNotchColor(block.type)} border-r-2 border-t-2 border-b-2 border-white/20 dark:border-slate-700`;

  const mergedStyle: React.CSSProperties = {
    width: finalSize,
    height: finalSize,
    borderRadius: borderRadiusPx,
    display: 'inline-block',
    position: 'relative',
    ...style
  };

  return (
    <div className="relative group" style={{ width: finalSize, height: finalSize }}>
      {/* Delay chevrons (workspace only) */}
      {block.type === 'delay' && !isPaletteBlock && (
        <>
          <button
            onClick={handleDelayIncrease}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="increase delay"
            title="Increase delay"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: Math.round(finalSize * 0.36),   // bigger
              height: Math.round(finalSize * 0.24),  // bigger
              borderRadius: Math.round(finalSize * 0.08),
            }}
            className={`${getBlockColor('delay')} flex items-center justify-center border-2 border-white/20 dark:border-slate-700 text-white`}
          >
            <ChevronUp size={Math.round(finalSize * 0.18)} /> {/* bigger */}
          </button>

          <button
            onClick={handleDelayDecrease}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="decrease delay"
            title="Decrease delay"
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: Math.round(finalSize * 0.36),
              height: Math.round(finalSize * 0.24),
              borderRadius: Math.round(finalSize * 0.08),
            }}
            className={`${getBlockColor('delay')} flex items-center justify-center border-2 border-white/20 dark:border-slate-700 text-white`}
          >
            <ChevronDown size={Math.round(finalSize * 0.18)} />
          </button>
        </>
      )}

      {/* MAIN BLOCK */}
      <div
        className={`${sizeClasses} ${getBlockColor(block.type)} shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-white/20 dark:border-white/8 cursor-pointer select-none transform transition-all duration-200 hover:scale-105 active:scale-95`}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        onClick={() => block.type === 'green-flag' && onGreenFlagClick?.()}
        role="button"
        tabIndex={0}
        style={mergedStyle}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
          {getBlockIcon()}

          {/* delay badge */}
          {block.type === 'delay' && (
            <div style={{
              position: 'absolute',
              right: Math.round(finalSize * 0.06),
              bottom: Math.round(finalSize * 0.06),
              width: delayBadgeSize,
              height: delayBadgeSize,
              borderRadius: 999,
              background: 'white',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.max(10, Math.round(finalSize * 0.28)),
              fontWeight: 700,
              border: '2px solid rgba(255,255,255,0.3)'
            }}>
              {typeof block.value === 'number' ? block.value : 1}
            </div>
          )}
        </div>

        {/* LEFT NOTCH */}
        {block.type !== 'green-flag' && (
          <div
            className={`${leftNotchClasses} ${leftNotchExtraBorder}`}
            style={{
              width: notchW,
              height: notchH,
              left: -Math.round(notchW / 2),
              top: '50%',
              transform: 'translateY(-50%)'
            }}
          />
        )}

        {/* RIGHT NOTCH */}
        {(block.childId === null || block.childId === undefined) && block.type !== 'green-flag' && (
          <div
            className={rightNotchClassBase}
            style={{
              width: notchW,
              height: notchHRight,
              right: -Math.round(notchW / 2),
              top: '50%',
              position: 'absolute',
              transform: 'translateY(-50%)',
              borderTopRightRadius: Math.round(notchW / 2),
              borderBottomRightRadius: Math.round(notchW / 2),
            }}
          />
        )}

        {/* green-flag right notch with bg */}
        {block.type === 'green-flag' && (
          <div
            className={`${getNotchColor('green-flag')} border-r-2 border-t-2 border-b-2 border-white/20 dark:border-slate-700`}
            style={{
              width: notchW,
              height: notchHRight,
              right: -Math.round(notchW / 2),
              top: '50%',
              position: 'absolute',
              transform: 'translateY(-50%)',
              borderTopRightRadius: Math.round(notchW / 2),
              borderBottomRightRadius: Math.round(notchW / 2),
            }}
          />
        )}
      </div>

      {/* remove button */}
      {!isPaletteBlock && (
        <button
          onClick={(e) => { e.stopPropagation(); handleRemove(); }}
          aria-label="remove block"
          style={{
            position: 'absolute',
            top: -Math.round(removeBtnSize / 2),
            right: -Math.round(removeBtnSize / 2),
            width: removeBtnSize,
            height: removeBtnSize,
            borderRadius: Math.round(removeBtnSize / 2),
          }}
          className="bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
        >
          <X size={Math.max(10, Math.round(removeBtnSize * 0.55))} />
        </button>
      )}
    </div>
  );
};

export default BlockComponent;
