// src/pages/ProjectManager/index.tsx
import React, { useEffect, useRef, useState } from "react";
import Header from "../../components/project-manager/Header";
import ProjectList from "../../components/project-manager/ProjectList";
import FAB from "../../components/project-manager/FAB";
import {
  loadProjects,
  saveProjects,
  removeProjectFolder,
  renameProjectFolder,
} from "../../utils/projectStorage";
import { toPackId } from "../../utils/slugifyPack";

export interface Project {
  id: string;
  name: string;
  category?: string;
  updatedAt: string;
  files?: string[];
}

const initialProjects: Project[] = []; // start empty

const defaultCategories = ["آسانسور", "تله کابین", "پلکان برقی", "سایر"];

const ProjectManager: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [view, setView] = useState<"cards" | "list">("cards");
  const mountedRef = useRef(false);

  // edit modal state
  const [editing, setEditing] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("");

  // delete modal state
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

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

  // handle --vh and RTL attribute
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

  // animate new project card
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

  // create project
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

    const packId = toPackId(name, category);
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

  // open delete modal
  function openDeleteModal(project: Project) {
    setDeletingProject(project);
    setDeleting(true);
  }

  function closeDeleteModal() {
    setDeleting(false);
    setDeletingProject(null);
  }

  // confirm deletion
  function confirmDelete() {
    if (!deletingProject) return;
    const id = deletingProject.id;
    setProjects((s) => s.filter((p) => p.id !== id));
    removeProjectFolder(id).catch((e) => console.warn("removeProjectFolder failed", e));
    closeDeleteModal();
  }

  // open edit modal
  function openEditModal(project: Project) {
    setEditingProject(project);
    setEditName(project.name);
    setEditCategory(project.category || "");
    setEditing(true);
  }

  function closeEditModal() {
    setEditing(false);
    setEditingProject(null);
    setEditName("");
    setEditCategory("");
  }

  // save edits
  async function saveEdit() {
    if (!editingProject) return;
    const trimmed = editName?.trim();
    if (!trimmed) return;
    if (!editCategory) return;

    const newIdBase = toPackId(trimmed, editCategory);
    const sameId = newIdBase === editingProject.id;
    let targetId = editingProject.id;

    if (!sameId) {
      const collision = projects.find((p) => p.id === newIdBase);
      if (collision) {
        targetId = `${newIdBase.replace(/\.pack$/, "")}-${Date.now().toString(36)}.pack`;
      } else {
        targetId = newIdBase;
      }
    }

    if (targetId !== editingProject.id) {
      try {
        const ok = await renameProjectFolder(editingProject.id, targetId).catch(() => false);
        if (!ok) {
          setProjects((s) =>
            s.map((p) =>
              p.id === editingProject.id
                ? { ...p, name: trimmed, category: editCategory, updatedAt: new Date().toISOString().slice(0, 10) }
                : p
            )
          );
          closeEditModal();
          return;
        }
      } catch (e) {
        console.warn("renameProjectFolder failed", e);
        setProjects((s) =>
          s.map((p) =>
            p.id === editingProject.id
              ? { ...p, name: trimmed, category: editCategory, updatedAt: new Date().toISOString().slice(0, 10) }
              : p
          )
        );
        closeEditModal();
        return;
      }
    }

    setProjects((s) =>
      s.map((p) =>
        p.id === editingProject.id
          ? { ...p, id: targetId, name: trimmed, category: editCategory, updatedAt: new Date().toISOString().slice(0, 10) }
          : p
      )
    );
    closeEditModal();
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
          onEdit={(p) => openEditModal(p)}
          onDelete={(id) => {
            const proj = projects.find((p) => p.id === id);
            if (proj) openDeleteModal(proj);
          }}
        />
      </main>
      <FAB onCreate={handleCreateProject} />

      {/* Edit Modal */}
      {editing && editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEditModal} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit();
            }}
            className="relative bg-white dark:bg-neutral-900 rounded-2xl p-4 w-full max-w-md shadow-xl z-10 text-right"
          >
            <div className="flex items-center gap-3 justify-between">
              <div className="text-sm font-semibold">ویرایش پروژه</div>
              <button type="button" onClick={closeEditModal} className="text-neutral-500">
                بستن
              </button>
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">نام پروژه</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-2 w-full bg-neutral-50 dark:bg-neutral-800 border border-transparent rounded-lg p-2"
              />
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">دسته‌بندی</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="mt-2 w-full bg-neutral-50 dark:bg-neutral-800 border border-transparent rounded-lg p-2"
              >
                <option value="">انتخاب دسته‌بندی</option>
                {defaultCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeEditModal} className="px-3 py-1 rounded-md border">انصراف</button>
              <button type="submit" className="px-4 py-1 rounded-md bg-brand-plain text-white">ذخیره</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Modal */}
      {deleting && deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDeleteModal} />
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl p-4 w-full max-w-sm shadow-xl z-10 text-right">
            <div className="text-sm font-semibold mb-4">
              آیا می‌خواهید پروژه <span className="font-bold">{deletingProject.name}</span> حذف شود؟
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeDeleteModal} className="px-3 py-1 rounded-md border">انصراف</button>
              <button type="button" onClick={confirmDelete} className="px-4 py-1 rounded-md bg-red-500 text-white">حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManager;
