// src/pages/ProjectSelection/index.tsx
import React, { useEffect, useState } from "react";
import Header from "../../components/project-manager/Header";
import IconViewToggle from "../../components/project-manager/IconViewToggle";
import EmblaIOSCarousel from "../../components/project-selection/EmblaIOSCarousel";
import ProjectActionSheet from "../../components/project-selection/ProjectActionSheet";
import ProjectListNew from "../../components/project-selection/ProjectListNew";

import { initSession } from "../../utils/sessionStorage";
import { getSelectedPack } from "../../utils/packStorage";
import { getAllProjects, getPackKeywords } from "../../utils/manifest";

/**
 * ProjectSelection page
 * - loads projects from manifest
 * - attempts to enrich each project by importing a story module from ../../assets/stories/<id>
 * - attaches `.project` (story object) and `.checkpoints` derived from it when possible,
 *   so downstream components (ProjectActionSheet / EmblaIOSCarousel) behave like the old dummy data.
 */

type Project = {
  id: string;
  name?: string;
  category?: string;
  subtitle?: string;
  imgsPath?: string;
  progress?: number;
  isLock?: boolean;
  lockReason?: string;
  // enriched:
  project?: any; // story module object (e.g. elevator)
  checkpoints?: { id: string; title?: string }[];
  [key: string]: any;
};

const ProjectSelection: React.FC = () => {
  const [view, setView] = useState<"carousel" | "list">("carousel");
  const [openProject, setOpenProject] = useState<any | null>(null);

  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // load raw manifest projects
        const sourceProjects = (getAllProjects() || []) as Project[];

        // attempt to enrich projects by importing story modules from ../../assets/stories/<id>
        const enriched = await Promise.all(
          sourceProjects.map(async (p) => {
            let storyObj: any = null;
            try {
              // dynamic import - match the same heuristic Embla uses
              // bundlers will only include folders actually present (e.g. src/assets/stories/elevator)
              // so this will succeed for the elevator demo and gracefully fail for others.
              // eslint-disable-next-line no-await-in-loop
              const mod: any = await import(`../../assets/stories/${p.id}`).catch(() => null);
              if (mod) {
                storyObj = mod[p.id] ?? mod.default ?? mod.elevator ?? mod;
              }
            } catch (err) {
              // ignore - missing module is expected for many projects
            }

            // if the manifest already provided explicit checkpoints, keep them
            let checkpoints = Array.isArray((p as any).checkpoints) ? (p as any).checkpoints : undefined;

            // if no checkpoints but we have a story object, derive them from story keys
            if ((!checkpoints || checkpoints.length === 0) && storyObj && typeof storyObj === "object") {
              checkpoints = Object.keys(storyObj).map((k) => ({ id: k, title: k }));
            }

            return {
              ...p,
              project: storyObj ?? p.project, // attach story object if found
              checkpoints: checkpoints ?? p.checkpoints ?? [],
            } as Project;
          })
        );

        // read persisted selected pack
        const selPack = await getSelectedPack();
        setSelectedPackId(selPack);

        // filter by pack keywords if a pack is selected
        let filtered = enriched;
        if (selPack) {
          const keywords = getPackKeywords(selPack || "").map((k) => k.toLowerCase());
          filtered = enriched.filter((proj) => {
            const searchable = `${proj.category || ""} ${proj.name || ""} ${proj.id || ""}`.toLowerCase();
            return keywords.some((kw) => searchable.includes(kw));
          });
        }

        setDisplayProjects(filtered);
      } catch (err) {
        console.warn("ProjectSelection load/filter failed", err);
        // fallback: show manifest projects un-enriched
        setDisplayProjects((getAllProjects() || []) as Project[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ensure sessions exist for displayed projects whenever they change
  useEffect(() => {
    (async () => {
      try {
        await Promise.all((displayProjects || []).map((p) => initSession(p.id)));
      } catch {
        // ignore session init errors
      }
    })();
  }, [displayProjects]);

  return (
    <div className="min-h-screen bg-page-light dark:bg-page-dark transition-colors duration-300">
      <Header view={view} setView={setView} dir="rtl">
        <IconViewToggle view={view} setView={setView} />
      </Header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        {loading ? (
          <div className="py-20 text-center text-neutral-500">در حال بارگذاری...</div>
        ) : selectedPackId && displayProjects.length === 0 ? (
          <div className="py-12 text-center">
            <h2 className="text-2xl font-semibold">هیچ پروژه‌ای در این پَک یافت نشد</h2>
            <p className="mt-2 text-neutral-500">ممکن است هنوز پروژه‌ای به این پَک اضافه نشده باشد.</p>
          </div>
        ) : view === "list" ? (
          <ProjectListNew projects={displayProjects} onOpen={(p) => setOpenProject(p)} />
        ) : (
          <EmblaIOSCarousel projects={displayProjects} onOpen={(p) => setOpenProject(p)} />
        )}
      </main>

      {openProject && <ProjectActionSheet project={openProject} onClose={() => setOpenProject(null)} />}
    </div>
  );
};

export default ProjectSelection;
