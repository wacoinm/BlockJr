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

const RATE_MS = 40;
const STRONG_PUSH_THRESHOLD = 0.75;

function clamp01(v: number) {
  if (isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function speedFromDistance(distance: number) {
  return Math.round(clamp01(distance) * 100);
}

export default function GamepadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lightOn, setLightOn] = useState(false);

  const lastSentMapRef = useRef<Record<string, number>>({});
  // stores last direction name per channel, e.g. 'up' | 'down' | 'forward' | 'backward' | 'turnright' | 'turnleft'
  const lastDirRef = useRef<Record<string, string>>({});

  useEffect(() => {
    document.title = id ? `Gamepad — ${id}` : "Gamepad";
  }, [id]);

  const sendCmd = useCallback(async (cmd: string, key: string = "global") => {
    const now = Date.now();
    const last = lastSentMapRef.current[key] ?? 0;
    if (now - last < RATE_MS) return;
    lastSentMapRef.current[key] = now;

    try {
      const connected = await bluetoothService.isConnected();
      if (!connected) {
        toast.warn("بلوتوث متصل نیست — ابتدا دستگاه را متصل کنید.");
        return;
      }
      console.log(`[BT SEND] ${new Date().toISOString()} key=${key} cmd=${cmd}`);
      await bluetoothService.sendString(cmd);
    } catch (e) {
      console.error("Failed to send cmd", e);
      toast.error("خطا در ارسال فرمان بلوتوث.");
    }
  }, []);

  // send zero-speed for the last known direction in a channel (replaces stop())
  const sendZeroForKey = useCallback((key: string) => {
    const dir = lastDirRef.current[key];
    if (!dir) return;
    sendCmd(`${dir}(0)`, key);
  }, [sendCmd]);

  const toggleLight = useCallback(() => {
    const next = !lightOn;
    setLightOn(next);
    const cmd = next ? "lampon()" : "lampoff()";
    sendCmd(cmd, "light");
  }, [lightOn, sendCmd]);

  // Elevator
  const onElevatorMove = useCallback((evt: any) => {
    if (!evt) return;
    const { y, distance } = evt;
    if (y == null) return;
    if (Math.abs(y) < 0.05) return;
    const speed = speedFromDistance(distance ?? 0.0);
    const effectiveSpeed = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
    if (y < 0) {
      lastDirRef.current["elevator"] = "up";
      sendCmd(`up(${effectiveSpeed})`, "elevator");
    } else {
      lastDirRef.current["elevator"] = "down";
      sendCmd(`down(${effectiveSpeed})`, "elevator");
    }
  }, [sendCmd]);

  const onElevatorStop = useCallback(() => {
    sendZeroForKey("elevator");
  }, [sendZeroForKey]);

  // Telecabine
  const onTeleMove = useCallback((evt: any) => {
    if (!evt) return;
    const { x, distance } = evt;
    if (x == null) return;
    if (Math.abs(x) < 0.05) return;
    const speed = speedFromDistance(distance ?? 0);
    const effectiveSpeed = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
    if (x > 0) {
      lastDirRef.current["tele"] = "forward";
      sendCmd(`forward(${effectiveSpeed})`, "tele");
    } else {
      lastDirRef.current["tele"] = "backward";
      sendCmd(`backward(${effectiveSpeed})`, "tele");
    }
  }, [sendCmd]);

  const onTeleStop = useCallback(() => {
    sendZeroForKey("tele");
  }, [sendZeroForKey]);

  // Crane - left joystick (movement)
  const onCraneMoveLeft = useCallback((evt: any) => {
    if (!evt) return;
    const { x, y, distance } = evt;
    if (x == null || y == null) return;

    if (Math.abs(x) > Math.abs(y)) {
      if (Math.abs(x) < 0.05) return;
      const speed = speedFromDistance(distance ?? 0);
      const s = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
      if (x > 0) {
        lastDirRef.current["crane-move"] = "turnright";
        sendCmd(`turnright(${s})`, "crane-move");
      } else {
        lastDirRef.current["crane-move"] = "turnleft";
        sendCmd(`turnleft(${s})`, "crane-move");
      }
    } else {
      if (Math.abs(y) < 0.05) return;
      const speed = speedFromDistance(distance ?? 0);
      const s = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
      if (y < 0) {
        lastDirRef.current["crane-move"] = "forward";
        sendCmd(`forward(${s})`, "crane-move");
      } else {
        lastDirRef.current["crane-move"] = "backward";
        sendCmd(`backward(${s})`, "crane-move");
      }
    }
  }, [sendCmd]);

  const onCraneMoveLeftStop = useCallback(() => {
    sendZeroForKey("crane-move");
  }, [sendZeroForKey]);

  // Crane - right joystick (up/down)
  const onCraneMoveRight = useCallback((evt: any) => {
    if (!evt) return;
    const { y, distance } = evt;
    if (y == null) return;
    if (Math.abs(y) < 0.05) return;
    const speed = speedFromDistance(distance ?? 0);
    const s = distance >= STRONG_PUSH_THRESHOLD ? Math.max(speed, 80) : Math.max(speed, 35);
    if (y < 0) {
      lastDirRef.current["crane-elevator"] = "up";
      sendCmd(`up(${s})`, "crane-elevator");
    } else {
      lastDirRef.current["crane-elevator"] = "down";
      sendCmd(`down(${s})`, "crane-elevator");
    }
  }, [sendCmd]);

  const onCraneMoveRightStop = useCallback(() => {
    sendZeroForKey("crane-elevator");
  }, [sendZeroForKey]);

  useEffect(() => {
    return () => {
      // on unmount, try to send zero for all known channels
      Object.keys(lastDirRef.current).forEach((k) => {
        const dir = lastDirRef.current[k];
        if (dir) {
          // best-effort, may be rate-limited
          sendCmd(`${dir}(0)`, k);
        }
      });
    };
  }, [sendCmd]);

  const projectId = id ?? "";
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
                  controlPlaneShape={JoystickShape.AxisY}
                  move={onElevatorMove}
                  stop={onElevatorStop}
                  start={() => {}}
                  throttle={30}
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
                    controlPlaneShape={JoystickShape.Plane}
                    move={onCraneMoveLeft}
                    stop={onCraneMoveLeftStop}
                    throttle={25}
                  />
                </div>

                <div className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-sm my-8 text-center text-neutral-600 dark:text-neutral-300">بالا/پایین (محدود روی Y)</div>
                  <Joystick
                    size={joystickSize}
                    controlPlaneShape={JoystickShape.AxisY}
                    move={onCraneMoveRight}
                    stop={onCraneMoveRightStop}
                    throttle={25}
                  />
                </div>
              </div>
            </>
          )}

          {projectId === "تله کابین" && (
            <>
              <div className="text-sm text-center text-neutral-600 dark:text-neutral-300">جوی‌استیک: فقط محور X (چپ/راست)</div>
              <div className="w-full flex justify-center my-8">
                <Joystick
                  size={joystickSize}
                  controlPlaneShape={JoystickShape.AxisX}
                  move={onTeleMove}
                  stop={onTeleStop}
                  throttle={30}
                />
              </div>
            </>
          )}

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
                    if (y < 0) {
                      lastDirRef.current["fallback"] = "forward";
                      sendCmd(`forward(${speedFromDistance(distance ?? 0)})`, "fallback");
                    } else {
                      lastDirRef.current["fallback"] = "backward";
                      sendCmd(`backward(${speedFromDistance(distance ?? 0)})`, "fallback");
                    }
                  } else {
                    if (x > 0) {
                      lastDirRef.current["fallback"] = "turnright";
                      sendCmd(`turnright(${speedFromDistance(distance ?? 0)})`, "fallback");
                    } else {
                      lastDirRef.current["fallback"] = "turnleft";
                      sendCmd(`turnleft(${speedFromDistance(distance ?? 0)})`, "fallback");
                    }
                  }
                }}
                stop={() => sendZeroForKey("fallback")}
                throttle={60}
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
