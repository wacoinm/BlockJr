// src/components/project-selection/ProjectListNew.tsx
import React from "react";
import { Play } from "lucide-react";

/**
 * ProjectListNew
 * - modern card list focused on mobile & readability
 * - each item large, with progress bar and 'باز کردن' action
 * - Persian text
 */

type Checkpoint = { id: string; title: string; locked?: boolean };
type Project = {
  id: string;
  name: string;
  subtitle?: string;
  img?: string;
  progress?: number;
  checkpoints?: Checkpoint[];
};

type Props = {
  projects: Project[];
  onOpen: (p: Project) => void;
};

const ProjectListNew: React.FC<Props> = ({ projects, onOpen }) => {
  return (
    <div className="grid gap-4">
      {projects.map((p) => (
        <div key={p.id} className="bg-white dark:bg-surface rounded-xl p-3 shadow-sm flex gap-3 items-center">
          <div className="w-2/5 rounded-lg overflow-hidden aspect-[4/3]">
            <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 text-right">
            <div className="text-base font-semibold">{p.name}</div>
            <div className="text-sm text-neutral-500 mt-1">{p.subtitle}</div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-neutral-500">پیشرفت: {p.progress}%</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpen(p)}
                  className="px-3 py-1 rounded-md bg-green-600 text-white flex items-center gap-2"
                >
                  <Play className="w-4 h-4" /> باز کردن
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProjectListNew;
