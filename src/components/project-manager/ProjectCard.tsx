// src/components/project-manager/ProjectCard.tsx
import React from "react";
import { generateSVGDataURL } from "../../utils/projectImage";
import type { Project } from "../../pages/ProjectManager";

interface Props {
  project: Project;
  listView?: boolean;
  onEdit?: (project: Project) => void;
  onDelete?: (id: string) => void;
}

const formatDateFa = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
};

const ProjectCard: React.FC<Props> = ({ project, listView = false, onEdit, onDelete }) => {
  const thumb = generateSVGDataURL(project.name, 420, 260);

  return (
    <article
      className={
        "group relative rounded-2xl overflow-hidden shadow-sm transform transition-all duration-300 " +
        (listView ? "flex items-center gap-4 p-3 bg-card-light dark:bg-card-dark" : "bg-transparent")
      }
      style={{ willChange: "transform, box-shadow" }}
    >
      {!listView && (
        <div className="w-full aspect-[16/9] rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          <img src={thumb} alt={project.name} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-400" />
        </div>
      )}

      <div className={listView ? "flex-1" : "mt-3 text-right"}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{project.name}</h3>
          <div className="text-xs text-neutral-400 dark:text-neutral-300">{formatDateFa(project.updatedAt)}</div>
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {`شناسه پروژه: ${project.id}`}
        </p>
        <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            className="px-3 py-1 rounded-full text-xs  text-white dark:text-black bg-slate-500 dark:bg-white/70"
            onClick={() => onEdit && onEdit(project)}
          >
            ویرایش
          </button>
          <button
            className="px-3 py-1 rounded-full text-xs text-white dark:text-black bg-red-500 dark:bg-red-600/70 shadow-sm"
            onClick={() => onDelete && onDelete(project.id)}
          >
            حذف
          </button>
        </div>
      </div>

      {listView && (
        <div className="w-28 h-16 flex-none rounded-lg overflow-hidden">
          <img src={thumb} alt={project.name} className="w-full h-full object-cover" />
        </div>
      )}
    </article>
  );
};

export default ProjectCard;
