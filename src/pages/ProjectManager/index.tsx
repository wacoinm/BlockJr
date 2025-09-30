import React, { useEffect, useState } from "react";
import Header from "../../components/project-manager/Header";
import ProjectList from "../../components/project-manager/ProjectList";
import FAB from "../../components/project-manager/FAB";

export interface Project {
  id: string;
  name: string;
  updatedAt: string; // ISO date or YYYY-MM-DD
}

const initialProjects: Project[] = [
  { id: "p-1", name: "ماژول پرداخت", updatedAt: "2025-09-28" },
  { id: "p-2", name: "شریک VPN - i18n", updatedAt: "2025-09-20" },
  { id: "p-3", name: "هاب چاپ سه‌بعدی", updatedAt: "2025-08-12" },
  { id: "p-4", name: "لانچر BlockJr", updatedAt: "2025-07-30" },
];

const ProjectManager: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [view, setView] = useState<"cards" | "list">("cards");

  useEffect(() => {
    // handle mobile viewport height quirks (rotation)
    const setSmallHeight = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setSmallHeight();
    window.addEventListener("resize", setSmallHeight);

    // set RTL and fa lang while this page is mounted, restore on unmount
    const prevDir = document.documentElement.getAttribute("dir");
    const prevLang = document.documentElement.getAttribute("lang");
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "fa");

    return () => {
      window.removeEventListener("resize", setSmallHeight);
      if (prevDir === null) document.documentElement.removeAttribute("dir");
      else document.documentElement.setAttribute("dir", prevDir);
      if (prevLang === null) document.documentElement.removeAttribute("lang");
      else document.documentElement.setAttribute("lang", prevLang);
    };
  }, []);

  function handleCreateProject(name: string) {
    const trimmed = name?.trim();
    if (!trimmed) return;
    const id = `p-${Date.now().toString(36).slice(-6)}`;
    const project: Project = { id, name: trimmed, updatedAt: new Date().toISOString().slice(0, 10) };
    setProjects((s) => [project, ...s]);
  }

  return (
    <div
      className="min-h-screen bg-page-light dark:bg-page-dark transition-colors duration-300"
      style={{ minHeight: "calc(var(--vh, 1vh) * 100)" }}
    >
      <Header view={view} setView={setView} />
      <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <ProjectList projects={projects} view={view} />
      </main>
      <FAB onCreate={handleCreateProject} />
    </div>
  );
};

export default ProjectManager;
