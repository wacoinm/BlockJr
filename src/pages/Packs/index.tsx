// src/pages/Packs/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { getAllPacks } from "../../utils/manifest";
import { addScannedPack } from "../../utils/scannedPacksStorage";

/** small helper: base64 encode with safe fallbacks */
const encodeBase64 = (s: string) => {
  try {
    if (typeof window !== "undefined" && (window as any).btoa) return (window as any).btoa(s);
  } catch {}
  try {
    // node/bundler fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (globalThis as any).Buffer !== "undefined") return (globalThis as any).Buffer.from(s, "binary").toString("base64");
  } catch {}
  return "";
};

/** Normalize pack-like object to ensure UI fields exist (items, id, name, qr) */
const normalizePack = (p: any) => {
  const qrRaw = p?.qrRaw ?? "";
  const qrBase64 = p?.qrBase64 ?? (qrRaw ? encodeBase64(qrRaw) : p?.qr ?? "");
  const id =
    p?.id ??
    (p?.name ? toPackId(p.name, "آموزشی") : `pack-unknown-${Math.random().toString(36).slice(2, 9)}`);
  const items = Array.isArray(p?.items) ? p.items : Array.isArray(p?.files) ? p.files : [];
  return {
    ...p,
    id,
    name: p?.name ?? p?.id ?? "بدون نام",
    qrRaw,
    qrBase64,
    qr: p?.qr ?? qrBase64 ?? "",
    items,
  };
};

const PacksPage: React.FC = () => {
  // UI-visible packs: starts empty (must show nothing at start)
  const [packs, setPacks] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "carousel">("list");
  const [confetti, setConfetti] = useState(false);
  const navigate = useNavigate();

  // Keep manifest packs in a ref (NOT shown on UI at start). We use this for QR matching.
  const manifestRef = useRef<any[]>([]);

  useEffect(() => {
    // load manifest packs into a ref for matching, but DO NOT put into UI (user wanted "show nothing" at start)
    try {
      const manifestPacks = (getAllPacks() || []).map((p: any) => normalizePack(p));
      manifestRef.current = manifestPacks;
    } catch (e) {
      console.error("Failed to load manifest packs into ref:", e);
      manifestRef.current = [];
    }
  }, []);

  // When user clicks a pack card (visible ones only)
  async function handlePackClick(packId: string) {
    try {
      await setSelectedPack(packId);
    } catch (e) {
      console.warn("Failed to persist selected pack", e);
    }
    navigate("/project");
  }

  async function handleScanned(scanned: string) {
    const s = scanned?.trim?.() ?? "";
    if (!s) {
      toast.error("کد QR نامعتبر است.");
      return;
    }

    // Try to match against manifestRef first (manifest is not shown at start but used for matching)
    let matchedPack = manifestRef.current.find((p: any) => {
      if (!p) return false;
      if (p.qr && String(p.qr).trim() === s) return true;
      if (p.qrBase64 && String(p.qrBase64).trim() === s) return true;
      if (p.qrRaw && String(p.qrRaw).trim() === s) return true;
      if (p.qrRaw && encodeBase64(String(p.qrRaw)).trim() === s) return true;
      return false;
    });

    // If not matched in manifest, create a minimal scanned pack object
    if (!matchedPack) {
      const generatedId = `scanned-${Date.now().toString(36)}.pack`;
      const shortName = s.length <= 40 ? s : `پَک اسکن‌شده ${new Date().toISOString().slice(0, 10)}`;
      matchedPack = normalizePack({
        id: generatedId,
        name: shortName,
        qr: s,
        qrRaw: "",
        qrBase64: "",
        items: [],
      });
    }

    try {
      // persist as project (existing behaviour kept)
      const projects = (await loadProjects()) || [];
      const baseId = toPackId(matchedPack.name, "آموزشی");
      let finalId = baseId;
      if (projects.find((pj: any) => pj.id === baseId)) {
        finalId = `${baseId.replace(/\.pack$/, "")}-${Date.now().toString(36)}.pack`;
      }

      const newProject = {
        id: finalId,
        name: matchedPack.name,
        category: "آموزشی",
        updatedAt: new Date().toISOString().slice(0, 10),
        files: [],
      };

      await saveProjects([newProject, ...projects]);
      await saveProjectFile(finalId, "pack.json", JSON.stringify({ ...matchedPack, addedAt: new Date().toISOString() }, null, 2));

      // Persist scanned pack into its own storage bucket (no duplicates)
      await addScannedPack(matchedPack);

      // Show the newly scanned pack in UI (prepend). Note: at start packs is empty so nothing was shown prior to scan.
      setPacks((prev) => {
        const already = prev.some((p) => p.id === matchedPack.id);
        if (already) return prev;
        return [matchedPack, ...prev];
      });

      setConfetti(true);
      setTimeout(() => setConfetti(false), 3200);
      toast.success(`پَک «${matchedPack.name}» با موفقیت اضافه شد!`);

      // Persist selection and navigate to ProjectSelection
      try {
        await setSelectedPack(matchedPack.id || finalId);
      } catch (e) {
        console.warn("Failed to persist selected pack after scan", e);
      }
      navigate("/project");
    } catch (e) {
      console.error("add pack error", e);
      toast.error("خطا در افزودن پَک.");
    }
  }

  const grid = useMemo(() => <PacksGrid packs={packs} view={view} onSelectPack={handlePackClick} />, [packs, view]);

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
