// src/layouts/SafeLayout.tsx
import React, { ReactNode } from "react";

type Props = { children: ReactNode; lightClass?: string; darkClass?: string };

export default function SafeLayout({
  children,
  lightClass = "bg-white text-black",
  darkClass = "dark:bg-slate-900 dark:text-white",
}: Props) {
  const style: React.CSSProperties = {
    paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top))",
    paddingBottom: "var(--safe-area-inset-bottom, env(safe-area-inset-bottom))",
    paddingLeft: "var(--safe-area-inset-left, env(safe-area-inset-left))",
    paddingRight: "var(--safe-area-inset-right, env(safe-area-inset-right))",
    boxSizing: "border-box",
    minHeight: "100vh",
    width: "100%",
  };

  return (
    <div className={`flex flex-col w-full min-h-screen ${lightClass} ${darkClass}`} style={style}>
      {children}
    </div>
  );
}
