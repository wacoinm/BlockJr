// src/components/packs/QRScannerFAB.tsx
import React, { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "react-toastify";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { getAllPacks } from "../../utils/manifest";
import { Capacitor } from "@capacitor/core";

type Props = {
  onScanned: (s: string) => void;
};

const SCAN_TIMEOUT_MS = 12000; // if no barcode in this time, show manual entry

const encodeBase64 = (s: string) => {
  try {
    if (typeof window !== "undefined" && (window as any).btoa) return (window as any).btoa(s);
  } catch {}
  try {
    if (typeof (globalThis as any).Buffer !== "undefined") return (globalThis as any).Buffer.from(s, "binary").toString("base64");
  } catch {}
  return "";
};

const QRScannerFAB: React.FC<Props> = ({ onScanned }) => {
  const [scanning, setScanning] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const scanTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  // Keep previous body/html styles to restore
  const savedBodyStyle = useRef<{ background?: string; opacity?: string | null } | null>(null);
  const savedHtmlStyle = useRef<{ background?: string | null } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanSafe();
      clearScanTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearScanTimer() {
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }

  async function restoreBodyStyles() {
    try {
      if (savedBodyStyle.current) {
        document.body.style.background = savedBodyStyle.current.background ?? "";
        document.body.style.opacity = savedBodyStyle.current.opacity ?? "";
        savedBodyStyle.current = null;
      } else {
        document.body.style.background = "";
        document.body.style.opacity = "";
      }
    } catch {}
    try {
      if (savedHtmlStyle.current) {
        (document.documentElement as HTMLElement).style.background = savedHtmlStyle.current.background ?? "";
        savedHtmlStyle.current = null;
      } else {
        (document.documentElement as HTMLElement).style.background = "";
      }
    } catch {}
  }

  async function makeBodyTransparentForCamera() {
    try {
      // save current styles
      savedBodyStyle.current = {
        background: document.body.style.background || "",
        opacity: document.body.style.opacity || "",
      };
      savedHtmlStyle.current = {
        background: (document.documentElement as HTMLElement).style.background || "",
      };
      // make transparent so native camera preview behind webview is visible
      document.body.style.background = "transparent";
      // keep UI visible by leaving opacity as-is (plugin/hideBackground handles native webview bg)
      (document.documentElement as HTMLElement).style.background = "transparent";
    } catch {}
  }

  async function stopScanSafe() {
    try {
      // restore webview/html background so app UI is visible again
      try {
        await (BarcodeScanner as any).showBackground?.();
      } catch {}
    } catch {}
    try {
      await (BarcodeScanner as any).stopScan?.();
    } catch {}
    try {
      await (BarcodeScanner as any).removeAllListeners?.();
    } catch {}
    await restoreBodyStyles();
    setScanning(false);
    clearScanTimer();
  }

  async function openManualEntry(prefill?: string) {
    await stopScanSafe();
    setManualCode(prefill ?? "");
    setShowManual(true);
    setTimeout(() => manualInputRef.current?.focus(), 80);
  }

  function isScannedCodeInManifest(scanned: string): boolean {
    if (!scanned) return false;
    const s = scanned.trim();
    try {
      const packs = getAllPacks() || [];
      for (const p of packs) {
        const raw = (p?.qrRaw ?? "").toString().trim();
        const b64 = (p?.qrBase64 ?? "").toString().trim();
        if (b64 && s === b64) return true;
        if (raw && s === raw) return true;
        if (raw && encodeBase64(raw) === s) return true;
      }
    } catch (e) {
      console.warn("isScannedCodeInManifest: manifest lookup failed", e);
    }
    return false;
  }

  function isManualRawInManifest(rawInput: string): boolean {
    if (!rawInput) return false;
    const r = rawInput.trim();
    try {
      const packs = getAllPacks() || [];
      return packs.some((p) => {
        const raw = (p?.qrRaw ?? "").toString().trim();
        return raw && raw === r;
      });
    } catch (e) {
      console.warn("isManualRawInManifest: manifest lookup failed", e);
    }
    return false;
  }

  // ---- WEB removed: no startScanWeb or BarcodeDetector usage ----

  async function startScan() {
    try {
      // Determine platform: we only support native scanning here.
      const platform = Capacitor.getPlatform?.() ?? "web";
      const isWeb = platform === "web";

      if (isWeb) {
        // Explicitly do not attempt web scanning — open manual entry.
        openManualEntry();
        return;
      }

      // On native platforms, check plugin support properly.
      let supported = false;
      try {
        const sup = await (BarcodeScanner as any).isSupported?.();
        if (typeof sup === "boolean") supported = sup;
        else if (sup && typeof sup === "object") supported = !!(sup.isSupported ?? sup.supported ?? sup.available);
        else supported = false;
      } catch {
        supported = false;
      }

      if (!supported) {
        openManualEntry();
        toast.info("اسکنر در این دستگاه/نسخه پشتیبانی نمی‌شود — لطفاً کد را به صورت دستی وارد کنید.");
        return;
      }

      // request camera permissions
      let granted = false;
      try {
        const perm = await (BarcodeScanner as any).requestPermissions?.();
        if (!perm) granted = false;
        else if (typeof perm === "boolean") granted = perm;
        else {
          granted =
            perm?.granted === true ||
            perm?.camera === "granted" ||
            perm?.camera === "GRANTED" ||
            perm?.camera === "allowed";
        }
      } catch (e) {
        console.warn("requestPermissions error", e);
        granted = false;
      }

      if (!granted) {
        openManualEntry();
        toast.error("دسترسی دوربین داده نشده — لطفاً کد را به صورت دستی وارد کنید.");
        return;
      }

      // prepare background transparency & safe-area: try plugin helper then CSS fallback
      try {
        await (BarcodeScanner as any).hideBackground?.();
      } catch (e) {
        // fallback: try to make body transparent (some plugin versions require this)
        makeBodyTransparentForCamera();
      }

      try {
        await (BarcodeScanner as any).removeAllListeners?.();
      } catch {}

      // listeners
      const handleBarcodes = async (ev: any) => {
        const arr = ev?.barcodes ?? (ev?.barcode ? [ev.barcode] : []);
        if (Array.isArray(arr) && arr.length > 0) {
          const first = arr[0];
          const text = first?.rawValue ?? first?.displayValue ?? first?.value ?? first?.text ?? null;
          if (text) {
            const trimmed = String(text).trim();
            const allowed = isScannedCodeInManifest(trimmed);
            if (!allowed) {
              toast.error("کد QR متعلق به هیچ پَک موجود در مَنیفست نیست.");
              return;
            }
            await stopScanSafe();
            onScanned(trimmed);
          }
        }
      };

      const handleBarcodeScanned = async (ev: any) => {
        const text = ev?.barcode ?? ev?.text ?? ev?.displayValue ?? ev?.rawValue ?? null;
        if (text) {
          const trimmed = String(text).trim();
          const allowed = isScannedCodeInManifest(trimmed);
          if (!allowed) {
            toast.error("کد QR متعلق به هیچ پَک موجود در مَنیفست نیست.");
            return;
          }
          await stopScanSafe();
          onScanned(trimmed);
        }
      };

      try {
        await (BarcodeScanner as any).addListener?.("barcodesScanned", handleBarcodes);
      } catch {}
      try {
        await (BarcodeScanner as any).addListener?.("barcodeScanned", handleBarcodeScanned);
      } catch {}

      setScanning(true);

      clearScanTimer();
      scanTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        openManualEntry();
        toast.info("کد از طریق اسکن دریافت نشد — می‌توانید آن را به صورت دستی وارد کنید.");
      }, SCAN_TIMEOUT_MS);

      // finally start native scan
      await (BarcodeScanner as any).startScan?.();
    } catch (err) {
      console.error("startScan error", err);
      await stopScanSafe();
      openManualEntry();
      toast.error("خطا در باز کردن اسکنر. لطفاً کد را به صورت دستی وارد کنید.");
    }
  }

  async function submitManual() {
    const val = (manualCode || "").trim();
    if (!val) {
      toast.error("لطفاً یک کد وارد کنید.");
      return;
    }
    const allowed = isManualRawInManifest(val);
    if (!allowed) {
      toast.error("کد وارد شده متعلق به هیچ پَک موجود در مَنیفست نیست.");
      return;
    }
    setShowManual(false);
    setManualCode("");
    onScanned(val);
  }

  function cancelManual() {
    setShowManual(false);
    setManualCode("");
  }

  return (
    <>
      {/* FAB */}
      <button
        aria-label="Scan QR"
        onClick={startScan}
        className="fixed bottom-6 left-6 md:right-6 md:left-auto z-50 w-16 h-16 rounded-full shadow-2xl bg-gradient-to-br from-pink-500 to-yellow-400 flex items-center justify-center text-white text-xl"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}
      >
        <Camera className="w-6 h-6" />
      </button>

      {/* Scanning overlay (while scanning) */}
      {scanning && !showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* dim layer */}
          <div className="absolute inset-0 bg-black/20" onClick={() => stopScanSafe()} />
          <div
            className="relative z-50 w-full max-w-md bg-transparent rounded-lg p-6 shadow-none text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold text-white">در حال اسکن...</div>
            <div className="mt-2 text-sm text-white/90">دوربین را به کد QR نزدیک کنید</div>

            {/* transparent scan frame so camera preview is visible through it */}
            <div
              className="mt-4 mx-auto w-[280px] h-[200px] rounded-md border-2 border-white/80 flex items-center justify-center"
              style={{ background: "transparent" }}
            >
              {/* only small label inside frame; frame interior is transparent to show camera */}
              <div className="text-sm text-white/80 pointer-events-none">قاب اسکن</div>
            </div>

            <div className="mt-4 flex gap-3 justify-center">
              <button
                onClick={() => {
                  openManualEntry();
                }}
                className="px-4 py-2 rounded-md border border-white/30 text-white/95 bg-white/10 backdrop-blur-sm"
              >
                ورود دستی
              </button>

              <button
                onClick={() => {
                  stopScanSafe();
                }}
                className="px-4 py-2 rounded-md bg-red-500 text-white"
              >
                بستن
              </button>
            </div>
            <div className="mt-3 text-xs text-white/70">اگر اسکن طولانی شد، می‌توانید به صورت دستی کد را وارد کنید.</div>
          </div>
        </div>
      )}

      {/* Manual entry modal */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={cancelManual} />
          <div className="relative z-50 w-full max-w-lg bg-white dark:bg-neutral-900 rounded-lg p-6 shadow-xl">
            <h3 className="text-lg font-semibold">وارد کردن کد به صورت دستی</h3>
            <p className="mt-2 text-sm text-neutral-500">اگر قادر به اسکن نیستید، کد (qrRaw) را در کادر زیر وارد کنید.</p>

            <div className="mt-4">
              <input
                ref={manualInputRef}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitManual();
                  if (e.key === "Escape") cancelManual();
                }}
                placeholder="کد (qrRaw) را اینجا وارد کنید"
                className="w-full px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none"
                aria-label="Manual QR raw input"
              />
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button onClick={cancelManual} className="px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-700">
                انصراف
              </button>
              <button onClick={submitManual} className="px-4 py-2 rounded-md bg-brand-plain text-white">
                ثبت کد
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QRScannerFAB;
