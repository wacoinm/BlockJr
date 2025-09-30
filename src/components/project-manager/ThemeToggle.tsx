import React, { useEffect, useState } from "react";

const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("site-theme");
      if (stored) return stored === "dark";
      return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("site-theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("site-theme", "light");
    }
  }, [isDark]);

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setIsDark((s) => !s)}
      className="w-12 h-8 flex items-center p-1 rounded-full bg-neutral-200 dark:bg-neutral-700 transition-all duration-300 focus:ring-2 focus:ring-offset-2 focus:ring-brand-plain dark:focus:ring-brand-plain-dark"
    >
      <div
        className={
          "w-6 h-6 rounded-full shadow transform transition-transform duration-300 " +
          (isDark ? "translate-x-4 bg-yellow-400" : "translate-x-0 bg-white")
        }
      />
    </button>
  );
};

export default ThemeToggle;
