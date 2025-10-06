// src/pages/ProjectSelection/index.tsx
import React, { useEffect, useState } from "react";
import Header from "../../components/project-manager/Header"; // reuse header
import IconViewToggle from "../../components/project-manager/IconViewToggle";
import EmblaIOSCarousel from "../../components/project-selection/EmblaIOSCarousel";
import ProjectActionSheet from "../../components/project-selection/ProjectActionSheet";
import ProjectListNew from "../../components/project-selection/ProjectListNew";

import { elevator } from "../../assets/stories/elevator";
import { initSession } from "../../utils/sessionStorage";
import { loadProjects } from "../../utils/projectStorage";
import { getSelectedPack } from "../../utils/packStorage";

/**
 * ProjectSelection page
 * - toggle between ios-like carousel (mobile-first) and a new list view
 * - uses dummy data (Persian texts)
 *
 * NOTE: DUMMY_PROJECTS now use the single `imgsPath` key (directory containing PNGs),
 * so components will probe images inside that folder (e.g. "/scense/elevator/1.png", etc).
 */

const DUMMY_PROJECTS = [
  {
    id: "elevator",
    name: "آسانسور",
    subtitle: "پروژه نصب و راه‌اندازی آسانسور",
    project: elevator,
    // single key pointing at the folder with pngs for this project
    imgsPath: "/scenes/elevator/chapters/",
  },
  {
    id: "crane",
    name: "جرثقیل",
    subtitle: "پروژه جرثقیل سقفی",
    // for test we reuse elevator story as you asked
    project: elevator,
    // reusing same imgsPath for now (adjust to your real folder if different)
    imgsPath: "/scenes/crane/chapters/",
    isLock: true,
    lockReason: "محتوا در دست ساخت است"
  },
  {
    id: "gondola",
    name: "تله کابین",
    subtitle: "پروژه احداث تله کابین",
    project: elevator, // reuse elevator for test
    imgsPath: "/scenes/crane/chapters/",
    isLock: true
  },
];

/**
 * Map pack id -> array of category / name / id keywords to match projects.
 * Adjust these keywords if your real project categories/ids differ.
 *
 * This map ensures:
 * - clicking "پَک آسانسور و تله‌کابین" will show elevator, crane, gondola.
 * - clicking other packs shows projects that match their keywords.
 */
const PACK_CATEGORY_MAP: Record<string, string[]> = {
  "pack-tele-elev-crane": [
    "آسانسور",
    "تله کابین",
    "جرثقیل",
    "elevator",
    "gondola",
    "crane",
  ],
  "pack-lift-buildozer": [
    "ماشین‌آلات",
    "ماشین‌آلات سنگین",
    "لیفت",
    "بلدوزر",
    "lift",
    "buildozer",
  ],
};

const ProjectSelection: React.FC = () => {
  const [view, setView] = useState<"carousel" | "list">("carousel");
  const [openProject, setOpenProject] = useState<any | null>(null);

  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [displayProjects, setDisplayProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  // load projects + selected pack, then filter
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 1) load saved projects index (if any)
        let saved: any[] = [];
        try {
          const loaded = await loadProjects();
          if (Array.isArray(loaded) && loaded.length > 0) saved = loaded;
        } catch (e) {
          console.warn("loadProjects failed", e);
          saved = [];
        }

        // 2) fallback to DUMMY_PROJECTS if none saved
        const sourceProjects = saved.length > 0 ? saved : DUMMY_PROJECTS;

        // 3) read selected pack id from storage
        const selPack = await getSelectedPack();
        setSelectedPackId(selPack);

        // 4) filter based on pack
        let filtered = sourceProjects;
        if (selPack) {
          const keywords = PACK_CATEGORY_MAP[selPack] ?? [];
          const lowerKeywords = keywords.map((k) => k.toLowerCase());

          filtered = sourceProjects.filter((proj: any) => {
            const searchable = `${proj.category || ""} ${proj.name || ""} ${proj.id || ""}`.toString().toLowerCase();
            return lowerKeywords.some((kw) => searchable.includes(kw));
          });
        }

        setAllProjects(sourceProjects);
        setDisplayProjects(filtered);
      } catch (err) {
        console.warn("ProjectSelection load/filter failed", err);
        setAllProjects(DUMMY_PROJECTS);
        setDisplayProjects(DUMMY_PROJECTS);
      } finally {
        setLoading(false);
        // ensure sessions exist for displayed projects
        try {
          await Promise.all((displayProjects || DUMMY_PROJECTS).map((p) => initSession(p.id)));
        } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ensure sessions exist for displayed projects whenever they change
  useEffect(() => {
    (async () => {
      try {
        await Promise.all((displayProjects || []).map((p) => initSession(p.id)));
      } catch (e) {
        // ignore
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
        <ProjectActionSheet
          project={openProject}
          onClose={() => setOpenProject(null)}
        />
      )}
    </div>
  );
};

export default ProjectSelection;
