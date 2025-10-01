// src/components/project-manager/ProjectList.tsx
import type { Project } from "../../pages/ProjectManager";
import ProjectCard from "./ProjectCard";

type Props = {
  projects: Project[]; // required projects prop
  view: "cards" | "list";
  onEdit?: (p: Project) => void;
  onDelete?: (id: string) => void;
};

export default function ProjectList({
  projects,
  view,
  onEdit,
  onDelete,
}: Props) {
  // defensive: ensure projects is an array
  const list = Array.isArray(projects) ? projects : [];

  if (list.length === 0) {
    return (
      <div className="py-20 text-center text-neutral-500">
        پروژه‌ای وجود ندارد — با دکمه‌ی + یک پروژه جدید ایجاد کنید.
      </div>
    );
  }

  if (view === "list") {
    return (
      <div className="space-y-3">
        {list.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            listView
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  }

  // cards view (grid)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {list.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
