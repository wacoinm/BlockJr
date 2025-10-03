// src/pages/ProjectSelection/index.tsx
import React, { useEffect, useState } from "react";
import Header from "../../components/project-manager/Header"; // reuse header
import IconViewToggle from "../../components/project-manager/IconViewToggle";
import EmblaIOSCarousel from "../../components/project-selection/EmblaIOSCarousel";
import ProjectActionSheet from "../../components/project-selection/ProjectActionSheet";
import ProjectListNew from "../../components/project-selection/ProjectListNew";

// import the elevator story you added
import { elevator } from "../../assets/stories/elevator";
import { initSession } from "../../utils/sessionStorage";

/**
 * ProjectSelection page
 * - toggle between ios-like carousel (mobile-first) and a new list view
 * - uses dummy data (Persian texts)
 *
 * NOTE: DUMMY_PROJECTS no longer carry `progress` or `checkpoints` fields.
 * Instead each entry has `project` which points to story assets (e.g. elevator).
 */

const DUMMY_PROJECTS = [
  {
    id: "elevator",
    name: "آسانسور",
    subtitle: "پروژه نصب و راه‌اندازی آسانسور",
    project: elevator,
    img: "https://placehold.co/800x600?text=elevator",
    imgMobile: "https://placehold.co/480x360?text=elevator+mobile"
  },
  {
    id: "crane",
    name: "جرثقیل",
    subtitle: "پروژه جرثقیل سقفی",
    // for test we reuse elevator story as you asked
    project: elevator,
    img: "https://placehold.co/800x600?text=crane",
    imgMobile: "https://placehold.co/480x360?text=crane+mobile"
  },
  {
    id: "gondola",
    name: "تله کابین",
    subtitle: "پروژه احداث تله کابین",
    project: elevator, // reuse elevator for test
    img: "https://placehold.co/800x600?text=telecabin",
    imgMobile: "https://placehold.co/480x360?text=telecabin+mobile"
  },
];

const ProjectSelection: React.FC = () => {
  const [view, setView] = useState<"carousel" | "list">("carousel");
  const [openProject, setOpenProject] = useState<any | null>(null);

  // ensure each project's session exists (step=1, progress=0%) when page mounts
  useEffect(() => {
    (async () => {
      try {
        await Promise.all(DUMMY_PROJECTS.map((p) => initSession(p.id)));
      } catch (e) {
        console.warn("Failed to init sessions for dummy projects", e);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-page-light dark:bg-page-dark transition-colors duration-300">
      <Header view={view} setView={setView} dir="rtl">
        <IconViewToggle view={view} setView={setView} />
      </Header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        {view === "list" ? (
          <ProjectListNew projects={DUMMY_PROJECTS} onOpen={(p) => setOpenProject(p)} />
        ) : (
          <EmblaIOSCarousel projects={DUMMY_PROJECTS} onOpen={(p) => setOpenProject(p)} />
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
