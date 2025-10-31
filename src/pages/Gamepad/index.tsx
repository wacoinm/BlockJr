// src/pages/Gamepad/index.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Joystick, JoystickShape } from "react-joystick-component";
import bluetoothService from "../../utils/bluetoothService";
import { toast } from "react-toastify";
import { Lightbulb, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Rabbit, Turtle } from "lucide-react";
import stickShape from "/shapeStick.svg";

/**
 * Speed Control Component with animation
 */
function SpeedControl({ isFast, onChange }: { isFast: boolean; onChange: (fast: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-full p-2 shadow-md transition-all duration-300">
      <div className="relative w-16 h-8 rounded-full bg-slate-100 dark:bg-slate-700 cursor-pointer"
           onClick={() => onChange(!isFast)}>
        <div className={`absolute inset-y-1 w-7 bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500 ease-in-out ${
          isFast ? 'right-1' : 'left-1'
        }`} />
        <div className={`absolute inset-0 flex items-center justify-between px-1.5 transition-opacity duration-300`}>
          <Turtle size={16} className={`text-slate-600 dark:text-slate-300 transition-opacity duration-300 ${isFast ? 'opacity-40' : 'opacity-100'}`} />
          <Rabbit size={16} className={`text-slate-600 dark:text-slate-300 transition-opacity duration-300 ${isFast ? 'opacity-100' : 'opacity-40'}`} />
        </div>
      </div>
    </div>
  );
}

/**
 * Gamepad page (rotated presentation wrapper).
 * - Outer layout preserved (no layout shift on resize)
 * - rot-inner is rotated visually
 * - joystick event coordinates are remapped to account for rotation
 * - horizontal scrolling disabled while rotated
 */

const RATE_MS = 200; // Changed to 200ms as requested
const STRONG_PUSH_THRESHOLD = 0.75;

/* ---------- Command formats ---------- */
const Commands = {
  UP: 'up',
  DOWN: 'down',
  DELAY: 'delay',
  GREEN_FLAG: 'green-flag',
  FORWARD: 'forward',
  BACKWARD: 'backward',
  CLOCKWISE: 'turnright',
  COUNTERCLOCKWISE: 'turnleft',
  LAMP_ON: 'lampon',
  LAMP_OFF: 'lampoff',
  SPEED_LOW: 'speed-low',
  SPEED_HIGH: 'speed-high',
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
 * We rotate the inner content by +90deg (clockwise).
 * Pointer events from the joystick come in the rotated element's coordinate system,
 * but the logical X/Y we want to send to the device must be remapped so directions
 * match the visual orientation.
 *
 * For a +90deg rotation (clockwise), the mapping of coordinates is:
 *   visual_x = original_y
 *   visual_y = -original_x
/**
 * So to recover "original" (logical) coordinates given the rotated event:
 *   logical_x = evt.x
 *   logical_y = evt.y
 *
 * We'll apply that remapping for all joystick move handlers.
 */
function remapForRotation(evt: any) {
  if (!evt) return evt;
  const { x, y, distance, direction, ...rest } = evt;
  if (typeof x !== "number" || typeof y !== "number") {
    return { x, y, distance, direction, ...rest };
  }
  // For +90deg rotation:
  // logical_x = -visual_y
  // logical_y = visual_x
  const logicalX = -y;  // Reverse y for x
  const logicalY = x;   // Use x for y
  return { ...rest, x: logicalX, y: logicalY, distance, direction };
}

/* ----------------- VISUAL WRAPPER (fixed to allow pointer events) ----------------- */
function JoystickVisual({
  children,
  size = 180,
  active = false,
  rotate = false,
}: {
  children: React.ReactNode;
  size?: number;
  active?: boolean;
  rotate?: boolean;
}) {
  const s = Math.max(80, Math.min(320, size));

  return (
    <div style={{ width: s, height: s }} className="joy-wrap" aria-hidden={false}>
      <style>{`
        .joy-wrap { position: relative; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; padding: 8px; user-select: none; -webkit-tap-highlight-color: transparent; transition: filter 220ms ease, box-shadow 220ms ease; }
        .joy-decor, .joy-base, .joy-radials, .joy-center, .joy-shaft, .joy-glow, .dir-badge { pointer-events: none; }
        .joy-decor { position: absolute; inset: 0; border-radius: 14px; z-index: 0; background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,249,255,0.95)); box-shadow: 0 10px 24px rgba(12, 24, 48, 0.06), inset 0 2px 6px rgba(255,255,255,0.6); }
        .dark .joy-decor { background: linear-gradient(180deg, rgba(10,14,24,0.7), rgba(20,26,34,0.75)); box-shadow: 0 12px 28px rgba(2,6,12,0.6), inset 0 2px 6px rgba(255,255,255,0.02); }
        .joy-base { position: absolute; inset: 10%; border-radius: 999px; z-index: 1; background: radial-gradient(circle at center, rgba(255,255,255,0.92), rgba(240,246,255,0.9)); box-shadow: inset 0 6px 18px rgba(12,20,40,0.04); overflow: hidden; }
        .joy-base::before { content: ""; position: absolute; inset: 6%; border-radius: 999px; background: radial-gradient(circle, rgba(10,20,40,0.02) 0.5px, transparent 0.5px), repeating-radial-gradient(circle at center, rgba(10,14,30,0.02) 0 6px, transparent 6px 12px); opacity: 0.45; mix-blend-mode: multiply; }
        .dark .joy-base { background: radial-gradient(circle at center, rgba(30,36,44,0.8), rgba(10,14,20,0.7)); box-shadow: inset 0 6px 18px rgba(0,0,0,0.6); }
        .dark .joy-base::before { background: radial-gradient(circle, rgba(255,255,255,0.01) 0.5px, transparent 0.5px), repeating-radial-gradient(circle at center, rgba(255,255,255,0.01) 0 6px, transparent 6px 12px); opacity: 0.18; mix-blend-mode: overlay; }
        .joy-radials { position: absolute; inset: 8%; border-radius: 999px; z-index: 2; }
        .joy-radials::before { content: ""; position: absolute; inset: 0; border-radius: 999px; background: conic-gradient(from 0deg, rgba(12,20,40,0.03) 0.5deg, transparent 1deg); opacity: 0.25; transform: rotate(8deg); }
        .dark .joy-radials::before { background: conic-gradient(from 0deg, rgba(255,255,255,0.02) 0.5deg, transparent 1deg); opacity: 0.06; }
        .joy-center { position: absolute; width: 52%; height: 52%; border-radius: 999px; z-index: 3; display:flex; align-items:center; justify-content:center; background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,250,255,0.96)); box-shadow: inset 0 6px 14px rgba(0,0,0,0.04); }
        .dark .joy-center { background: linear-gradient(180deg, rgba(40,48,58,0.9), rgba(18,22,28,0.9)); box-shadow: inset 0 6px 14px rgba(0,0,0,0.6); }
        .joy-shaft { position: absolute; width: 8px; height: 50%; background: linear-gradient(180deg, #cfd8e3, #98a6bd); border-radius: 6px; z-index: 4; bottom: 50%; transform-origin: 50% 100%; box-shadow: 0 8px 18px rgba(8,12,20,0.08); transition: transform 120ms linear; }
        .dark .joy-shaft { background: linear-gradient(180deg, rgba(130,144,160,0.12), rgba(90,100,120,0.12)); box-shadow: 0 8px 18px rgba(0,0,0,0.6); }
        .joy-glow { position: absolute; inset: 6%; border-radius: 999px; z-index: 2; box-shadow: 0 22px 56px rgba(43, 108, 255, 0.08); opacity: 0; transition: opacity 160ms ease; }
        .joy-glow.on { opacity: 1; }
        .dark .joy-glow { box-shadow: 0 30px 80px rgba(60,140,255,0.16), 0 10px 24px rgba(20,30,70,0.12); }
        .dir-badge { position: absolute; width: 28px; height: 28px; border-radius: 8px; display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.9); box-shadow: 0 6px 14px rgba(6,12,24,0.08); z-index: 8; color: #123248; border: 1px solid rgba(18,50,72,0.06); }
        .dir-up { top: 6%; left: 50%; transform: translate(-50%, 0); }
        .dir-down { bottom: 6%; left: 50%; transform: translate(-50%, 0); }
        .dir-left { left: 6%; top: 50%; transform: translate(0, -50%); }
        .dir-right { right: 6%; top: 50%; transform: translate(0, -50%); }
        .dark .dir-badge { background: rgba(18,22,28,0.76); color: #dbeafe; border: 1px solid rgba(255,255,255,0.03); box-shadow: 0 6px 14px rgba(0,0,0,0.6); }
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

      <div className="joy-holder">
        {children}
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
  const lastDirRef = useRef<Record<string, string>>({});

  // new refs for autosend behavior
  const lastEventRef = useRef<Record<string, any>>({});
  const autoSendTimerRef = useRef<Record<string, number | null>>({});

  // pending ack map: when true for a key, we will not issue further autosends for that key
  const pendingAckRef = useRef<Record<string, boolean>>({});
  // pending ack timeout handlers (to avoid permanent deadlocks)
  const pendingAckTimeoutRef = useRef<Record<string, number | null>>({});

  useEffect(() => {
    document.title = id ? `Gamepad — ${id}` : "Gamepad";
  }, [id]);

  const buildCommand = useCallback((commands: string[]) => {
    // Convert time to seconds and format commands
    if (commands[0] === 'stop') return "stop" 
    else if (commands[0] === Commands.LAMP_ON) return "lampon()"
    else if (commands[0] === Commands.LAMP_OFF) return "lampoff()"
    else if (commands[0] === Commands.SPEED_HIGH) return "speed(100)"
    else if (commands[0] === Commands.SPEED_LOW) return "speed(50)"
    const timeInSec = RATE_MS / 1000; // Convert to seconds
    const formattedCmds = commands.map(cmd => `${cmd}(${timeInSec})`);
    return formattedCmds.join('_');
  }, []);

  // sendCmd optionally waits for ACK by setting pendingAck[key] true
  const sendCmd = useCallback(async (commands: string[], key: string = "global", { waitForAck = true } = {}) => {
    const now = Date.now();
    const last = lastSentMapRef.current[key] ?? 0;
    if (now - last < RATE_MS) return;
    lastSentMapRef.current[key] = now;

    try {
      const formattedCmd = buildCommand(commands);
      const connected = await bluetoothService.isConnected();
      if (!connected) {
        toast.warn("بلوتوث متصل نیست — ابتدا دستگاه را متصل کنید.");
        return;
      }
      // write to device
      await bluetoothService.sendString(formattedCmd);

      // if we want to wait for OK, set pending ack and a safety timeout
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
  }, [buildCommand]);

  // Send speed command when speed mode changes
  useEffect(() => {
    // speed commands should wait for OK as well
      sendCmd([isFastMode ? Commands.SPEED_HIGH : Commands.SPEED_LOW], "speed", { waitForAck: true });
    }, [isFastMode, sendCmd]);

    /* ---------- Data listener for ACK ("OK") ---------- */

    useEffect(() => {
    let unsub: (() => void) | null = null;

    bluetoothService.onOK(() => {
      Object.keys(pendingAckRef.current).forEach((key) => {
        pendingAckRef.current[key] = false;
        const timeout = pendingAckTimeoutRef.current[key];
        if (timeout) {
          clearTimeout(timeout);
          pendingAckTimeoutRef.current[key] = null;
        }
      });
    }).then((u) => (unsub = u));

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  /* ---------- Autosend helpers ---------- */

  // returns array of command strings or empty array
  const commandsFromEvent = useCallback((controllerKey: string, evt: any): string[] => {
    if (!evt) return [];
    const e = remapForRotation(evt);
    const { x, y, distance } = e;

    // fallback: if almost centered -> stop
    if ((Math.abs(x ?? 0) < 0.05) && (Math.abs(y ?? 0) < 0.05)) {
      return ['stop'];
    }

    // per-controller logic similar to your existing handlers
    switch (controllerKey) {
      case "car": {
        const cmds: string[] = [];
        if (Math.abs(y) > 0.05) cmds.push(y < 0 ? Commands.UP : Commands.DOWN);
        if (Math.abs(x) > 0.05) cmds.push(x < 0 ? Commands.COUNTERCLOCKWISE : Commands.CLOCKWISE);
        return cmds;
      }
      case "tele": {
        const cmds: string[] = [];
        if (Math.abs(y) > 0.05) cmds.push(y < 0 ? Commands.FORWARD : Commands.BACKWARD);
        if (Math.abs(x) > 0.05) cmds.push(x < 0 ? Commands.COUNTERCLOCKWISE : Commands.CLOCKWISE);
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
        if (Math.abs(y) < 0.05) return ['stop'];
        if (y < 0) cmds.push(Commands.UP);
        else cmds.push(Commands.DOWN);
        return cmds;
      }
      case "fallback": {
        const cmds: string[] = [];
        if ((Math.abs(x ?? 0) < 0.05) && (Math.abs(y ?? 0) < 0.05)) return ['stop'];
        if (Math.abs(y) > Math.abs(x)) {
          if (y < 0) cmds.push(`forward(${speedFromDistance(distance ?? 0)})`);
          else cmds.push(`backward(${speedFromDistance(distance ?? 0)})`);
        } else {
          if (x > 0) cmds.push(`turnright(${speedFromDistance(distance ?? 0)})`);
          else cmds.push(`turnleft(${speedFromDistance(distance ?? 0)})`);
        }
        return cmds;
      }
      default:
        return [];
    }
  }, []);

  const startAutoSend = useCallback((key: string) => {
    if (autoSendTimerRef.current[key]) return; // already running
    // use window.setInterval so we can clear with window.clearInterval
    const id = window.setInterval(() => {
      const lastEvt = lastEventRef.current[key];
      if (!lastEvt) {
        // nothing to send — keep timer running until explicit stop for reliability
        return;
      }

      // If waiting for ack for this key, skip sending new command
      if (pendingAckRef.current[key]) {
        // console.debug(`[Gamepad] waiting for OK for key=${key}; skipping send`);
        return;
      }

      const cmds = commandsFromEvent(key, lastEvt);
      if (cmds.length > 0) {
        // autosend should wait for OK to enforce serial feedback loop
        sendCmd(cmds, key, { waitForAck: true });
      }
    }, RATE_MS);
    autoSendTimerRef.current[key] = id;
  }, [commandsFromEvent, sendCmd]);

  const stopAutoSend = useCallback((key: string) => {
    const id = autoSendTimerRef.current[key];
    if (id) {
      window.clearInterval(id);
      autoSendTimerRef.current[key] = null;
    }
    lastEventRef.current[key] = null;

    // clear pending ack and timeout for this key as well
    pendingAckRef.current[key] = false;
    const prev = pendingAckTimeoutRef.current[key];
    if (prev) {
      window.clearTimeout(prev);
      pendingAckTimeoutRef.current[key] = null;
    }
  }, []);

  // helper to immediately stop controller and stop autosend
  const sendStopAndClear = useCallback((key: string) => {
    // send stop but do NOT wait for ack here (stop should be immediate)
    sendCmd(['stop'], key, { waitForAck: false });
    stopAutoSend(key);
  }, [sendCmd, stopAutoSend]);

  const toggleLight = useCallback(() => {
    const next = !lightOn;
    setLightOn(next);
    const cmd = next ? Commands.LAMP_ON : Commands.LAMP_OFF;
    // lights also wait for OK
    sendCmd([cmd], "light", { waitForAck: true });
  }, [lightOn, sendCmd]);

  /* ---------- MOVE HANDLERS use remapForRotation + autosend ---------- */

  const calculateEffectiveSpeed = useCallback((distance: number) => {
    const baseSpeed = speedFromDistance(distance);
    if (isFastMode) {
      return distance >= STRONG_PUSH_THRESHOLD ? Math.max(baseSpeed, 90) : Math.max(baseSpeed, 45);
    } else {
      return distance >= STRONG_PUSH_THRESHOLD ? Math.max(baseSpeed, 70) : Math.max(baseSpeed, 30);
    }
  }, [isFastMode]);

  // CAR handlers
  const onCarMove = useCallback((evt: any) => {
    if (!evt) return;
    lastEventRef.current["car"] = evt;
    startAutoSend("car");

    const cmds = commandsFromEvent("car", evt);
    if (cmds.length > 0 && !pendingAckRef.current["car"]) {
      // allow immediate send on move if not waiting for ack
      sendCmd(cmds, "car", { waitForAck: true });
    }
  }, [startAutoSend, sendCmd, commandsFromEvent]);

  const onCarStop = useCallback(() => {
    sendStopAndClear("car");
  }, [sendStopAndClear]);

  // TELE handlers
  const onTeleMove = useCallback((evt: any) => {
    if (!evt) return;
    lastEventRef.current["tele"] = evt;
    startAutoSend("tele");
    const cmds = commandsFromEvent("tele", evt);
    if (cmds.length > 0 && !pendingAckRef.current["tele"]) sendCmd(cmds, "tele", { waitForAck: true });
  }, [startAutoSend, sendCmd, commandsFromEvent]);

  const onTeleStop = useCallback(() => {
    sendStopAndClear("tele");
  }, [sendStopAndClear]);

  // CRANE LEFT (movement)
  interface IJoystickUpdateEvent {
    x: number | null;
    y: number | null;
    distance: number | null;
    angle?: number | null;
  }

  const onCraneMoveLeft = useCallback((evt: IJoystickUpdateEvent) => {
    if (!evt) return;
    lastEventRef.current["crane-move"] = evt;
    startAutoSend("crane-move");
    const cmds = commandsFromEvent("crane-move", evt);
    if (cmds.length > 0 && !pendingAckRef.current["crane-move"]) sendCmd(cmds, "crane-move", { waitForAck: true });
  }, [startAutoSend, sendCmd, commandsFromEvent]);

  const onCraneMoveLeftStop = useCallback(() => {
    sendStopAndClear("crane-move");
  }, [sendStopAndClear]);

  // CRANE RIGHT (elevator)
  const onCraneMoveRight = useCallback((evt: IJoystickUpdateEvent) => {
    if (!evt) return;
    lastEventRef.current["crane-elevator"] = evt;
    startAutoSend("crane-elevator");
    const cmds = commandsFromEvent("crane-elevator", evt);
    if (cmds.length > 0 && !pendingAckRef.current["crane-elevator"]) sendCmd(cmds, "crane-elevator", { waitForAck: true });
  }, [startAutoSend, sendCmd, commandsFromEvent]);

  const onCraneMoveRightStop = useCallback(() => {
    sendStopAndClear("crane-elevator");
  }, [sendStopAndClear]);

  useEffect(() => {
    return () => {
      // stop all timers
      Object.keys(autoSendTimerRef.current).forEach(k => {
        const id = autoSendTimerRef.current[k];
        if (id) window.clearInterval(id);
      });
      // Send stop command to all controllers on unmount (do not wait for ack)
      ["car", "tele", "crane-move", "crane-elevator", "fallback"].forEach((controller) => {
        sendCmd(['stop'], controller, { waitForAck: false });
      });
    };
  }, [sendCmd]);

  const projectId = id ?? "";
  const isMobile = typeof window !== "undefined" ? window.innerWidth <= 420 : true;
  const joystickSize = isMobile ? 120 : 140;

  const nearTransparentBase = "rgba(0,0,0,0.01)";
  const nearTransparentStick = "rgba(255,255,255,0.92)";

  /* ---------- RENDER ---------- */
  return (
    // Root takes the whole viewport and disables overflow to prevent scrollbars when rotated
    <div className="min-h-screen min-w-screen w-screen h-screen p-4 flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-black transition-colors duration-500 overflow-hidden">
      {/* Wrapper that preserves layout; content inside will be rotated */}
      <div className="w-full h-full flex items-center justify-center" style={{ touchAction: "none" }}>
        {/* rot-inner: this block is rotated +90deg (clockwise). 
            We use viewport-based swapped sizes and overflow-hidden so no X-scroll appears. */}
        <div
          style={{
            transform: "rotate(-90deg)", // Changed from 90deg to -90deg to reverse the rotation
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
            <header className="flex items-center justify-between mb-4 flex-row-reverse">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleLight}
                  aria-pressed={lightOn}
                  className={`p-2 rounded-full transition-transform duration-300 shadow ${lightOn ? "scale-105" : ""} bg-white dark:bg-slate-800`}
                  title={lightOn ? "خاموش کردن چراغ" : "روشن کردن چراغ"}
                >
                  <Lightbulb className={`w-5 h-5 ${lightOn ? "text-yellow-400" : "text-neutral-400"}`} />
                </button>
                <SpeedControl isFast={isFastMode} onChange={setIsFastMode} />
              </div>

              <div className="text-end mx-12">
                <h1 className="text-xl font-semibold">{projectId}</h1>
                <p className="text-sm text-nowrap text-neutral-500 dark:text-neutral-400">کنترل از راه دور — صفحه‌ی بازی</p>
              </div>

              <button onClick={() => navigate(-1)} className="px-3 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800">
                بازگشت
              </button>
            </header>

            <div className="flex flex-col gap-6 mt-[6vw] items-center">
              {projectId === "ماشین" && (
                <>
                  <div className="text-sm text-center text-neutral-600 dark:text-neutral-300">جوی‌استیک: حرکت بالا / پایین</div>
                  <div className="w-full flex justify-center my-8">
                    <JoystickVisual size={joystickSize} active={false}>
                      <Joystick
                        size={joystickSize}
                        stickSize={Math.round(joystickSize * 0.75)}
                        controlPlaneShape={JoystickShape.AxisX}
                        baseShape={JoystickShape.Circle}
                        stickShape={JoystickShape.Circle}
                        baseColor={nearTransparentBase}
                        stickColor={nearTransparentStick}
                        minDistance={0}
                        move={onCarMove}
                        stop={onCarStop}
                        start={() => {}}
                        throttle={30}
                        stickImage={stickShape}
                      />
                    </JoystickVisual>
                  </div>
                </>
              )}

              {projectId === "جرثقیل" && (
                <>
                  {/* Always horizontal layout (do not switch to column on small widths) */}
                  <div className="w-full flex flex-row gap-3 items-start justify-between">
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <div className="text-sm my-8 text-center text-neutral-600 text-nowrap dark:text-neutral-300">حرکت: جلو/عقب/چپ/راست</div>
                      <JoystickVisual size={joystickSize} active={false}>
                        <Joystick
                          size={joystickSize}
                          stickSize={Math.round(joystickSize * 0.65)}
                          controlPlaneShape={JoystickShape.Circle}
                          baseShape={JoystickShape.Circle}
                          stickShape={JoystickShape.Circle}
                          baseColor={nearTransparentBase}
                          stickColor={nearTransparentStick}
                          minDistance={0}
                          move={onCraneMoveLeft}
                          stop={onCraneMoveLeftStop}
                          throttle={25}
                          stickImage={stickShape}
                        />
                      </JoystickVisual>
                    </div>

                    <div className="flex-1 flex flex-col items-center gap-2">
                      <div className="text-sm my-8 text-center text-neutral-600 text-nowrap dark:text-neutral-300">بالا/پایین (محدود روی Y)</div>
                      <JoystickVisual size={joystickSize} active={false}>
                        <Joystick
                          size={joystickSize}
                          stickSize={Math.round(joystickSize * 0.65)}
                          controlPlaneShape={JoystickShape.AxisX}
                          baseShape={JoystickShape.Circle}
                          stickShape={JoystickShape.Circle}
                          baseColor={nearTransparentBase}
                          stickColor={nearTransparentStick}
                          minDistance={0}
                          move={onCraneMoveRight}
                          stop={onCraneMoveRightStop}
                          throttle={25}
                          stickImage={stickShape}
                        />
                      </JoystickVisual>
                    </div>
                  </div>
                </>
              )}

              {projectId === "منجنیق" && (
                <>
                  <div className="text-sm text-center text-neutral-600 text-nowrap dark:text-neutral-300">جوی‌استیک: فقط محور X (چپ/راست)</div>
                  <div className="w-full flex justify-center my-8">
                    <JoystickVisual size={joystickSize} active={false}>
                      <Joystick
                        size={joystickSize}
                        stickSize={Math.round(joystickSize * 0.75)}
                        controlPlaneShape={JoystickShape.AxisX}
                        baseShape={JoystickShape.Circle}
                        stickShape={JoystickShape.Circle}
                        baseColor={nearTransparentBase}
                        stickColor={nearTransparentStick}
                        minDistance={0}
                        move={onTeleMove}
                        stop={onTeleStop}
                        throttle={30}
                        stickImage={stickShape}
                      />
                    </JoystickVisual>
                  </div>
                </>
              )}

              {projectId !== "ماشین" && projectId !== "جرثقیل" && projectId !== "منجنیق" && (
                <>
                  <div className="text-sm text-center text-neutral-600 text-nowrap dark:text-neutral-300">پروژه‌ی مشخص‌شده پشتیبانی نمی‌شود. یک جوی‌استیک عمومی نمایش داده شده است.</div>
                  <JoystickVisual size={joystickSize} active={false}>
                    <Joystick
                      size={joystickSize}
                      stickSize={Math.round(joystickSize * 0.75)}
                      controlPlaneShape={JoystickShape.Circle}
                      baseShape={JoystickShape.Circle}
                      stickShape={JoystickShape.Circle}
                      baseColor={nearTransparentBase}
                      stickColor={nearTransparentStick}
                      minDistance={0}
                      stickImage={stickShape}
                      move={(e) => {
                        if (!e) return;
                        // store last event and start autosend for fallback
                        lastEventRef.current["fallback"] = e;
                        startAutoSend("fallback");

                        const ev = remapForRotation(e);
                        const { x, y, distance } = ev;
                        
                        if (Math.abs(y) < 0.05 && Math.abs(x) < 0.05) {
                          sendCmd(['stop'], "fallback", { waitForAck: false });
                          return;
                        }

                        const commands: string[] = [];
                        
                        if (Math.abs(y) > Math.abs(x)) {
                          if (y < 0) {
                            commands.push(`forward(${speedFromDistance(distance ?? 0)})`);
                          } else {
                            commands.push(`backward(${speedFromDistance(distance ?? 0)})`);
                          }
                        } else {
                          if (x > 0) {
                            commands.push(`turnright(${speedFromDistance(distance ?? 0)})`);
                          } else {
                            commands.push(`turnleft(${speedFromDistance(distance ?? 0)})`);
                          }
                        }

                        if (commands.length > 0 && !pendingAckRef.current["fallback"]) {
                          sendCmd(commands, "fallback", { waitForAck: true });
                        }
                      }}
                      stop={() => {
                        sendCmd(['stop'], "fallback", { waitForAck: false });
                        stopAutoSend("fallback");
                      }}
                      throttle={60}
                    />
                  </JoystickVisual>
                </>
              )}
            </div>

            <footer dir="rtl" className="mt-8 text-xs text-neutral-500 dark:text-neutral-400 text-center">
              توجه: قبل از استفاده، از طریق بخش بلوتوث به دستگاه متصل شوید.
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
