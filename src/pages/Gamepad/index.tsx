// src/pages/Gamepad/index.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Joystick, JoystickShape } from "react-joystick-component";
import bluetoothService from "../../utils/bluetoothService";
import { toast } from "react-toastify";
import { Lightbulb } from "lucide-react";

/**
 * Gamepad page:
 * - /gamepad/:id
 * - Supports three projects with different joystick setup:
 *   - آسانسور  -> single joystick (Y axis only) + light button
 *   - جرثقیل   -> two joysticks (left = full plane for move, right = Y axis only for up/down) + light
 *   - تله کابین -> single joystick (X axis only) + light
 *
 * Uses react-joystick-component. Sends bluetooth commands via bluetoothService.sendString(...)
 *
 * Commands sent: up(n), down(n), forward(n), backward(n), turnright(n), turnleft(n), lampon(), lampoff(), stop()
 *
 * Note: This file constrains joysticks using `controlPlaneShape` (JoystickShape.AxisX / AxisY).
 */

const RATE_MS = 120; // minimum ms between bluetooth sends
const STRONG_PUSH_THRESHOLD = 0.75; // "خیلی کشیده شد" threshold

function clamp01(v: number) {
  if (isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function speedFromDistance(distance: number) {
  // distance: 0..1 -> map to 0..100
  return Math.round(clamp01(distance) * 100);
}

export default function GamepadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lightOn, setLightOn] = useState(false);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    document.title = id ? `Gamepad — ${id}` : "Gamepad";
  }, [id]);

  // helper to send command (rate-limited)
  const sendCmd = useCallback(async (cmd: string) => {
    const now = Date.now();
    if (now - lastSentRef.current < RATE_MS) return;
    lastSentRef.current = now;
    try {
      const connected = await bluetoothService.isConnected();
      if (!connected) {
        toast.warn("بلوتوث متصل نیست — ابتدا دستگاه را متصل کنید.");
        return;
      }
      await bluetoothService.sendString(cmd);
    } catch (e) {
      console.error("Failed to send cmd", e);
      toast.error("خطا در ارسال فرمان بلوتوث.");
    }
  }, []);

  // Light toggle
  const toggleLight = useCallback(() => {
    const next = !lightOn;
    setLightOn(next);
    const cmd = next ? "lampon()" : "lampoff()";
    sendCmd(cmd);
  }, [lightOn, sendCmd]);

  // Elevator (آسانسور): only Y axis matters
  const onElevatorMove = useCallback((evt: any) => {
    if (!evt) return;
    const { y, distance } = evt;
    if (y == null) return;
    if (Math.abs(y) < 0.05) return;
    const speed = speedFromDistance(distance ?? 0.0);
    if (y < 0) {
      // up
      const effectiveSpeed = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
      sendCmd(`up(${effectiveSpeed})`);
    } else {
      const effectiveSpeed = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
      sendCmd(`down(${effectiveSpeed})`);
    }
  }, [sendCmd]);

  const onElevatorStop = useCallback(() => {
    sendCmd("stop()");
  }, [sendCmd]);

  // Telecabine (تله کابین): X axis only
  const onTeleMove = useCallback((evt: any) => {
    if (!evt) return;
    const { x, distance } = evt;
    if (x == null) return;
    if (Math.abs(x) < 0.05) return;
    const speed = speedFromDistance(distance ?? 0);
    if (x > 0) {
      const effectiveSpeed = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
      sendCmd(`forward(${effectiveSpeed})`);
    } else {
      const effectiveSpeed = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
      sendCmd(`backward(${effectiveSpeed})`);
    }
  }, [sendCmd]);

  const onTeleStop = useCallback(() => {
    sendCmd("stop()");
  }, [sendCmd]);

  // Crane (جرثقیل):
  // left joystick controls movement (full plane). We pick dominant axis for direction.
  // right joystick limited to Y axis for up/down.
  const onCraneMoveLeft = useCallback((evt: any) => {
    if (!evt) return;
    const { x, y, distance } = evt;
    if (x == null || y == null) return;
    // choose dominant axis
    if (Math.abs(x) > Math.abs(y)) {
      // horizontal -> turn left/right
      if (Math.abs(x) < 0.05) return;
      const speed = speedFromDistance(distance ?? 0);
      if (x > 0) {
        const s = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
        sendCmd(`turnright(${s})`);
      } else {
        const s = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
        sendCmd(`turnleft(${s})`);
      }
    } else {
      // vertical -> forward/backward
      if (Math.abs(y) < 0.05) return;
      const speed = speedFromDistance(distance ?? 0);
      if (y < 0) {
        const s = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
        sendCmd(`forward(${s})`);
      } else {
        const s = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
        sendCmd(`backward(${s})`);
      }
    }
  }, [sendCmd]);

  const onCraneMoveLeftStop = useCallback(() => {
    sendCmd("stop()");
  }, [sendCmd]);

  const onCraneMoveRight = useCallback((evt: any) => {
    if (!evt) return;
    const { y, distance } = evt;
    if (y == null) return;
    if (Math.abs(y) < 0.05) return;
    const speed = speedFromDistance(distance ?? 0);
    if (y < 0) {
      const s = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
      sendCmd(`up(${s})`);
    } else {
      const s = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
      sendCmd(`down(${s})`);
    }
  }, [sendCmd]);

  const onCraneMoveRightStop = useCallback(() => {
    sendCmd("stop()");
  }, [sendCmd]);

  useEffect(() => {
    return () => {
      sendCmd("stop()");
    };
  }, [sendCmd]);

  const projectId = id ?? "";

  // Responsive joystick sizing
  const isMobile = typeof window !== "undefined" ? window.innerWidth <= 420 : true;
  const joystickSize = isMobile ? 120 : 180;

  return (
    <div className="min-h-screen bg-page-light dark:bg-page-dark transition-colors duration-300 p-4">
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
          </div>
          <div className="text-end">
            <h1 className="text-xl font-semibold">{projectId}</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">کنترل از راه دور — صفحه‌ی بازی</p>
          </div>
          <button
              onClick={() => navigate(-1)}
              className="px-3 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800"
            >
              بازگشت
            </button>
        </header>

        <div className="flex flex-col gap-6 mt-[14vh] items-center">
          {projectId === "آسانسور" && (
            <>
              <div className="text-sm text-center  text-neutral-600 dark:text-neutral-300">جوی‌استیک: حرکت بالا / پایین</div>
              <div className="w-full flex justify-center my-8">
                <Joystick
                  size={joystickSize}
                  controlPlaneShape={JoystickShape.AxisY}   // <-- Y axis only
                  move={onElevatorMove}
                  stop={onElevatorStop}
                  start={() => {}}
                  throttle={50}
                />
              </div>
            </>
          )}

          {projectId === "جرثقیل" && (
            <>
              <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-sm my-8 text-center text-neutral-600 dark:text-neutral-300">حرکت: جلو/عقب/چپ/راست</div>
                  <Joystick
                    size={joystickSize}
                    controlPlaneShape={JoystickShape.Plane} // full plane (default)
                    move={onCraneMoveLeft}
                    stop={onCraneMoveLeftStop}
                    throttle={40}
                  />
                </div>

                <div className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-sm my-8 text-center text-neutral-600 dark:text-neutral-300">بالا/پایین (محدود روی Y)</div>
                  <Joystick
                    size={joystickSize}
                    controlPlaneShape={JoystickShape.AxisY} // Y axis only
                    move={onCraneMoveRight}
                    stop={onCraneMoveRightStop}
                    throttle={40}
                  />
                </div>
              </div>
            </>
          )}

          {projectId === "تله کابین" && (
            <>
              <div className="text-sm text-center text-neutral-600 dark:text-neutral-300">جوی‌استیک: فقط محور X (چپ/راست)</div>
              <div className="w-full flex justify-center">
                <Joystick
                  size={joystickSize}
                  controlPlaneShape={JoystickShape.AxisX}  // <-- X axis only
                  move={onTeleMove}
                  stop={onTeleStop}
                  throttle={50}
                />
              </div>
            </>
          )}

          {/* fallback general joystick when project not recognized */}
          {projectId !== "آسانسور" && projectId !== "جرثقیل" && projectId !== "تله کابین" && (
            <>
              <div className="text-sm text-center text-neutral-600 dark:text-neutral-300">پروژه‌ی مشخص‌شده پشتیبانی نمی‌شود. یک جوی‌استیک عمومی نمایش داده شده است.</div>
              <Joystick
                size={joystickSize}
                controlPlaneShape={JoystickShape.Plane}
                move={(e) => {
                  if (!e) return;
                  const { x, y, distance } = e;
                  if (Math.abs(y) > Math.abs(x)) {
                    if (y < 0) sendCmd(`forward(${speedFromDistance(distance ?? 0)})`);
                    else sendCmd(`backward(${speedFromDistance(distance ?? 0)})`);
                  } else {
                    if (x > 0) sendCmd(`turnright(${speedFromDistance(distance ?? 0)})`);
                    else sendCmd(`turnleft(${speedFromDistance(distance ?? 0)})`);
                  }
                }}
                stop={() => sendCmd("stop()")}
                throttle={80}
              />
            </>
          )}
        </div>

        <footer dir="rtl" className="mt-8 text-xs text-neutral-500 dark:text-neutral-400 text-center">
          توجه: قبل از استفاده، از طریق بخش بلوتوث به دستگاه متصل شوید.
        </footer>
      </div>
    </div>
  );
}
