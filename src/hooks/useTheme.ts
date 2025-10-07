// src/hooks/useTheme.ts
import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

// NOTE: unified key: "site-theme" (matches ThemeToggle)
const STORAGE_KEY = 'site-theme';

export default function useTheme(initial: Theme = 'system') {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      return stored ?? initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const apply = () => {
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else if (theme === 'light') document.documentElement.classList.remove('dark');
      else {
        mq?.matches
          ? document.documentElement.classList.add('dark')
          : document.documentElement.classList.remove('dark');
      }
    };

    apply();

    if (theme === 'system' && mq) {
      const handler = () => apply();
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  const cycleTheme = () => {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  return { theme, cycleTheme, setTheme };
}
