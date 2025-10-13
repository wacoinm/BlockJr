// src/components/packs/QRScannerFAB.tsx
import React, { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "react-toastify";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { getAllPacks } from "../../utils/manifest";

type Props = {
  onScanned: (s: string) => void;
};

const FRAME_W = 320;
const FRAME_H = 240;
const FPS = 8;

const encodeBase64 = (s: string) => {
  try {
    if (typeof window !== "undefined" && (window as any).btoa) return (window as any).btoa(s);
  } catch {}
  try {
    if (typeof (globalThis as any).Buffer !== "undefined")
      return (globalThis as any).Buffer.from(s, "binary").toString("base64");
  } catch {}
  return "";
};

const QRScannerFAB: React.FC<Props> = ({ onScanned }) => {
  const [scanning, setScanning] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = useRef(`html5qr-container-${Math.random().toString(36).slice(2, 9)}`);
  const mountedRef = useRef(true);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // ignore
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
      // ignore
    }
    return false;
  }

  async function startScanner() {
    if (scanning) return;

    // ensure container exists in DOM (we render it always)
    const containerId = scannerContainerId.current;
    const el = document.getElementById(containerId);
    if (!el) {
      toast.error("Scanner container not found in DOM.");
      return;
    }

    // create Html5Qrcode instance once
    if (!html5QrcodeRef.current) {
      try {
        html5QrcodeRef.current = new Html5Qrcode(containerId, { verbose: false });
      } catch (err) {
        console.error("Failed to create Html5Qrcode instance:", err);
        toast.error("Internal scanner error. Try again.");
        return;
      }
    }
    const html5Qrcode = html5QrcodeRef.current;

    // pick camera (prefer back)
    let cameraId: string | { facingMode: "environment" | "user" } = { facingMode: "environment" };
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        const preferred = devices.find((d) => /back|rear|environment/i.test(d.label || ""));
        cameraId = preferred?.id ?? devices[0].id;
      }
    } catch (e) {
      // ignore, will use facingMode
      console.warn("getCameras failed, will use default facingMode:", e);
    }

    // compute concrete qrbox object (library expects object or number, avoid passing function)
    const boxWidth = Math.floor(Math.min(window.innerWidth * 0.9, FRAME_W));
    // compute a box height maintaining FRAME_H/FRAME_W ratio (so box can be rectangular)
    const boxHeight = Math.floor((FRAME_H / FRAME_W) * boxWidth);

    const config = {
      fps: FPS,
      qrbox: { width: boxWidth, height: boxHeight },
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    };

    const successCallback = (decodedText: string) => {
      if (!mountedRef.current) return;
      const trimmed = String(decodedText ?? "").trim();
      if (!trimmed) return;
      const allowed = isScannedCodeInManifest(trimmed);
      if (!allowed) {
        toast.error("کد QR متعلق به هیچ پَک موجود در مَنیفست نیست.");
        return;
      }
      stopScanner();
      onScanned(trimmed);
    };

    const errorCallback = (_errorMessage: string) => {
      // ignore frame decode failures
    };

    try {
      setScanning(true);
      await html5Qrcode.start(cameraId, config, successCallback, errorCallback);
    } catch (err) {
      console.error("html5-qrcode start failed", err);
      setScanning(false);
      toast.error("دوربین در دسترس نیست یا دسترسی گرفته نشده — لطفاً به صورت دستی وارد کنید.");
      openManualEntry();
    }
  }

  async function stopScanner() {
    if (!html5QrcodeRef.current) {
      setScanning(false);
      return;
    }
    try {
      await html5QrcodeRef.current.stop();
      await html5QrcodeRef.current.clear();
    } catch (e) {
      // ignore
    } finally {
      html5QrcodeRef.current = null;
      setScanning(false);
    }
  }

  async function openManualEntry(prefill?: string) {
    await stopScanner();
    setManualCode(prefill ?? "");
    setShowManual(true);
    setTimeout(() => manualInputRef.current?.focus(), 80);
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
      <button
        aria-label="Scan QR"
        onClick={() => {
          startScanner();
        }}
        className="fixed bottom-6 left-6 md:right-6 md:left-auto z-50 w-16 h-16 rounded-full shadow-2xl bg-gradient-to-br from-pink-500 to-yellow-400 flex items-center justify-center text-white text-xl"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}
      >
        <Camera className="w-6 h-6" />
      </button>

      {/* Scanner overlay wrapper (always in DOM; visible only when scanning) */}
      <div
        id={scannerContainerId.current + "-wrapper"}
        style={{
          position: "fixed",
          inset: 0,
          display: scanning ? "flex" : "none",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 5000,
          background: scanning ? "rgba(0,0,0,0.48)" : "transparent",
        }}
      >
        <div
          id={scannerContainerId.current}
          style={{
            width: Math.min(520, window.innerWidth * 0.94),
            maxWidth: "100%",
            height: Math.max(1, Math.floor((FRAME_H / FRAME_W) * Math.min(520, window.innerWidth * 0.94))),
            overflow: "hidden",
            borderRadius: 12,
            background: "#000",
          }}
        />

        {/* centered frame overlay */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: FRAME_W,
            height: FRAME_H,
            borderRadius: 12,
            pointerEvents: "none",
            boxSizing: "border-box",
            border: "3px solid rgba(255,255,255,0.95)",
            display: scanning ? "flex" : "none",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 14 }}>قاب اسکن</div>
          <div style={{ position: "absolute", inset: 0 }}>
            <div style={{ position: "absolute", left: 6, top: 6, width: 36, height: 36, borderLeft: "4px solid #fff", borderTop: "4px solid #fff", borderRadius: 6 }} />
            <div style={{ position: "absolute", right: 6, top: 6, width: 36, height: 36, borderRight: "4px solid #fff", borderTop: "4px solid #fff", borderRadius: 6 }} />
            <div style={{ position: "absolute", left: 6, bottom: 6, width: 36, height: 36, borderLeft: "4px solid #fff", borderBottom: "4px solid #fff", borderRadius: 6 }} />
            <div style={{ position: "absolute", right: 6, bottom: 6, width: 36, height: 36, borderRight: "4px solid #fff", borderBottom: "4px solid #fff", borderRadius: 6 }} />
          </div>
        </div>

        {/* controls */}
        <div style={{ position: "absolute", bottom: 28, display: scanning ? "flex" : "none", gap: 10 }}>
          <button
            onClick={() => openManualEntry()}
            className="px-4 py-2 rounded-md border border-white/30 text-white/95 bg-white/10"
            style={{ backdropFilter: "blur(4px)" }}
          >
            ورود دستی
          </button>

          <button
            onClick={() => {
              stopScanner();
            }}
            className="px-4 py-2 rounded-md bg-red-500 text-white"
          >
            بستن
          </button>
        </div>
      </div>

      {/* Manual entry modal */}
      {showManual && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={cancelManual} />
          <div className="relative z-70 w-full max-w-lg bg-white dark:bg-neutral-900 rounded-lg p-6 shadow-xl">
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
