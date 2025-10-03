// src/components/project-selection/ProjectListNew.tsx
import React from "react";
import { Play } from "lucide-react";

type Project = {
  id: string;
  name: string;
  subtitle?: string;
  img?: string;
  progress?: number;
  project?: any;
};

type Props = {
  projects: Project[];
  onOpen: (p: Project) => void;
};

const ProjectListNew: React.FC<Props> = ({ projects, onOpen }) => {
  return (
    <div className="space-y-3">
      {projects.map((p) => {
        const progress = p.progress ?? 0;
        return (
          <div
            key={p.id}
            className="flex items-center justify-between bg-white dark:bg-neutral-900 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-100 dark:bg-neutral-800">
                {p.img ? <img src={p.img} alt={p.name} className="w-full h-full object-cover" /> : null}
              </div>
              <div className="text-right">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-neutral-500 mt-1">{p.subtitle}</div>
                <div className="text-xs text-neutral-400 mt-2">پیشرفت: {progress}%</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => onOpen(p)}
                className="px-3 py-2 rounded-full bg-slate-800 text-white inline-flex items-center gap-2"
                aria-label={`Open ${p.name}`}
              >
                <Play size={16} />
                باز کردن
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectListNew;
