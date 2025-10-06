// src/pages/Packs/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import Header from "../../components/project-manager/Header";
import IconViewToggle from "../../components/project-manager/IconViewToggle";
import PacksGrid from "../../components/packs/PacksGrid";
import QRScannerFAB from "../../components/packs/QRScannerFAB";
import Confetti from "react-confetti";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { loadProjects, saveProjects, saveProjectFile } from "../../utils/projectStorage";
import { toPackId } from "../../utils/slugifyPack";
import { setSelectedPack } from "../../utils/packStorage";

/** RAW packs — user cannot create; only scanning adds them */
const RAW_PACKS = [
  {
    id: "pack-tele-elev-crane",
    name: "پَک آسانسور و تله‌کابین",
    description: "تله‌کابین، آسانسور، جرثقیل",
    items: ["telecabin", "elevator", "crane"],
    qrRaw: "ABCDEFGHIJKLMNOP",
  },
  {
    id: "pack-lift-buildozer",
    name: "پَک ماشین‌آلات سنگین",
    description: "لیفت تراک، بلدوزر",
    items: ["lift truck", "buildozer"],
    qrRaw: "QRSTUVWXYZABCDEF",
  },
];

const PacksPage: React.FC = () => {
  const [packs, setPacks] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "carousel">("list"); // default = list
  const [confetti, setConfetti] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const computed = RAW_PACKS.map((p) => {
      let qr = "";
      try {
        qr = typeof window !== "undefined" && (window as any).btoa ? (window as any).btoa(p.qrRaw) : Buffer.from(p.qrRaw, "binary").toString("base64");
      } catch {
        qr = Buffer.from(p.qrRaw, "binary").toString("base64");
      }
      return { ...p, qr };
    });
    setPacks(computed);
  }, []);

  // When user clicks a pack card
  async function handlePackClick(packId: string) {
    try {
      await setSelectedPack(packId);
    } catch (e) {
      console.warn("Failed to persist selected pack", e);
    }
    // go to project selection page
    navigate("/project");
  }

  async function handleScanned(scanned: string) {
    const matched = packs.find((p) => p.qr === scanned.trim());
    if (!matched) {
      toast.error("کد QR معتبر نیست.");
      return;
    }

    try {
      const projects = (await loadProjects()) || [];
      const baseId = toPackId(matched.name, "آموزشی");
      let finalId = baseId;
      if (projects.find((pj: any) => pj.id === baseId)) {
        finalId = `${baseId.replace(/\.pack$/, "")}-${Date.now().toString(36)}.pack`;
      }
      const newProject = {
        id: finalId,
        name: matched.name,
        category: "آموزشی",
        updatedAt: new Date().toISOString().slice(0, 10),
        files: [],
      };
      await saveProjects([newProject, ...projects]);
      await saveProjectFile(finalId, "pack.json", JSON.stringify({ ...matched, addedAt: new Date().toISOString() }, null, 2));
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3200);
      toast.success(`پَک «${matched.name}» با موفقیت اضافه شد!`);

      // Persist selection for the user and navigate to projects
      try {
        await setSelectedPack(finalId);
      } catch (e) {
        console.warn("Failed to persist selected pack after scan", e);
      }
      navigate("/project");
    } catch (e) {
      console.error("add pack error", e);
      toast.error("خطا در افزودن پَک.");
    }
  }

  const grid = useMemo(
    () => <PacksGrid packs={packs} view={view} onSelectPack={handlePackClick} />,
    [packs, view]
  );

  return (
    <div className="min-h-screen bg-page-light dark:bg-page-dark transition-colors duration-300">
      {confetti && <Confetti recycle={false} numberOfPieces={160} />}

      <Header view={view === "list" ? "list" : "cards"} setView={(v: "cards" | "list") => setView(v === "list" ? "list" : "carousel")} dir="rtl">
        <IconViewToggle view={view === "list" ? "list" : "cards"} setView={(v: "cards" | "list") => setView(v === "list" ? "list" : "carousel")} />
      </Header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 text-right flex flex-col gap-4">
        <div className="mb-4">
          <h1 className="text-3xl font-extrabold">پَک‌های آموزشی</h1>
          <p className="text-neutral-500 mt-1">برای افزودن پَک‌ها از دکمهٔ اسکن استفاده کنید</p>
        </div>

        {grid}
      </main>

      <QRScannerFAB onScanned={handleScanned} />

      <ToastContainer position="top-right" />
    </div>
  );
};

export default PacksPage;
