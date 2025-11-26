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
import { addScannedPack, getScannedPacks } from "../../utils/scannedPacksStorage";

const encodeBase64 = (s: string) => {
  try {
    if (typeof window !== "undefined" && (window as any).btoa) return (window as any).btoa(s);
  } catch {}
  try {
    if (typeof (globalThis as any).Buffer !== "undefined") return (globalThis as any).Buffer.from(s, "binary").toString("base64");
  } catch {}
  return "";
};

const normalizeKey = (s: any) => {
  if (s === null || s === undefined) return "";
  let str = String(s);
  try {
    str = decodeURIComponent(str);
  } catch (e) {}
  str = str.replace(/[()]/g, " ");
  str = str.replace(/[^À-\u017Fa-zA-Z0-9\p{L}\p{N}]+/gu, "-");
  str = str.replace(/-+/g, "-");
  str = str.replace(/^-|-$/g, "");
  return str.trim().toLowerCase();
};

const PacksPage: React.FC = () => {
  const [packs, setPacks] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "carousel">("list");
  const [confetti, setConfetti] = useState(false);
  const navigate = useNavigate();
  const manifestRef = useRef<any[]>([]);

  useEffect(() => {
    try {
      const manifestPacks = (getAllPacks() || []).map((p: any) => normalizePack(p));
      manifestRef.current = manifestPacks;
    } catch (e) {
      console.error("Failed to load manifest packs:", e);
      manifestRef.current = [];
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const scanned = (await getScannedPacks().catch(() => [])) as any[];
        const normalized = (scanned || []).map((s) => normalizePack(s));
        setPacks(normalized);
      } catch (err) {
        console.warn("Failed to load scanned packs", err);
        setPacks([]);
      }
    })();
  }, []);

  async function handlePackClick(packIdentifier: string) {
    try {
      const raw = String(packIdentifier ?? "");
      const decoded = (() => {
        try { return decodeURIComponent(raw); } catch { return raw; }
      })();

      const list = manifestRef.current || [];
      const found = list.find((p: any) =>
        normalizeKey(p.id) === normalizeKey(decoded) ||
        normalizeKey(p.name) === normalizeKey(decoded) ||
        normalizeKey(p.id) === normalizeKey(raw) ||
        normalizeKey(p.name) === normalizeKey(raw)
      );

      const canonical = (found ? String(found.id) : String(decoded || raw)).replace(/\.pack$/i, "");

      await setSelectedPack(canonical).catch(() => {});
      navigate(`/project/p/${encodeURIComponent(canonical)}`);
    } catch (e) {
      console.warn("handlePackClick fallback:", e);
      const fallback = String(packIdentifier ?? "").replace(/\.pack$/i, "");
      navigate(`/project/p/${encodeURIComponent(fallback)}`);
    }
  }

  // keep normalizePack close to this file so normalization is consistent with packs list
  const normalizePack = (p: any) => {
    const qrRaw = p?.qrRaw ?? "";
    const qrBase64 = p?.qrBase64 ?? (qrRaw ? encodeBase64(qrRaw) : p?.qr ?? "");
    const id = p?.id ?? (p?.name ? toPackId(p.name, "آموزشی") : `pack-unknown-${Math.random().toString(36).slice(2, 9)}`);
    const items = p.projects.map((data: any) => data.name);
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

  async function handleScanned(scanned: string) {
    const s = scanned?.trim?.() ?? "";
    if (!s) {
      toast.error("کد QR نامعتبر است.");
      return;
    }

    // Try to find a manifest pack that matches the scanned code
    let matchedPack = manifestRef.current.find((p: any) => {
      if (!p) return false;
      if (p.qr && String(p.qr).trim() === s) return true;
      if (p.qrBase64 && String(p.qrBase64).trim() === s) return true;
      if (p.qrRaw && String(p.qrRaw).trim() === s) return true;
      if (p.qrRaw && encodeBase64(String(p.qrRaw)).trim() === s) return true;
      return false;
    });

    const matchedFromManifest = !!matchedPack;

    if (!matchedPack) {
      const generatedId = `scanned-${Date.now().toString(36)}.pack`;
      const shortName = s.length <= 40 ? s : `پک اسکن‌شده ${new Date().toISOString().slice(0, 10)}`;
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
      const projects = (await loadProjects()) || [];

      // If the scanned pack is from the manifest, *preserve the manifest id* (do not regenerate
      // using the localized name). For non-manifest scanned packs, keep the existing behavior
      // (generate a slug using toPackId(name, category)).
      let finalId: string;

      if (matchedFromManifest && matchedPack && matchedPack.id) {
        // use manifest id verbatim (strip .pack if present for consistency)
        finalId = String(matchedPack.id).replace(/\.pack$/i, "");
      } else {
        const baseId = toPackId(matchedPack.name, "آموزشی");
        finalId = baseId;
        if (projects.find((pj: any) => pj.id === baseId)) {
          finalId = `${baseId.replace(/\.pack$/i, "")}-${Date.now().toString(36)}.pack`;
        }
      }

      const newProject = {
        id: finalId,
        name: matchedPack.name,
        category: "آموزشی",
        updatedAt: new Date().toISOString().slice(0, 10),
        files: [],
      };

      matchedPack.id = finalId;

      await saveProjects([newProject, ...projects]);
      await saveProjectFile(finalId, "pack.json", JSON.stringify({ ...matchedPack, addedAt: new Date().toISOString() }, null, 2));
      await addScannedPack(matchedPack);

      setPacks((prev) => {
        const already = prev.some((p) => p.id === matchedPack.id);
        if (already) return prev.map((p) => (p.id === matchedPack.id ? normalizePack(matchedPack) : p));
        return [normalizePack(matchedPack), ...prev];
      });

      setConfetti(true);
      setTimeout(() => setConfetti(false), 3200);
      toast.success(`پک «${matchedPack.name}» با موفقیت اضافه شد!`);

      // Persist selected pack and keep the canonical form (manifest id when available)
      await setSelectedPack(String(finalId)).catch(() => {});
    } catch (e) {
      console.error("add pack error", e);
      toast.error("خطا در افزودن پک.");
    }
  }

  const grid = useMemo(() => <PacksGrid packs={packs} view={view} onSelectPack={handlePackClick} />, [packs, view]);

  return (
    <div className="min-h-screen bg-page-light dark:bg-page-dark transition-colors duration-300">
      {confetti && <Confetti recycle={false} numberOfPieces={160} />}

      <Header view={view === "list" ? "list" : "cards"} setView={(v) => setView(v === "list" ? "list" : "carousel")} dir="rtl">
        <IconViewToggle view={view === "list" ? "list" : "cards"} setView={(v) => setView(v === "list" ? "list" : "carousel")} />
      </Header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 text-right flex flex-col gap-4">
        <div className="mb-4">
          <h1 className="text-3xl font-extrabold">پک‌های آموزشی</h1>
          <p className="text-neutral-500 mt-1">برای افزودن پک‌ها از دکمهٔ اسکن استفاده کنید</p>
        </div>

        {packs.length === 0 ? (
          <div className="py-12 text-center">
            <h2 className="text-2xl font-semibold">هیچ پَکی یافت نشد</h2>
            <p className="mt-2 text-neutral-500">برای افزودن پک از QR استفاده کنید.</p>
          </div>
        ) : (
          grid
        )}
      </main>

      <QRScannerFAB onScanned={handleScanned} />
      {/* <ToastContainer position="top-right" /> */}
    </div>
  );
};

export default PacksPage;
