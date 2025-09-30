import React from "react";

interface Props {
  view: "cards" | "list";
  setView: (v: "cards" | "list") => void;
}

const IconViewToggle: React.FC<Props> = ({ view, setView }) => {
  return (
    <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-full">
      <button
        aria-label="نمای کاشی"
        onClick={() => setView("cards")}
        className={`p-2 rounded-full ${view === "cards" ? "bg-white/60 dark:bg-white/10 shadow" : "opacity-70"}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>
      </button>
      <button
        aria-label="نمای لیست"
        onClick={() => setView("list")}
        className={`p-2 rounded-full ${view === "list" ? "bg-white/60 dark:bg-white/10 shadow" : "opacity-70"}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  );
};

export default IconViewToggle;
