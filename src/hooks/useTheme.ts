// src/hooks/useTheme.ts
import { useEffect, useState, useCallback } from 'react';

export type Theme = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'site-theme';

export default function useTheme(initial: Theme = 'system') {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      return (stored ?? initial) as Theme;
    } catch {
      return initial;
    }
  });

  const applyClass = useCallback((t: Theme) => {
    const root = document.documentElement;
    try {
      if (t === 'dark') root.classList.add('dark');
      else if (t === 'light') root.classList.remove('dark');
      else {
        const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
        if (mq?.matches) root.classList.add('dark');
        else root.classList.remove('dark');
      }
    } catch {
      // ignore weird webviews
    }
  }, []);

  // setTheme accepts either a Theme or a function (prev => next)
  const setTheme = useCallback(
    (t: Theme | ((prev: Theme) => Theme)) => {
      setThemeState(prev => {
        const next = typeof t === 'function' ? (t as (p: Theme) => Theme)(prev) : (t as Theme);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // ignore storage errors
        }
        // apply immediately
        applyClass(next);
        return next;
      });
    },
    [applyClass]
  );

  // cycleTheme now uses functional setTheme — safe against stale closures
  const cycleTheme = useCallback(() => {
    setTheme(prev => (prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system'));
  }, [setTheme]);

  useEffect(() => {
    // ensure class is correct on mount and when theme changes (this is defensive)
    applyClass(theme);

    let mq: MediaQueryList | null = null;
    const onChange = () => applyClass(theme);

    if (theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if ((mq as any).addListener) (mq as any).addListener(onChange);
    }

    return () => {
      if (!mq) return;
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if ((mq as any).removeListener) (mq as any).removeListener(onChange);
    };
  }, [theme, applyClass]);

  return { theme, setTheme, cycleTheme };
}
