// src/pages/ProjectManager/index.tsx
import React, { useEffect, useRef, useState } from "react";
import Header from "../../components/project-manager/Header";
import ProjectList from "../../components/project-manager/ProjectList";
import FAB from "../../components/project-manager/FAB";
import { loadProjects, saveProjects, removeProjectFolder, renameProjectFolder } from "../../utils/projectStorage";
import { toPackId } from "../../utils/slugifyPack";

export interface Project {
  id: string;
  name: string;
  category?: string;
  updatedAt: string;
  files?: string[];
}

const initialProjects: Project[] = []; // start empty

const ProjectManager: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [view, setView] = useState<"cards" | "list">("cards");
  const mountedRef = useRef(false);

  // load persisted projects on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadProjects();
        if (stored && stored.length) setProjects(stored);
      } catch (e) {
        console.warn("loadProjects failed", e);
      }
    })();
  }, []);

  // persist on changes
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    saveProjects(projects).catch((e) => console.warn("saveProjects failed", e));
  }, [projects]);

  // handle --vh and RTL attribute (unchanged from your original behavior)
  useEffect(() => {
    const setSmallHeight = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setSmallHeight();
    window.addEventListener("resize", setSmallHeight);

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

  // animate new project card (first element)
  function animateNewProject() {
    requestAnimationFrame(() => {
      try {
        const container = document.querySelector(view === "cards" ? ".grid" : ".space-y-3");
        if (!container) return;
        const el = container.firstElementChild as HTMLElement | null;
        if (!el) return;
        el.animate(
          [
            { transform: "translateY(10px) scale(0.98)", opacity: 0 },
            { transform: "translateY(-6px) scale(1.03)", opacity: 1, offset: 0.6 },
            { transform: "translateY(0px) scale(1)", opacity: 1 },
          ],
          { duration: 420, easing: "cubic-bezier(.2,.9,.2,1)" }
        );
      } catch {
        // ignore
      }
    });
  }

  // handle create: FAB sends payload { name, category }
  function handleCreateProject(payloadOrName: any) {
    let name: string | undefined;
    let category: string | undefined;
    if (typeof payloadOrName === "string") {
      name = payloadOrName;
      category = "سایر";
    } else if (payloadOrName && typeof payloadOrName === "object") {
      name = payloadOrName.name;
      category = payloadOrName.category;
    }

    if (!name || !name.trim()) return;
    if (!category) category = "سایر";

    const packId = toPackId(name);
    const exists = projects.find((p) => p.id === packId);
    const id = exists ? `${packId.replace(/\.pack$/, "")}-${Date.now().toString(36)}.pack` : packId;

    const project: Project = {
      id,
      name: name.trim(),
      category,
      updatedAt: new Date().toISOString().slice(0, 10),
      files: [],
    };

    setProjects((s) => [project, ...s]);

    setTimeout(() => animateNewProject(), 40);
  }

  // delete project and cleanup folder
  function handleDeleteProject(id: string) {
    if (!id) return;
    setProjects((s) => s.filter((p) => p.id !== id));
    removeProjectFolder(id).catch((e) => console.warn("removeProjectFolder failed", e));
  }

  // edit project using prompt (keeps UI unchanged). Attempts folder migration if name changed.
  async function handleEditProject(project: Project) {
    try {
      const newName = window.prompt("New project name:", project.name);
      if (newName === null) return;
      const trimmed = newName.trim();
      if (!trimmed) return;

      const newCategory = window.prompt("Project category:", project.category || "");
      if (newCategory === null) return;

      const newId = toPackId(trimmed);

      if (newId !== project.id) {
        const ok = await renameProjectFolder(project.id, newId).catch(() => false);
        if (ok) {
          setProjects((s) =>
            s.map((p) =>
              p.id === project.id
                ? { ...p, id: newId, name: trimmed, category: newCategory || p.category, updatedAt: new Date().toISOString().slice(0, 10) }
                : p
            )
          );
        } else {
          setProjects((s) =>
            s.map((p) =>
              p.id === project.id
                ? { ...p, name: trimmed, category: newCategory || p.category, updatedAt: new Date().toISOString().slice(0, 10) }
                : p
            )
          );
        }
      } else {
        setProjects((s) =>
          s.map((p) =>
            p.id === project.id ? { ...p, name: trimmed, category: newCategory || p.category, updatedAt: new Date().toISOString().slice(0, 10) } : p
          )
        );
      }
    } catch (e) {
      console.warn("handleEditProject failed", e);
    }
  }

  return (
    <div
      className="min-h-screen bg-page-light dark:bg-page-dark transition-colors duration-300"
      style={{ minHeight: "calc(var(--vh, 1vh) * 100)" }}
    >
      <Header view={view} setView={setView} />
      <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <ProjectList
          projects={projects}
          view={view}
          onEdit={handleEditProject}
          onDelete={handleDeleteProject}
        />
      </main>
      <FAB onCreate={handleCreateProject} />
    </div>
  );
};

export default ProjectManager;
