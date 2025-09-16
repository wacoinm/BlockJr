// src/components/Header.tsx
import React, { useState, useCallback /*, useEffect, useRef */ } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface HeaderProps {
  initialCollapsed?: boolean;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  className?: string;
  // autoCloseDelay?: number; // ms, default 10000
}

const Header: React.FC<HeaderProps> = ({
  initialCollapsed = false,
  hasPrev = true,
  hasNext = true,
  onPrev,
  onNext,
  className = '',
  // autoCloseDelay = 60000,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(initialCollapsed);
  // const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /*
  const resetAutoCloseTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!collapsed) {
      timeoutRef.current = setTimeout(() => {
        setCollapsed(true);
      }, autoCloseDelay);
    }
  }, [collapsed, autoCloseDelay]);

  useEffect(() => {
    resetAutoCloseTimer();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [collapsed, resetAutoCloseTimer]);
  */

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  const handlePrev = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!hasPrev) return;
      // resetAutoCloseTimer();
      onPrev?.();
    },
    [hasPrev, onPrev],
  );

  const handleNext = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!hasNext) return;
      // resetAutoCloseTimer();
      onNext?.();
    },
    [hasNext, onNext],
  );

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleCollapsed();
    },
    [toggleCollapsed],
  );

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 ${className}`}
    >
      <div
        className={`flex items-center gap-2 rounded-full px-3 py-1 shadow-md
          bg-white/90 dark:bg-slate-800/90 backdrop-blur-md
          text-slate-800 dark:text-slate-100
        `}
      >
        {/* Prev */}
        <div
          className={`flex items-center overflow-hidden transition-all ease-out
            ${
              collapsed
                ? 'max-w-0 opacity-0 -translate-x-2 duration-300'
                : 'max-w-[120px] opacity-100 translate-x-0 duration-700'
            }
          `}
        >
          <button
            type="button"
            onClick={handlePrev}
            className={`flex items-center sm:gap-1 px-2 py-1 rounded-md text-sm font-medium
              active:scale-90 transition-transform duration-200 ease-out
              ${hasPrev ? 'opacity-100' : 'opacity-40 pointer-events-none'}
            `}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="select-none">Prev</span>
          </button>
        </div>

        {/* Center toggle */}
        <button
          type="button"
          onClick={handleToggle}
          className={`sm:mx-1 sm:px-3 py-1 rounded-full text-sm font-semibold tracking-wide
            transition-transform duration-300 ease-out transform-gpu
            active:scale-90
            ${collapsed ? 'scale-95' : 'scale-100'}
          `}
        >
          KAMAAN
        </button>

        {/* Next */}
        <div
          className={`flex items-center overflow-hidden transition-all ease-out
            ${
              collapsed
                ? 'max-w-0 opacity-0 translate-x-2 duration-300'
                : 'max-w-[120px] opacity-100 translate-x-0 duration-700'
            }
          `}
        >
          <button
            type="button"
            onClick={handleNext}
            className={`flex items-center sm:gap-1 px-2 py-1 rounded-md text-sm font-medium
              active:scale-90 transition-transform duration-200 ease-out
              ${hasNext ? 'opacity-100' : 'opacity-40 pointer-events-none'}
            `}
          >
            <span className="select-none">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;
