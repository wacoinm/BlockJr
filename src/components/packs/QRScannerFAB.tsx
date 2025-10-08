// src/components/packs/QRScannerFAB.tsx
import React, { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "react-toastify";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { getAllPacks } from "../../utils/manifest";

type Props = {
  onScanned: (s: string) => void;
};

const SCAN_TIMEOUT_MS = 12000; // if no barcode in this time, show manual entry

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

const QRScannerFAB: React.FC<Props> = ({ onScanned }) => {
  const [scanning, setScanning] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const scanTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

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

  async function stopScanSafe() {
    try {
      await (BarcodeScanner as any).stopScan?.();
    } catch {}
    try {
      await (BarcodeScanner as any).removeAllListeners?.();
    } catch {}
    setScanning(false);
    clearScanTimer();
  }

  async function openManualEntry(prefill?: string) {
    await stopScanSafe();
    setManualCode(prefill ?? "");
    setShowManual(true);
    setTimeout(() => manualInputRef.current?.focus(), 80);
  }

  /** Validate a camera-scanned code (we expect scanner to usually deliver base64) */
  function isScannedCodeInManifest(scanned: string): boolean {
    if (!scanned) return false;
    const s = scanned.trim();
    try {
      const packs = getAllPacks() || [];
      for (const p of packs) {
        // manifest usually contains both qrRaw and qrBase64
        const raw = (p?.qrRaw ?? "").toString().trim();
        const b64 = (p?.qrBase64 ?? "").toString().trim();
        // Accept if scanned matches stored base64 OR raw OR encoded raw
        if (b64 && s === b64) return true;
        if (raw && s === raw) return true;
        if (raw && encodeBase64(raw) === s) return true;
      }
    } catch (e) {
      console.warn("isScannedCodeInManifest: manifest lookup failed", e);
    }
    return false;
  }

  /** Validate a manual-entered code (user types qrRaw) */
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
      // check plugin support
      let supported = true;
      try {
        const sup = await (BarcodeScanner as any).isSupported?.();
        supported = sup === undefined ? true : (sup?.isSupported ?? !!sup);
      } catch {
        supported = false;
      }

      if (!supported) {
        openManualEntry();
        toast.info("اسکنر در این محیط پشتیبانی نمی‌شود — لطفاً کد را به صورت دستی وارد کنید.");
        return;
      }

      // request permissions
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

      // cleanup previous listeners
      try {
        await (BarcodeScanner as any).removeAllListeners?.();
      } catch {}

      // add listener(s). We'll validate the scanned code against manifest before accepting.
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
              // don't stop scanning; user can try again or choose manual entry
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

      // timeout to open manual entry if nothing scanned in time
      clearScanTimer();
      scanTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        openManualEntry();
        toast.info("کد از طریق اسکن دریافت نشد — می‌توانید آن را به صورت دستی وارد کنید.");
      }, SCAN_TIMEOUT_MS);

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
    // Manual input is expected to be qrRaw (per your instruction)
    const allowed = isManualRawInManifest(val);
    if (!allowed) {
      // Show error and keep modal open so user can correct
      toast.error("کد وارد شده متعلق به هیچ پَک موجود در مَنیفست نیست.");
      return;
    }
    setShowManual(false);
    setManualCode("");
    // per your contract: manual input is raw; to keep behavior consistent with scanning,
    // pass the raw value (the caller/handleScanned should detect/normalize if needed)
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
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => stopScanSafe()} />
          <div className="relative z-50 w-full max-w-md bg-white dark:bg-neutral-900 rounded-lg p-6 shadow-xl text-center">
            <div className="text-lg font-semibold">در حال اسکن...</div>
            <div className="mt-2 text-sm text-neutral-500">دوربین را به کد QR نزدیک کنید</div>

            <div className="mt-4 flex gap-3 justify-center">
              <button
                onClick={() => {
                  openManualEntry();
                }}
                className="px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-700"
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
            <div className="mt-3 text-xs text-neutral-400">اگر اسکن طولانی شد، می‌توانید به صورت دستی کد را وارد کنید.</div>
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
