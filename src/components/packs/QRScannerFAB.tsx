// src/components/packs/QRScannerFAB.tsx
import React from "react";
import { Camera } from "lucide-react";
import { toast } from "react-toastify";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";

type Props = {
  onScanned: (s: string) => void;
};

const QRScannerFAB: React.FC<Props> = ({ onScanned }) => {
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
        toast.error("اسکنر در این محیط پشتیبانی نمی‌شود. برای اسکن از دستگاه native استفاده کنید.");
        return;
      }

      // request permissions
      let granted = false;
      try {
        const perm = await (BarcodeScanner as any).requestPermissions?.();
        if (!perm) granted = false;
        else if (typeof perm === "boolean") granted = perm;
        else {
          granted = perm?.granted === true || perm?.camera === "granted" || perm?.camera === "GRANTED" || perm?.camera === "allowed";
        }
      } catch (e) {
        console.warn("requestPermissions error", e);
        granted = false;
      }

      if (!granted) {
        toast.error("برای اسکن باید اجازهٔ دوربین را بدهید.");
        return;
      }

      // add listener(s)
      const listener = await (BarcodeScanner as any).addListener?.("barcodesScanned", (ev: any) => {
        const arr = ev?.barcodes ?? (ev?.barcode ? [ev.barcode] : []);
        if (Array.isArray(arr) && arr.length > 0) {
          const first = arr[0];
          const text = first?.rawValue ?? first?.displayValue ?? first?.value ?? first?.text ?? null;
          if (text) {
            try {
              (BarcodeScanner as any).stopScan?.();
            } catch {}
            try {
              (BarcodeScanner as any).removeAllListeners?.();
            } catch {}
            onScanned(String(text));
          }
        }
      });

      // fallback older event name
      const listener2 = await (BarcodeScanner as any).addListener?.("barcodeScanned", (ev: any) => {
        const text = ev?.barcode ?? ev?.text ?? ev?.displayValue ?? ev?.rawValue ?? null;
        if (text) {
          try {
            (BarcodeScanner as any).stopScan?.();
          } catch {}
          try {
            (BarcodeScanner as any).removeAllListeners?.();
          } catch {}
          onScanned(String(text));
        }
      });

      // start scanning
      await (BarcodeScanner as any).startScan?.();
    } catch (err) {
      console.error("startScan error", err);
      toast.error("خطا در باز کردن اسکنر. لطفاً در دستگاه native تست کنید.");
    }
  }

  return (
    <button
      aria-label="Scan QR"
      onClick={startScan}
      className="fixed bottom-6 left-6 md:right-6 md:left-auto z-50 w-16 h-16 rounded-full shadow-2xl bg-gradient-to-br from-pink-500 to-yellow-400 flex items-center justify-center text-white text-xl"
      style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}
    >
      <Camera className="w-6 h-6" />
    </button>
  );
};

export default QRScannerFAB;
