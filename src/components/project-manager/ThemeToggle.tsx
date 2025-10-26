// src/components/project-manager/ThemeToggle.tsx
import React from "react";
import useTheme from "../../hooks/useTheme";

const ThemeToggle: React.FC = () => {
  const { theme, cycleTheme } = useTheme();

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  return (
    <button
      aria-label="Toggle theme"
      onClick={cycleTheme}
      className="w-12 h-8 flex items-center p-1 rounded-full bg-neutral-200 dark:bg-neutral-700 transition-all duration-300 focus:ring-2 focus:ring-offset-2 focus:ring-brand-plain dark:focus:ring-brand-plain-dark"
    >
      <div
        className={
          "w-6 h-6 rounded-full shadow transform transition-transform duration-300 " +
          (isDark ? "translate-x-0 bg-yellow-400" : "translate-x-[-1rem] bg-white")
        }
      />
    </button>
  );
};

export default ThemeToggle;
