import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { StopCircle } from "lucide-react";
import bluetoothService from "../utils/bluetoothService";

interface Props {
  className?: string;
  /**
   * Parent-provided Bluetooth connection flag.
   */
  isConnected?: boolean;
}

const EmergencyStopButton: React.FC<Props> = ({ className = "", isConnected }) => {
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);

  // watch prop to handle smooth entrance animation
  useEffect(() => {
    if (isConnected) {
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [isConnected]);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);

    try {
      // skip sending if disconnected
      if (!isConnected) {
        toast.warn("دستگاه بلوتوث متصل نیست — ابتدا اتصال را برقرار کنید.");
        setBusy(false);
        return;
      }

      // send stop() command
      await bluetoothService.sendString("stop()");
      toast.success("فرمان توقف اضطراری ارسال شد.");
    } catch (err) {
      console.error("EmergencyStopButton send failed:", err);
      toast.error("خطا در ارسال فرمان توقف. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  };

  // hide fully when not connected
  if (!visible) return null;

  return (
    <button
      aria-label="توقف اضطراری"
      title="توقف اضطراری"
      onClick={handleClick}
      disabled={busy}
      className={`${className} inline-flex items-center justify-center select-none shadow-lg focus:outline-none`}
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        color: "white",
        background: busy
          ? "linear-gradient(180deg,#ef9a9a,#c62828)"
          : "linear-gradient(180deg,#ef4444,#b91c1c)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
        opacity: busy ? 0.8 : 1,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
      }}
    >
      <StopCircle className="w-6 h-6" />
    </button>
  );
};

export default EmergencyStopButton;
