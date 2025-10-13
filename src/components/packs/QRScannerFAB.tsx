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
    if (typeof window !== "undefined" && (window as any).btoa)
      return (window as any).btoa(s);
  } catch {}
  try {
    if (typeof (globalThis as any).Buffer !== "undefined")
      return (globalThis as any).Buffer.from(s, "binary").toString("base64");
  } catch {}
  return "";
};

const FRAME_W = 280;
const FRAME_H = 200;

// id used for injected style element
const GLOBAL_STYLE_ID = "qr-scan-exempt-style";

const QRScannerFAB: React.FC<Props> = ({ onScanned }) => {
  const [scanning, setScanning] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const scanTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  // Keep previous body/html styles to restore (save both background and backgroundColor + opacity)
  const savedBodyStyle = useRef<{
    background?: string;
    backgroundColor?: string;
    opacity?: string | null;
  } | null>(null);
  const savedHtmlStyle = useRef<{ background?: string; backgroundColor?: string } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanSafe();
      clearScanTimer();
      removeGlobalExemptMode();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearScanTimer() {
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }

  // Inject CSS that hides everything under #root except elements with .qr-scan-exempt (and their descendants).
  function injectGlobalExemptStyle() {
    if (typeof document === "undefined") return;
    if (document.getElementById(GLOBAL_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = GLOBAL_STYLE_ID;

    // Key idea:
    // 1) hide all elements under #root
    // 2) re-enable .qr-scan-exempt and its children
    // 3) make <html> / body transparent so native preview can show
    style.innerHTML = `
      /* hide everything inside #root while scan is active */
      html.qr-scan-active #root * {
        visibility: hidden !important;
        pointer-events: none !important;
        user-select: none !important;
      }

      /* make exempt elements visible & interactive again */
      html.qr-scan-active .qr-scan-exempt,
      html.qr-scan-active .qr-scan-exempt * {
        visibility: visible !important;
        pointer-events: auto !important;
        user-select: text !important;
      }

      /* keep the top-level exempt container on top (in case stacking contexts differ) */
      html.qr-scan-active .qr-scan-exempt {
        position: relative !important;
        z-index: 2147483647 !important; /* very high */
      }

      /* ensure backgrounds are transparent so native preview shows through */
      html.qr-scan-active,
      html.qr-scan-active body,
      html.qr-scan-active #root {
        background: transparent !important;
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }

  function removeGlobalExemptStyle() {
    if (typeof document === "undefined") return;
    const el = document.getElementById(GLOBAL_STYLE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function applyGlobalExemptMode() {
    try {
      if (typeof document === "undefined") return;
      injectGlobalExemptStyle();
      document.documentElement.classList.add("qr-scan-active");
    } catch (e) {
      console.warn("applyGlobalExemptMode failed", e);
    }
  }

  function removeGlobalExemptMode() {
    try {
      if (typeof document === "undefined") return;
      document.documentElement.classList.remove("qr-scan-active");
      // small delay to allow any UI transitions to finish -> then remove style
      setTimeout(removeGlobalExemptStyle, 50);
    } catch (e) {
      console.warn("removeGlobalExemptMode failed", e);
    }
  }

  async function restoreBodyStyles() {
    try {
      if (savedBodyStyle.current) {
        document.body.style.background = savedBodyStyle.current.background ?? "";
        document.body.style.backgroundColor = savedBodyStyle.current.backgroundColor ?? "";
        document.body.style.opacity = savedBodyStyle.current.opacity ?? "";
        savedBodyStyle.current = null;
      } else {
        document.body.style.background = "";
        document.body.style.backgroundColor = "";
        document.body.style.opacity = "";
      }
    } catch {}
    try {
      if (savedHtmlStyle.current) {
        (document.documentElement as HTMLElement).style.background =
          savedHtmlStyle.current.background ?? "";
        (document.documentElement as HTMLElement).style.backgroundColor =
          savedHtmlStyle.current.backgroundColor ?? "";
        savedHtmlStyle.current = null;
      } else {
        (document.documentElement as HTMLElement).style.background = "";
        (document.documentElement as HTMLElement).style.backgroundColor = "";
      }
    } catch {}
  }

  async function makeBodyTransparentForCamera() {
    try {
      // save current styles
      savedBodyStyle.current = {
        background: document.body.style.background || "",
        backgroundColor: document.body.style.backgroundColor || "",
        opacity: document.body.style.opacity || "",
      };
      savedHtmlStyle.current = {
        background: (document.documentElement as HTMLElement).style.background || "",
        backgroundColor:
          (document.documentElement as HTMLElement).style.backgroundColor || "",
      };
      // make transparent so native camera preview behind webview is visible
      document.body.style.background = "transparent";
      document.body.style.backgroundColor = "transparent";
      (document.documentElement as HTMLElement).style.background = "transparent";
      (document.documentElement as HTMLElement).style.backgroundColor = "transparent";
    } catch (e) {
      console.warn("makeBodyTransparentForCamera failed", e);
    }
  }

  async function stopScanSafe() {
    try {
      // stop native scanning first
      try {
        await (BarcodeScanner as any).stopScan?.();
      } catch (e) {
        // ignore
      }
    } catch {}

    try {
      // remove any listeners
      await (BarcodeScanner as any).removeAllListeners?.();
    } catch {}

    try {
      // restore native webview background (plugin helper)
      await (BarcodeScanner as any).showBackground?.();
    } catch (e) {
      // ignore
    }

    // remove our global "only-exempt-visible" mode
    removeGlobalExemptMode();

    // restore CSS styles after removing class
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
        else if (sup && typeof sup === "object")
          supported = !!(sup.isSupported ?? sup.supported ?? sup.available);
        else supported = false;
      } catch {
        supported = false;
      }

      if (!supported) {
        openManualEntry();
        toast.info(
          "اسکنر در این دستگاه/نسخه پشتیبانی نمی‌شود — لطفاً کد را به صورت دستی وارد کنید."
        );
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
        await makeBodyTransparentForCamera();
      }

      // IMPORTANT: now make entire app visually hidden except our exempt UI
      applyGlobalExemptMode();

      try {
        await (BarcodeScanner as any).removeAllListeners?.();
      } catch {}

      // listeners
      const handleBarcodes = async (ev: any) => {
        const arr = ev?.barcodes ?? (ev?.barcode ? [ev.barcode] : []);
        if (Array.isArray(arr) && arr.length > 0) {
          const first = arr[0];
          const text =
            first?.rawValue ?? first?.displayValue ?? first?.value ?? first?.text ?? null;
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
      try {
        await (BarcodeScanner as any).startScan?.();
      } catch (e) {
        // if startScan throws, ensure we cleanup and fallback to manual
        console.warn("startScan plugin error", e);
        await stopScanSafe();
        openManualEntry();
        toast.error("خطا در باز کردن اسکنر. لطفاً کد را به صورت دستی وارد کنید.");
      }
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

  // Build a 4-part overlay that leaves a transparent center (قاب)
  const overlayParts = (
    <>
      {/* top */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: `calc(50% - ${FRAME_H / 2}px)`,
          background: "rgba(0,0,0,0.64)",
        }}
        onClick={() => stopScanSafe()}
      />
      {/* bottom */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: `calc(50% - ${FRAME_H / 2}px)`,
          background: "rgba(0,0,0,0.64)",
        }}
        onClick={() => stopScanSafe()}
      />
      {/* left */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: `calc(50% - ${FRAME_H / 2}px)`,
          bottom: `calc(50% - ${FRAME_H / 2}px)`,
          width: `calc(50% - ${FRAME_W / 2}px)`,
          background: "rgba(0,0,0,0.64)",
        }}
        onClick={() => stopScanSafe()}
      />
      {/* right */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: `calc(50% - ${FRAME_H / 2}px)`,
          bottom: `calc(50% - ${FRAME_H / 2}px)`,
          width: `calc(50% - ${FRAME_W / 2}px)`,
          background: "rgba(0,0,0,0.64)",
        }}
        onClick={() => stopScanSafe()}
      />
      {/* frame border */}
      <div
        style={{
          position: "absolute",
          left: `calc(50% - ${FRAME_W / 2}px)`,
          top: `calc(50% - ${FRAME_H / 2}px)`,
          width: `${FRAME_W}px`,
          height: `${FRAME_H}px`,
          borderRadius: 12,
          boxSizing: "border-box",
          border: "2px solid rgba(255,255,255,0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>قاب اسکن</div>
      </div>
    </>
  );

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

      {/* Scanning overlay & Manual modal are wrapped in .qr-scan-exempt so they remain visible during global masking */}
      <div className="qr-scan-exempt">
        {/* Scanning overlay (while scanning) */}
        {scanning && !showManual && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* We replaced a single full-screen semi-opaque layer with 4 parts so the center remains transparent */}
            <div
              className="absolute inset-0"
              style={{ pointerEvents: "auto" }}
              // clicks on outer overlays will stop scan (handled in overlayParts)
            >
              {overlayParts}
            </div>

            <div
              className="relative z-50 w-full max-w-md bg-transparent rounded-lg p-6 shadow-none text-center"
              onClick={(e) => e.stopPropagation()}
              style={{ pointerEvents: "auto" }}
            >
              <div className="text-lg font-semibold text-white">در حال اسکن...</div>
              <div className="mt-2 text-sm text-white/90">دوربین را به کد QR نزدیک کنید</div>

              <div
                className="mt-4 mx-auto rounded-md flex items-center justify-center"
                style={{
                  width: FRAME_W,
                  height: FRAME_H,
                  background: "transparent",
                  pointerEvents: "none",
                }}
              >
                {/* frame interior is transparent to show camera behind the webview */}
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
              <div className="mt-3 text-xs text-white/70">
                اگر اسکن طولانی شد، می‌توانید به صورت دستی کد را وارد کنید.
              </div>
            </div>
          </div>
        )}

        {/* Manual entry modal */}
        {showManual && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={cancelManual} />
            <div className="relative z-50 w-full max-w-lg bg-white dark:bg-neutral-900 rounded-lg p-6 shadow-xl">
              <h3 className="text-lg font-semibold">وارد کردن کد به صورت دستی</h3>
              <p className="mt-2 text-sm text-neutral-500">
                اگر قادر به اسکن نیستید، کد (qrRaw) را در کادر زیر وارد کنید.
              </p>

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
                <button
                  onClick={cancelManual}
                  className="px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-700"
                >
                  انصراف
                </button>
                <button onClick={submitManual} className="px-4 py-2 rounded-md bg-brand-plain text-white">
                  ثبت کد
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default QRScannerFAB;
