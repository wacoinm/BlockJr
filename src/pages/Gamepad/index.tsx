// src/pages/Gamepad/index.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import bluetoothService from "../../utils/bluetoothService";
import { toast } from "react-toastify";
import {
  Lightbulb,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Rabbit,
  Turtle,
} from "lucide-react";
import stickShape from "/shapeStick.svg";

/**
 * Speed Control Component with animation
 */
function SpeedControl({
  isFast,
  onChange,
}: {
  isFast: boolean;
  onChange: (fast: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-full p-2 shadow-md transition-all duration-300">
      <div
        className="relative w-16 h-8 rounded-full bg-slate-100 dark:bg-slate-700 cursor-pointer"
        onClick={() => onChange(!isFast)}
      >
        <div
          className={`absolute inset-y-1 w-7 bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500 ease-in-out ${
            isFast ? "right-1" : "left-1"
          }`}
        />
        <div
          className={`absolute inset-0 flex items-center justify-between px-1.5 transition-opacity duration-300`}
        >
          <Turtle
            size={16}
            className={`text-slate-600 dark:text-slate-300 transition-opacity duration-300 ${
              isFast ? "opacity-40" : "opacity-100"
            }`}
          />
          <Rabbit
            size={16}
            className={`text-slate-600 dark:text-slate-300 transition-opacity duration-300 ${
              isFast ? "opacity-100" : "opacity-40"
            }`}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- Constants & Commands ---------- */
const RATE_MS = 0; // throttle gating for consecutive sends (still respected)

const Commands = {
  UP: "up",
  DOWN: "down",
  DELAY: "delay",
  GREEN_FLAG: "green-flag",
  FORWARD: "forward",
  BACKWARD: "backward",
  CLOCKWISE: "turnright",
  COUNTERCLOCKWISE: "turnleft",
  LAMP_ON: "lampon",
  LAMP_OFF: "lampoff",
  SPEED_LOW: "speed-low",
  SPEED_HIGH: "speed-high",
} as const;

/* ---------- helpers ---------- */
function clamp01(v: number) {
  if (isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
function speedFromDistance(distance: number) {
  return Math.round(clamp01(distance) * 100);
}

/**
 * Remap joystick coords for +90deg visual rotation
 * Given the rotated (visual) event, produce logical coordinates.
 */
function remapForRotation(evt: any) {
  if (!evt) return evt;
  const { x, y, distance, direction, ...rest } = evt;
  if (typeof x !== "number" || typeof y !== "number") {
    return { x, y, distance, direction, ...rest };
  }
  // For +90deg rotation visual->logical:
  // logical_x = -visual_y
  // logical_y = visual_x
  const logicalX = -y;
  const logicalY = x;
  return { ...rest, x: logicalX, y: logicalY, distance, direction };
}

/* ----------------- VISUAL WRAPPER (KEEP STYLES UNCHANGED) ----------------- */
function JoystickVisual({
  children,
  size = 180,
  active = false,
}: {
  children: React.ReactNode;
  size?: number;
  active?: boolean;
  rotate?: boolean;
}) {
  const s = Math.max(80, Math.min(320, size));

  return (
    <div
      style={{ width: s, height: s }}
      className="joy-wrap"
      aria-hidden={false}
    >
      <style>{`
        .joy-wrap { position: relative; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; padding: 8px; user-select: none; -webkit-tap-highlight-color: transparent; transition: filter 220ms ease, box-shadow 220ms ease; }
        .joy-decor, .joy-base, .joy-radials, .joy-center, .joy-shaft, .joy-glow, .dir-badge { pointer-events: none; }

        /* LIGHT THEME — more gray for better contrast */
        .joy-decor {
          position: absolute;
          inset: 0;
          border-radius: 14px;
          z-index: 0;
          background: linear-gradient(180deg, rgba(215,219,225,0.96), rgba(195,200,210,0.95));
          box-shadow: 0 8px 20px rgba(12,24,40,0.06), inset 0 2px 6px rgba(255,255,255,0.5);
        }

        /* DARK THEME — softened so details stay visible */
        .dark .joy-decor {
          background: linear-gradient(180deg, rgba(26,30,38,0.85), rgba(34,40,48,0.88));
          box-shadow: 0 10px 24px rgba(0,0,0,0.55), inset 0 2px 6px rgba(255,255,255,0.03);
        }

        /* BASE DISC */
        .joy-base {
          position: absolute;
          inset: 10%;
          border-radius: 999px;
          z-index: 1;
          background: radial-gradient(circle at center, rgba(210,214,222,0.95), rgba(180,186,196,0.92));
          box-shadow: inset 0 6px 18px rgba(0,0,0,0.06);
          overflow: hidden;
          border: 1px solid rgba(20,30,50,0.08);
        }

        .joy-base::before {
          content: "";
          position: absolute;
          inset: 6%;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(20,30,40,0.03) 0.5px, transparent 0.5px),
                      repeating-radial-gradient(circle at center, rgba(20,30,40,0.03) 0 6px, transparent 6px 12px);
          opacity: 0.4;
          mix-blend-mode: multiply;
        }

        .dark .joy-base {
          background: radial-gradient(circle at center, rgba(50,58,70,0.86), rgba(30,36,44,0.84));
          box-shadow: inset 0 6px 18px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.04);
        }

        .dark .joy-base::before {
          background: radial-gradient(circle, rgba(255,255,255,0.02) 0.5px, transparent 0.5px),
                      repeating-radial-gradient(circle at center, rgba(255,255,255,0.02) 0 6px, transparent 6px 12px);
          opacity: 0.2;
          mix-blend-mode: overlay;
        }

        .joy-radials { position: absolute; inset: 8%; border-radius: 999px; z-index: 2; }
        .joy-radials::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: conic-gradient(from 0deg, rgba(20,30,40,0.04) 0.5deg, transparent 1deg);
          opacity: 0.25;
          transform: rotate(8deg);
        }

        .dark .joy-radials::before {
          background: conic-gradient(from 0deg, rgba(255,255,255,0.04) 0.5deg, transparent 1deg);
          opacity: 0.08;
        }

        .joy-center {
          position: absolute;
          width: 52%;
          height: 52%;
          border-radius: 999px;
          z-index: 3;
          display:flex;
          align-items:center;
          justify-content:center;
          background: linear-gradient(180deg, rgba(250,252,255,0.96), rgba(226,230,238,0.95));
          box-shadow: inset 0 6px 14px rgba(0,0,0,0.08);
        }

        .dark .joy-center {
          background: linear-gradient(180deg, rgba(74,82,94,0.92), rgba(40,46,56,0.9));
          box-shadow: inset 0 6px 14px rgba(0,0,0,0.55);
        }

        .joy-shaft {
          position: absolute;
          width: 8px;
          height: 50%;
          background: linear-gradient(180deg, #c5ccd8, #8e9bb0);
          border-radius: 6px;
          z-index: 4;
          bottom: 50%;
          transform-origin: 50% 100%;
          box-shadow: 0 8px 18px rgba(8,12,20,0.08);
          transition: transform 120ms linear;
        }

        .dark .joy-shaft {
          background: linear-gradient(180deg, rgba(160,176,190,0.18), rgba(110,124,140,0.18));
          box-shadow: 0 8px 18px rgba(0,0,0,0.6);
        }

        .joy-glow { position: absolute; inset: 6%; border-radius: 999px; z-index: 2; box-shadow: 0 22px 56px rgba(43,108,255,0.1); opacity: 0; transition: opacity 160ms ease; }
        .joy-glow.on { opacity: 1; }
        .dark .joy-glow { box-shadow: 0 30px 80px rgba(60,140,255,0.18), 0 10px 24px rgba(20,30,70,0.15); }

        .dir-badge {
          position: absolute;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display:flex;
          align-items:center;
          justify-content:center;
          background: rgba(255,255,255,0.88);
          box-shadow: 0 6px 14px rgba(6,12,24,0.08);
          z-index: 8;
          color: #123248;
          border: 1px solid rgba(18,50,72,0.06);
        }

        .dark .dir-badge {
          background: rgba(36,42,52,0.86);
          color: #dbeafe;
          border: 1px solid rgba(255,255,255,0.04);
          box-shadow: 0 6px 14px rgba(0,0,0,0.45);
        }

        .dir-up { top: 6%; left: 50%; transform: translate(-50%, 0); }
        .dir-down { bottom: 6%; left: 50%; transform: translate(-50%, 0); }
        .dir-left { left: 6%; top: 50%; transform: translate(0, -50%); }
        .dir-right { right: 6%; top: 50%; transform: translate(0, -50%); }

        .joy-holder { position: absolute; width: 58%; height: 58%; z-index: 9999; display:flex; align-items:center; justify-content:center; touch-action: none; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(90deg); pointer-events: auto; }
        .joy-holder > * { width: 100% !important; height: 100% !important; display: block; touch-action: none; pointer-events: auto; background: rgba(0,0,0,0.001); }

        @media (max-width: 420px) { .joy-shaft { width:6px; } .dir-badge { width:24px; height:24px; font-size:12px; } }
      `}</style>

      <div className="joy-decor" />
      <div className="joy-base" />
      <div className={`joy-glow ${active ? "on" : ""}`} />
      <div className="joy-radials" />
      <div className="joy-center" />
      <div className="joy-shaft" />

      <div className="dir-badge dir-up" aria-hidden>
        <ArrowUp size={14} />
      </div>
      <div className="dir-badge dir-down" aria-hidden>
        <ArrowDown size={14} />
      </div>
      <div className="dir-badge dir-left" aria-hidden>
        <ArrowLeft size={14} />
      </div>
      <div className="dir-badge dir-right" aria-hidden>
        <ArrowRight size={14} />
      </div>

      <div className="joy-holder">{children}</div>
    </div>
  );
}

/* ----------------- Custom Joystick (pointer-based) ----------------- */

type JoystickEvent = {
  x: number; // -1..1 (right positive)
  y: number; // -1..1 (down positive)
  distance: number; // 0..1
  angle: number; // degrees (-180..180)
  pointerType?: string;
};

function useThrottle(ms: number) {
  const lastRef = useRef<number>(0);
  return function allowed(): boolean {
    const now = Date.now();
    if (now - lastRef.current >= ms) {
      lastRef.current = now;
      return true;
    }
    return false;
  };
}
function CustomJoystick({
  size = 250,
  stickSizePercentage = 0.35,
  throttle = 30,
  axis = "both", // "both" | "x" | "y"
  move,
  start,
  stop,
  stickImage,
  safeZonePercentage = 0.3, // NEW: 0..1 fraction of usable radius
}: {
  size?: number;
  stickSizePercentage?: number;
  minDistance?: number;
  throttle?: number;
  axis?: "both" | "x" | "y";
  move?: (evt: JoystickEvent) => void;
  start?: (evt?: JoystickEvent) => void;
  stop?: () => void;
  stickImage?: string;
  safeZonePercentage?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const stickRef = useRef<HTMLDivElement | null>(null);
  const allowed = useThrottle(throttle);

  // track whether pointer is currently considered "inside" the safe zone
  const inSafeZoneRef = useRef(true);

  // small helper: clamp 0..1
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  // Helper to emit event
  const emit = useCallback(
    (clientX: number, clientY: number, pointerType?: string) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = Math.min(rect.width, rect.height) / 2;

      // raw delta from center (screen coords: +y is down)
      let dx = clientX - cx;
      let dy = clientY - cy;

      // visual stick radius (px)
      const stickRadiusPx = radius * stickSizePercentage;
      // maximum movement for the stick center so it doesn't go outside the base
      const maxPx = Math.max(1, radius - stickRadiusPx) + 20;

      // clamp the visual displacement to the circle of radius maxPx
      const distPx = Math.hypot(dx, dy);
      let clampedDx = dx;
      let clampedDy = dy;
      if (distPx > maxPx && distPx > 0) {
        const scale = maxPx / distPx;
        clampedDx = dx * scale;
        clampedDy = dy * scale;
      }

      // axis locks must affect both visual and logical values
      if (axis === "x") {
        clampedDy = 0;
        dy = 0;
      } else if (axis === "y") {
        clampedDx = 0;
        dx = 0;
      }

      // normalized distance 0..1 (based on maxPx)
      const distanceNorm = clamp01(Math.hypot(clampedDx, clampedDy) / maxPx);

      // Logical normalized coordinates in range -1..1
      // IMPORTANT: invert Y so that "up" (screen negative dy) becomes positive logical Y.
      const nx = clamp01(Math.abs(clampedDx / maxPx)) * (clampedDx < 0 ? -1 : 1);
      const ny = clamp01(Math.abs(-clampedDy / maxPx)) * (clampedDy < 0 ? 1 : -1);

      // angle: compute with inverted Y so 0° = right, 90° = up
      const angleRad = Math.atan2(-clampedDy, clampedDx);
      let angleDeg = (angleRad * 180) / Math.PI;
      if (angleDeg < 0) angleDeg += 360;

      // SAFE ZONE logic:
      const safePerc = clamp01(safeZonePercentage); // ensure 0..1
      const currentlyInsideSafe = distanceNorm <= safePerc;

      // transition: inside -> outside  => should start sending (call start then move)
      if (inSafeZoneRef.current && !currentlyInsideSafe) {
        inSafeZoneRef.current = false;
        // create event object for start
        const startEv: JoystickEvent = {
          x: nx,
          y: ny,
          distance: distanceNorm,
          angle: angleDeg,
          pointerType,
        };
        if (start) start(startEv);
        // fall through to move below (subject to throttle)
      }

      // transition: outside -> inside => should stop sending (call stop) and do not call move
      if (!inSafeZoneRef.current && currentlyInsideSafe) {
        inSafeZoneRef.current = true;
        if (stickRef.current) {
          // optionally snap visual stick to center when entering safe zone
          stickRef.current.style.transition = "transform 120ms ease";
          stickRef.current.style.transform = `translate(0px, 0px)`;
        }
        if (stop) stop();
        return; // don't call move while inside safe zone
      }

      // move visual stick (use clamped values) — only for visual, even if inside safe zone we may keep center
      if (stickRef.current) {
        stickRef.current.style.transform = `translate(${clampedDx}px, ${clampedDy}px)`;
      }

      // if currently inside safe zone, don't emit move
      if (currentlyInsideSafe) {
        return;
      }

      // At this point: outside safe zone and we may send move (throttled)
      const ev: JoystickEvent = {
        x: nx,
        y: ny,
        distance: distanceNorm,
        angle: angleDeg,
        pointerType,
      };
      if (move && allowed()) move(ev);
    },
    [axis, move, stickSizePercentage, safeZonePercentage, start, stop, throttle]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onPointerDown(e: PointerEvent) {
      if (pointerIdRef.current != null) return;
      pointerIdRef.current = e.pointerId;
      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch {}
      activeRef.current = true;
      if (stickRef.current) {
        stickRef.current.style.transition = "transform 0s";
        stickRef.current.style.willChange = "transform";
      }
      // Reset safe-zone state: treat initial pointer as "inside" until checked by emit
      inSafeZoneRef.current = true;
      // Let emit decide whether to call start/stop/move according to safe zone
      emit(e.clientX, e.clientY, e.pointerType);
      // don't call start() here unconditionally — emit handles transitions
    }

    function onPointerMove(e: PointerEvent) {
      if (!activeRef.current) return;
      if (pointerIdRef.current !== e.pointerId) return;
      emit(e.clientX, e.clientY, e.pointerType);
    }

    function onPointerUp(e: PointerEvent) {
      if (pointerIdRef.current !== e.pointerId) return;
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch { /* empty */ }
      pointerIdRef.current = null;
      activeRef.current = false;
      inSafeZoneRef.current = true; // reset safe zone on release
      if (stickRef.current) {
        stickRef.current.style.transition = "transform 120ms ease";
        stickRef.current.style.transform = `translate(0px, 0px)`;
      }
      // call stop regardless (user expectation on release)
      if (stop) stop();
    }

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [emit, start, stop]);

  const stickSize = Math.round(size * stickSizePercentage);

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        position: "relative",
        touchAction: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden={false}
    >
      <div
        ref={stickRef}
        style={{
          position: "absolute",
          width: stickSize,
          height: stickSize,
          borderRadius: "999px",
          transform: "translate(0px, 0px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 10000,
        }}
      >
        {stickImage ? (
          <img
            src={stickImage}
            alt="stick"
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.95)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ----------------- Page component ----------------- */

export default function GamepadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lightOn, setLightOn] = useState(false);
  const [isFastMode, setIsFastMode] = useState(false);

  const lastSentMapRef = useRef<Record<string, number>>({});

  // track pending ACK per key
  const pendingAckRef = useRef<Record<string, boolean>>({});
  const pendingAckTimeoutRef = useRef<Record<string, number | null>>({});

  // holdCommand per controller: stores last-sent command signature while stick held
  // when null => nothing currently held
  const holdCommandRef = useRef<Record<string, string | null>>({});

  useEffect(() => {
    document.title = id ? `Gamepad — ${id}` : "Gamepad";
  }, [id]);

  const buildCommand = useCallback((commands: string[]) => {
    // Convert time to seconds and format commands
    if (commands.length === 0) return "";
    if (commands[0] === "stop") return "stop";
    else if (commands[0] === Commands.LAMP_ON) return "lampon()";
    else if (commands[0] === Commands.LAMP_OFF) return "lampoff()";
    else if (commands[0] === Commands.SPEED_HIGH) return "speed(100)";
    else if (commands[0] === Commands.SPEED_LOW) return "speed(50)";

    const formattedCmds = commands.map((cmd) => {
      return cmd;
    });
    return formattedCmds.join("_");
  }, []);

  // sendCmd optionally waits for ACK by setting pendingAck[key] true
  const sendCmd = useCallback(
    async (
      commands: string[],
      key: string = "global",
      { waitForAck = true } = {}
    ) => {
      const now = Date.now();
      const last = lastSentMapRef.current[key] ?? 0;
      if (now - last < RATE_MS) {
        // throttle gating: avoid sending too often
        return;
      }
      lastSentMapRef.current[key] = now;

      try {
        const formattedCmd = buildCommand(commands);
        console.log(formattedCmd);
        if (!formattedCmd) return;

        const connected = await bluetoothService.isConnected();
        if (!connected) {
          toast.warn("بلوتوث متصل نیست — ابتدا دستگاه را متصل کنید.");
          return;
        }
        // write to device
        await bluetoothService.sendString(formattedCmd);

        if (waitForAck) {
          pendingAckRef.current[key] = true;
          // clear previous timeout if any
          const prev = pendingAckTimeoutRef.current[key];
          if (prev) {
            window.clearTimeout(prev);
            pendingAckTimeoutRef.current[key] = null;
          }
          // safety fallback: if no OK received in 2000 ms, clear pending ack to avoid permanent lock
          const tid = window.setTimeout(() => {
            pendingAckRef.current[key] = false;
            pendingAckTimeoutRef.current[key] = null;
            console.warn(`[Gamepad] pending ACK timeout for key=${key}`);
          }, 2000);
          pendingAckTimeoutRef.current[key] = tid;
        }
      } catch (e) {
        console.error("Failed to send cmd", e);
        toast.error("خطا در ارسال فرمان بلوتوث.");
        // clear pending ack if send failed
        pendingAckRef.current[key] = false;
        const prev = pendingAckTimeoutRef.current[key];
        if (prev) {
          window.clearTimeout(prev);
          pendingAckTimeoutRef.current[key] = null;
        }
      }
    },
    [buildCommand]
  );

  // Send speed command when speed mode changes
  useEffect(() => {
    sendCmd([isFastMode ? Commands.SPEED_HIGH : Commands.SPEED_LOW], "speed", {
      waitForAck: true,
    });
  }, [isFastMode, sendCmd]);

  /* ---------- Data listener for ACK ("OK") ---------- */
  useEffect(() => {
    let unsub: (() => void) | null = null;

    bluetoothService
      .onOK(() => {
        Object.keys(pendingAckRef.current).forEach((key) => {
          pendingAckRef.current[key] = false;
          const timeout = pendingAckTimeoutRef.current[key];
          if (timeout) {
            clearTimeout(timeout);
            pendingAckTimeoutRef.current[key] = null;
          }
        });
      })
      .then((u) => (unsub = u));

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  /* ---------- Commands derivation from joystick events ---------- */
  const commandsFromEvent = useCallback(
    (controllerKey: string, evt: unknown): string[] => {
      if (!evt) return [];
      const e = remapForRotation(evt);
      const { x, y, distance } = e;

      // centered -> signal stop
      if (Math.abs(x ?? 0) < 0.05 && Math.abs(y ?? 0) < 0.05) {
        return ["stop"];
      }

      switch (controllerKey) {
        case "car": {
          const cmds: string[] = [];

          // ensure numbers
          if (typeof x !== "number" || typeof y !== "number") return [];

          // small deadzone: treat near-center as stop
          if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05) {
            return ["stop"];
          }

          // Decide major axis by magnitude: vertical wins -> forward/backward, horizontal wins -> turn
          if (Math.abs(y) >= Math.abs(x)) {
            // Vertical: y < 0 => forward, y > 0 => backward (matches your other handlers)
            if (y < 0) cmds.push(Commands.FORWARD);
            else cmds.push(Commands.BACKWARD);
          } else {
            // Horizontal: x > 0 => left (counterclockwise), x < 0 => right (clockwise)
            if (x > 0) cmds.push(Commands.COUNTERCLOCKWISE);
            else cmds.push(Commands.CLOCKWISE);
          }
          return cmds;
        }
        case "tele": {
          const cmds: string[] = [];
          if (Math.abs(y) > 0.05)
            cmds.push(y < 0 ? Commands.FORWARD : Commands.BACKWARD);
          if (Math.abs(x) > 0.05)
            cmds.push(x < 0 ? Commands.COUNTERCLOCKWISE : Commands.CLOCKWISE);
          return cmds;
        }
        case "crane-move": {
          const cmds: string[] = [];
          if (x == null || y == null) return [];
          if (Math.abs(x) > Math.abs(y)) {
            if (x > 0) cmds.push(Commands.CLOCKWISE);
            else if (x < 0) cmds.push(Commands.COUNTERCLOCKWISE);
          } else {
            if (y < 0) cmds.push(Commands.FORWARD);
            else if (y > 0) cmds.push(Commands.BACKWARD);
          }
          return cmds;
        }
        case "crane-elevator": {
          const cmds: string[] = [];
          if (y == null) return [];
          if (Math.abs(y) < 0.05) return ["stop"];
          if (y < 0) cmds.push(Commands.UP);
          else cmds.push(Commands.DOWN);
          return cmds;
        }
        case "fallback": {
          const cmds: string[] = [];
          if (Math.abs(x ?? 0) < 0.05 && Math.abs(y ?? 0) < 0.05)
            return ["stop"];
          if (Math.abs(y) > Math.abs(x)) {
            if (y < 0)
              cmds.push(`forward(${speedFromDistance(distance ?? 0)})`);
            else cmds.push(`backward(${speedFromDistance(distance ?? 0)})`);
          } else {
            if (x > 0)
              cmds.push(`turnright(${speedFromDistance(distance ?? 0)})`);
            else cmds.push(`turnleft(${speedFromDistance(distance ?? 0)})`);
          }
          return cmds;
        }
        default:
          return [];
      }
    },
    []
  );

  /* ---------- Hold-based send logic (single-send while finger held) ---------- */

  // Helper: attempt to send a set of commands for a controller, but only if they differ
  // from the currently held command. If commands == ['stop'] treat it as release (send stop and clear).
  const trySendHoldCommand = useCallback(
    async (controllerKey: string, cmds: string[]) => {
      if (!cmds || cmds.length === 0) return;

      // If explicit 'stop' -> send stop immediately and clear hold
      if (cmds.length === 1 && cmds[0] === "stop") {
        // send stop immediately without waiting for ACK (stop should be quick)
        await sendCmd(["stop"], controllerKey, { waitForAck: false });
        holdCommandRef.current[controllerKey] = null;
        return;
      }

      // create a signature for comparison (join by '|')
      const signature = cmds.join("_");

      // If same as currently held command, do nothing
      if (holdCommandRef.current[controllerKey] === signature) {
        return;
      }

      // If currently waiting for ACK for this key, skip sending new command until ack clears
      if (pendingAckRef.current[controllerKey]) {
        return;
      }

      if (holdCommandRef.current[controllerKey]){
        await sendCmd(["stop"], `${controllerKey}-stop`, { waitForAck: false });
      }

      // send new command (we will wait for ACK)
      await sendCmd(cmds, controllerKey, { waitForAck: true });

      // record held command signature
      holdCommandRef.current[controllerKey] = signature;

    },
    [sendCmd]
  );

  // Helper to send stop on release
  const handleRelease = useCallback(
    async (controllerKey: string) => {
      // send stop; don't wait for ack (immediate)
      await sendCmd(["stop"], controllerKey, { waitForAck: false });
      // clear any pending ack / timeouts for this controller to avoid stale state
      pendingAckRef.current[controllerKey] = false;
      const prev = pendingAckTimeoutRef.current[controllerKey];
      if (prev) {
        window.clearTimeout(prev);
        pendingAckTimeoutRef.current[controllerKey] = null;
      }
      holdCommandRef.current[controllerKey] = null;
    },
    [sendCmd]
  );

  /* ---------- JOYSTICK HANDLERS: compute commands and call trySendHoldCommand / handleRelease ---------- */

  const onCarMove = useCallback(
    (evt: any) => {
      if (!evt) return;
      const cmds = commandsFromEvent("car", evt);
      trySendHoldCommand("car", cmds);
    },
    [commandsFromEvent, trySendHoldCommand]
  );

  const onCarStop = useCallback(() => {
    handleRelease("car");
  }, [handleRelease]);

  const onTeleMove = useCallback(
    (evt: any) => {
      if (!evt) return;
      const cmds = commandsFromEvent("tele", evt);
      trySendHoldCommand("tele", cmds);
    },
    [commandsFromEvent, trySendHoldCommand]
  );

  const onTeleStop = useCallback(() => {
    handleRelease("tele");
  }, [handleRelease]);

  interface IJoystickUpdateEvent {
    x: number | null;
    y: number | null;
    distance: number | null;
    angle?: number | null;
  }

  const onCraneMoveLeft = useCallback(
    (evt: IJoystickUpdateEvent) => {
      if (!evt) return;
      const cmds = commandsFromEvent("crane-move", evt);
      trySendHoldCommand("crane-move", cmds);
    },
    [commandsFromEvent, trySendHoldCommand]
  );

  const onCraneMoveLeftStop = useCallback(() => {
    handleRelease("crane-move");
  }, [handleRelease]);

  const onCraneMoveRight = useCallback(
    (evt: IJoystickUpdateEvent) => {
      if (!evt) return;
      const cmds = commandsFromEvent("crane-elevator", evt);
      trySendHoldCommand("crane-elevator", cmds);
    },
    [commandsFromEvent, trySendHoldCommand]
  );

  const onCraneMoveRightStop = useCallback(() => {
    handleRelease("crane-elevator");
  }, [handleRelease]);

  /* ---------- Cleanup on unmount ---------- */
  useEffect(() => {
    return () => {
      // send stop to all controllers on unmount (do not wait for ack)
      ["car", "tele", "crane-move", "crane-elevator", "fallback"].forEach(
        (controller) => {
          sendCmd(["stop"], controller, { waitForAck: false });
          // clear timeouts
          const prev = pendingAckTimeoutRef.current[controller];
          if (prev) {
            window.clearTimeout(prev);
            pendingAckTimeoutRef.current[controller] = null;
          }
        }
      );
    };
  }, [sendCmd]);

  /* ---------- UI helpers ---------- */
  const toggleLight = useCallback(() => {
    const next = !lightOn;
    setLightOn(next);
    const cmd = next ? Commands.LAMP_ON : Commands.LAMP_OFF;
    sendCmd([cmd], "light", { waitForAck: true });
  }, [lightOn, sendCmd]);

  useEffect(() => {
    // reset holdCommandRef keys if none exist initially
    [
      "car",
      "tele",
      "crane-move",
      "crane-elevator",
      "fallback",
      "speed",
      "light",
    ].forEach((k) => {
      if (!(k in holdCommandRef.current)) holdCommandRef.current[k] = null;
    });
  }, []);

  const projectId = id ?? "";
  const isMobile =
    typeof window !== "undefined" ? window.innerWidth <= 420 : true;
  const joystickSize = isMobile ? 200 : 220;

  const nearTransparentBase = "rgba(0,0,0,0.01)";
  const nearTransparentStick = "rgba(255,255,255,0.92)";

  /* ---------- RENDER ---------- */
  return (
    <div className="min-h-screen min-w-screen w-screen h-screen p-4 flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-black transition-colors duration-500 overflow-hidden">
      {/* Fixed top-left controls: Back, Light, Speed */}
      <div className="fixed left-11 bottom-2 z-50 flex items-center flex-col gap-3 " style={{transform: "rotate(-90deg)"}}>
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-2 rounded-md bg-neutral-100 dark:bg-neutral-800 shadow"
          title="بازگشت"
        >
          بازگشت
        </button>

        <button
          onClick={toggleLight}
          aria-pressed={lightOn}
          className={`p-2 rounded-full transition-transform duration-300 shadow ${
            lightOn ? "scale-105" : ""
          } bg-white dark:bg-slate-800`}
          title={lightOn ? "خاموش کردن چراغ" : "روشن کردن چراغ"}
        >
          <Lightbulb
            className={`w-5 h-5 ${lightOn ? "text-yellow-400" : "text-neutral-400"}`}
          />
        </button>

        <div className="mt-0">
          <SpeedControl isFast={isFastMode} onChange={setIsFastMode} />
        </div>
      </div>

      {/* Centered content */}
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ touchAction: "none" }}
      >
        <div
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center center",
            width: "100vh",
            height: "100vw",
            maxWidth: "100%",
            maxHeight: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
          }}
        >
          <div className="max-w-lg mx-auto">
            {/* Small header left empty (controls are fixed) */}
            <header className="flex items-center justify-between mb-4 flex-row-reverse pointer-events-none">
              <div />
              <div />
              <div />
            </header>

            <div className="flex flex-col gap-6 mt-[6vw] items-center">
              {projectId === "ماشین" && (
                <>
                  <div className="text-sm text-center text-neutral-600 dark:text-neutral-300">
                    جوی‌استیک: حرکت بالا / پایین
                  </div>
                  <div className="w-full flex justify-center my-8">
                    <JoystickVisual size={joystickSize} active={false}>
                      <CustomJoystick
                        size={joystickSize + 1}
                        stickSizePercentage={0.575}
                        minDistance={0}
                        throttle={30}
                        axis="both" /* keep unrestricted (original used Circle) */
                        move={(e) => {
                          // remap for rotation happens later in commandsFromEvent
                          onCarMove({
                            x: e.x,
                            y: e.y,
                            distance: e.distance,
                            angle: e.angle,
                          });
                        }}
                        stop={() => {
                          onCarStop();
                        }}
                        start={() => {}}
                        stickImage={stickShape}
                      />
                    </JoystickVisual>
                  </div>
                </>
              )}

              {projectId === "جرثقیل" && (
                <>
                  <div className="w-full flex flex-row gap-3 items-start justify-between">
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <div className="text-sm my-8 text-center text-neutral-600 text-nowrap dark:text-neutral-300">
                        حرکت: جلو/عقب/چپ/راست
                      </div>
                      <JoystickVisual size={joystickSize} active={false}>
                        <CustomJoystick
                          size={joystickSize}
                          stickSizePercentage={0.65}
                          minDistance={0}
                          throttle={25}
                          axis="both" /* original used Circle */
                          move={(e) =>
                            onCraneMoveLeft({
                              x: e.x,
                              y: e.y,
                              distance: e.distance,
                              angle: e.angle,
                            })
                          }
                          stop={onCraneMoveLeftStop}
                          start={() => {}}
                          stickImage={stickShape}
                        />
                      </JoystickVisual>
                    </div>

                    <div className="flex-1 flex flex-col items-center gap-2">
                      <div className="text-sm my-8 text-center text-neutral-600 text-nowrap dark:text-neutral-300">
                        بالا/پایین (محدود روی Y)
                      </div>
                      <JoystickVisual size={joystickSize} active={false}>
                        <CustomJoystick
                          size={joystickSize}
                          stickSizePercentage={0.65}
                          minDistance={0}
                          throttle={25}
                          axis="x" /* original had AxisX — keep that restriction */
                          move={(e) =>
                            onCraneMoveRight({
                              x: e.x,
                              y: e.y,
                              distance: e.distance,
                              angle: e.angle,
                            })
                          }
                          stop={onCraneMoveRightStop}
                          start={() => {}}
                          stickImage={stickShape}
                        />
                      </JoystickVisual>
                    </div>
                  </div>
                </>
              )}

              {projectId === "منجنیق" && (
                <>
                  <div className="text-sm text-center text-neutral-600 text-nowrap dark:text-neutral-300">
                    جوی‌استیک: فقط محور X (چپ/راست)
                  </div>
                  <div className="w-full flex justify-center my-8">
                    <JoystickVisual size={joystickSize} active={false}>
                      <CustomJoystick
                        size={joystickSize}
                        stickSizePercentage={0.75}
                        minDistance={0}
                        throttle={30}
                        axis="x" /* original used AxisX */
                        move={(e) =>
                          onTeleMove({
                            x: e.x,
                            y: e.y,
                            distance: e.distance,
                            angle: e.angle,
                          })
                        }
                        stop={onTeleStop}
                        start={() => {}}
                        stickImage={stickShape}
                      />
                    </JoystickVisual>
                  </div>
                </>
              )}

              {projectId !== "ماشین" &&
                projectId !== "جرثقیل" &&
                projectId !== "منجنیق" && (
                  <>
                    <div className="text-sm text-center text-neutral-600 text-nowrap dark:text-neutral-300">
                      پروژه‌ی مشخص‌شده پشتیبانی نمی‌شود. یک جوی‌استیک عمومی
                      نمایش داده شده است.
                    </div>
                    <JoystickVisual size={joystickSize} active={false}>
                      <CustomJoystick
                        size={joystickSize}
                        stickSizePercentage={0.75}
                        minDistance={0}
                        throttle={60}
                        axis="both"
                        move={(e) => {
                          if (!e) return;
                          const ev = remapForRotation({
                            x: e.x,
                            y: e.y,
                            distance: e.distance,
                            angle: e.angle,
                          });
                          const { x, y, distance } = ev;

                          if (Math.abs(y) < 0.05 && Math.abs(x) < 0.05) {
                            // centered -> stop and clear hold
                            sendCmd(["stop"], "fallback", {
                              waitForAck: false,
                            });
                            holdCommandRef.current["fallback"] = null;
                            return;
                          }

                          const commands: string[] = [];

                          if (Math.abs(y) > Math.abs(x)) {
                            if (y < 0) {
                              commands.push(
                                `forward(${speedFromDistance(distance ?? 0)})`
                              );
                            } else {
                              commands.push(
                                `backward(${speedFromDistance(distance ?? 0)})`
                              );
                            }
                          } else {
                            if (x > 0) {
                              commands.push(
                                `turnright(${speedFromDistance(distance ?? 0)})`
                              );
                            } else {
                              commands.push(
                                `turnleft(${speedFromDistance(distance ?? 0)})`
                              );
                            }
                          }

                          // only send when changed and not waiting for ack
                          trySendHoldCommand("fallback", commands);
                        }}
                        stop={() => {
                          sendCmd(["stop"], "fallback", { waitForAck: false });
                          holdCommandRef.current["fallback"] = null;
                        }}
                      />
                    </JoystickVisual>
                  </>
                )}
            </div>

            <footer className="mt-8 text-xs text-neutral-500 dark:text-neutral-400 text-center pointer-events-none">
              توجه: قبل از استفاده، از طریق بخش بلوتوث به دستگاه متصل شوید.
            </footer>
          </div>
        </div>
      </div>

      {/* Fixed project title + subtitle at right-bottom for all projects */}
      <div className="fixed top-10 left-1 z-50 text-right text-wrap" style={{transform: "rotate(-90deg)"}}>
        <h1 className="text-xl font-semibold">{projectId}</h1>
        <p className="text-sm w-20 text-neutral-500 dark:text-neutral-400">
         صفحه‌ی بازی
        </p>
      </div>
    </div>
  );
}
