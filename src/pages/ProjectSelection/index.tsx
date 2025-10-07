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
 * - reads persisted pack id and filters displayed projects using manifest.packToProjectKeywords
 */

type Project = {
  id: string;
  name?: string;
  category?: string;
  [key: string]: any;
};

const ProjectSelection: React.FC = () => {
  const [view, setView] = useState<"carousel" | "list">("carousel");
  const [openProject, setOpenProject] = useState<any | null>(null);

  const [displayProjects, setDisplayProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // load projects from manifest
        const sourceProjects = getAllProjects() as Project[];

        // read selected pack id
        const selPack = await getSelectedPack();
        setSelectedPackId(selPack);

        // filter by pack keywords (if a pack is selected)
        let filtered = sourceProjects;
        if (selPack) {
          const keywords = getPackKeywords(selPack).map((k) => k.toLowerCase());
          filtered = sourceProjects.filter((proj) => {
            const searchable = `${proj.category || ""} ${proj.name || ""} ${proj.id || ""}`.toLowerCase();
            return keywords.some((kw) => searchable.includes(kw));
          });
        }

        setDisplayProjects(filtered);
      } catch (err) {
        console.warn("ProjectSelection load/filter failed", err);
        // fallback: show manifest projects
        const manifestProjects = getAllProjects() as Project[];
        setDisplayProjects(manifestProjects);
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

      {openProject && (
        <ProjectActionSheet project={openProject} onClose={() => setOpenProject(null)} />
      )}
    </div>
  );
};

export default ProjectSelection;
