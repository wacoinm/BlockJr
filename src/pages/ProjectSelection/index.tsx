// src/pages/ProjectSelection/index.tsx
import React, { useState } from "react";
import Header from "../../components/project-manager/Header"; // reuse header
import IconViewToggle from "../../components/project-manager/IconViewToggle";
import EmblaIOSCarousel from "../../components/project-selection/EmblaIOSCarousel";
import ProjectActionSheet from "../../components/project-selection/ProjectActionSheet";
import ProjectListNew from "../../components/project-selection/ProjectListNew";

/**
 * ProjectSelection page
 * - toggle between ios-like carousel (mobile-first) and a new list view
 * - uses dummy data (Persian texts)
 */

const DUMMY_PROJECTS = [
  {
    id: "elevator",
    name: "آسانسور",
    subtitle: "پروژه نصب و راه‌اندازی آسانسور",
    progress: 28,
    checkpoints: [
      { id: "cp1", title: "بررسی اولیه", locked: false, description: "بازدید اولیه و بررسی مکان و شرایط نصب." },
      { id: "cp2", title: "نصب ریل", locked: false, description: "نصب ریل‌ها مطابق نقشه و استاندارد." },
      { id: "cp3", title: "راه‌اندازی موتور", locked: true, description: "نصب و تنظیم موتور (قفل شده تا تکمیل مراحل قبل)." },
      { id: "cp4", title: "تست و تحویل", locked: true, description: "تست نهایی و تحویل به کارفرما." },
    ],
    img: "https://placehold.co/800x600?text=elevator",
    imgMobile: "https://placehold.co/480x360?text=elevator+mobile"
  },
  {
    id: "crane",
    name: "جرثقیل",
    subtitle: "پروژه جرثقیل سقفی",
    progress: 54,
    checkpoints: [
      { id: "cp1", title: "نقشه‌برداری", locked: false, description: "جمع‌آوری داده‌های نقشه و تحلیل زمین." },
      { id: "cp2", title: "نصب ستون", locked: false, description: "نصب ستون‌های اصلی و فونداسیون." },
      { id: "cp3", title: "نصب بازو", locked: false, description: "نصب بازوها و اتصالات." },
      { id: "cp4", title: "آزمایش بار", locked: true, description: "آزمایش بار و کنترل ایمنی." },
    ],
    img: "https://placehold.co/800x600?text=crane",
    imgMobile: "https://placehold.co/480x360?text=crane+mobile"
  },
  {
    id: "gondola",
    name: "تله کابین",
    subtitle: "پروژه احداث تله کابین",
    progress: 12,
    checkpoints: [
      { id: "cp1", title: "نقشه مسیر", locked: false, description: "طراحی و بررسی مسیر." },
      { id: "cp2", title: "پایه‌ها", locked: true, description: "ساخت و نصب پایه‌ها." },
      { id: "cp3", title: "کیبل‌کشی", locked: true, description: "نصب کابل‌ها و سیستم هدایت." },
      { id: "cp4", title: "تست مسیر", locked: true, description: "تست مسیر و تحویل." },
    ],
    img: "https://placehold.co/800x600?text=telecabin",
    imgMobile: "https://placehold.co/480x360?text=telecabin+mobile"
  },
];

const ProjectSelection: React.FC = () => {
  const [view, setView] = useState<"carousel" | "list">("carousel");
  const [openProject, setOpenProject] = useState<any | null>(null);

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
