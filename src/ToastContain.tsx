// src/ToastContain.tsx
import { useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";

export default function ToastContain(): JSX.Element {
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 640);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      <ToastContainer
        position="top-center"
        autoClose={isMobile ? 3000 : 4200}
        hideProgressBar={false}
        newestOnTop
        closeOnClick={true}
        pauseOnHover
        pauseOnFocusLoss={false}
        draggable
        draggablePercent={18}
        closeButton={false}
        limit={6}
        toastClassName="toast-item"
      />

      <style>{`
        /* --------------------------
           Animations
           -------------------------- */
        @keyframes ios-toast-in {
          0%   { transform: translateY(18px) scale(.985); opacity: 0; }
          60%  { transform: translateY(-4px) scale(1.01); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes ios-toast-out {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(10px) scale(.995); opacity: 0; }
        }

        .Toastify__toast-container--top-center {
          position: fixed !important;
          top: 30% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: auto !important;
          height: auto !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          /* container wrapper shouldn't capture pointer events; the inner panel will */
          pointer-events: none;
          z-index: 9999;
        }

        /* --------------------------
           Panel (the frosted floating box that contains toasts)
           -------------------------- */
        .toast-panel {
          /* allows clicks inside the panel */
          pointer-events: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.82);
          border: 1px solid rgba(0,0,0,0.06);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 0 12px 30px rgba(2,6,23,0.12);
          max-width: 92vw;
          width: auto;
          margin: 0;
        }

        /* Dark mode panel */
        .dark .toast-panel {
          background: rgba(15,23,42,0.72);
          border-color: rgba(255,255,255,0.06);
          box-shadow: 0 14px 36px rgba(2,6,23,0.6);
          color: #e6eef8;
        }

        /* --------------------------
           Individual toast - minimal
           -------------------------- */
        .toast-item {
          pointer-events: auto;
          padding: 0;
          margin: 0;
          background: transparent;
          border: none;
          box-shadow: none;
        //   animation: ios-toast-in 360ms cubic-bezier(.22,.9,.35,1);
        }

        /* Exit animation */
        .Toastify__toast--exit.toast-item {
          animation: ios-toast-out 260ms cubic-bezier(.4,0,.2,1) forwards;
        }

        /* Body (text layout inside each toast) */
        .toast-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 10px 12px;
          font-size: 0.9rem;
          line-height: 1.2;
          color: #0f172a;
        }
        .dark .toast-body {
          color: #e6eef8;
        }

        /* spacing for stacked toasts */
        .toast-item + .toast-item {
          margin-top: 8px;
        }

        /* progress bar styling */
        .Toastify__progress-bar {
          background: linear-gradient(90deg, rgba(59,130,246,1), rgba(99,102,241,1));
          height: 4px;
          border-radius: 999px;
        }

        /* Responsive adjustments */
        @media (min-width: 768px) {
          .toast-panel {
            max-width: 420px;
            padding: 10px;
          }
        }
      `}</style>
    </>
  );
}
