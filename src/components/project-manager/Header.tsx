import React from "react";
import ThemeToggle from "./ThemeToggle";
import IconViewToggle from "./IconViewToggle";

interface Props {
  view: "cards" | "list";
  setView: (v: "cards" | "list") => void;
}

const Header: React.FC<Props> = ({ view, setView }) => {
  return (
    <header className="w-full backdrop-blur-sm bg-white/50 dark:bg-black/40 border-b border-transparent dark:border-neutral-800 transition-colors duration-300 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        
        {/* Right side: Logo + Company name */}
        <div className="flex items-center gap-3 text-right">
          <div className="rounded-2xl p-2 shadow-sm bg-brand-plain dark:bg-brand-plain-dark flex items-center justify-center">
            <span className="font-semibold text-sm tracking-wider text-white select-none">K</span>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-neutral-700 dark:text-neutral-100">
              کمان
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-300">
              مدیریت پروژه
            </div>
          </div>
        </div>

        {/* Left side: View + Theme toggle */}
        <div className="flex items-center gap-3">
          <IconViewToggle view={view} setView={setView} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Header;
