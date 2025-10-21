// src/components/EmergencyStopButton.tsx
import React, { useState } from "react";
import { toast } from "react-toastify";
import { StopCircle } from "lucide-react";
import bluetoothService from "../utils/bluetoothService";

interface Props {
  className?: string;
  /**
   * Optional hint from parent whether bluetooth is connected.
   * If omitted the component will fall back to calling bluetoothService.isConnected().
   */
  isConnected?: boolean;
}

const EmergencyStopButton: React.FC<Props> = ({ className = "", isConnected }) => {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);

    try {
      let connected = typeof isConnected === "boolean" ? isConnected : undefined;

      if (connected === undefined && typeof bluetoothService.isConnected === "function") {
        try {
          connected = await bluetoothService.isConnected();
        } catch (err) {
          console.warn("isConnected check failed:", err);
          connected = false;
        }
      }

      if (!connected) {
        toast.warn("دستگاه بلوتوث متصل نیست — ابتدا اتصال را برقرار کنید.");
        setBusy(false);
        return;
      }

      // send the emergency command exactly as required
      await bluetoothService.sendString("stop()");
      toast.success("فرمان توقف اضطراری ارسال شد.");
    } catch (err) {
      console.error("EmergencyStopButton send failed:", err);
      toast.error("خطا در ارسال فرمان توقف. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      aria-label="توقف اضطراری"
      title="توقف اضطراری"
      onClick={handleClick}
      disabled={busy}
      className={`${className} inline-flex items-center justify-center select-none shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none`}
      style={{
        // Match your FAB feel: compact, prominent, rounded, with heavy shadow.
        width: 48,
        height: 48,
        borderRadius: 9999,
        background: busy ? "linear-gradient(180deg,#ef9a9a,#c62828)" : "linear-gradient(180deg,#ef4444,#b91c1c)",
        color: "white",
        boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
        opacity: busy ? 0.8 : 1,
        display: "inline-flex",
      }}
    >
      <StopCircle className="w-6 h-6" />
    </button>
  );
};

export default EmergencyStopButton;
