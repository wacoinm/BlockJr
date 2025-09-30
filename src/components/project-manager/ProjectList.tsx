import React from "react";
import ProjectCard from "./ProjectCard";
import type { Project } from "../../pages/ProjectManager";

interface Props {
  projects?: Project[];
  view?: "cards" | "list";
}

const ProjectList: React.FC<Props> = ({ projects = [], view = "cards" }) => {
  if (projects.length === 0) {
    return (
      <div className="py-20 text-center text-neutral-500 dark:text-neutral-400">
        هنوز پروژه‌ای ندارید — با دکمهٔ «+» یک پروژه بسازید
      </div>
    );
  }

  return (
    <>
      {view === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => <ProjectCard key={p.id} project={p} listView />)}
        </div>
      )}
    </>
  );
};

export default ProjectList;
