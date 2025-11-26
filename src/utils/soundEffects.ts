// src/utils/soundEffects.ts
// Hook + helper to play deterministic, color-based sounds for blocks.
// Backwards-compatible: calling returned function with no args will play a default snap sound.
// Uses WebAudio (no external files).

import { useCallback, useRef } from "react";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

/** simple deterministic hash from string -> number */
function hashString(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** map block type -> color name (tweakable) */
function colorForBlockType(type: string) {
  switch (type) {
    case "green-flag":
      return "green";
    case "up":
    case "forward":
      return "blue";
    case "down":
    case "backward":
      return "red";
    case "clockwise":
    case "countclockwise":
      return "yellow";
    case "delay":
      return "purple";
    case "lamp-on":
    case "lamp-off":
      return "orange";
    case "speed-low":
    case "speed-high":
      return "teal";
    case "shoot":
      return "red";
    default:
      return "gray";
  }
}

/** deterministic mapping: color -> tone descriptor (frequencies, waveform, base gain) */
const COLOR_SOUNDS: Record<
  string,
  {
    freqs: number[]; // primary frequencies
    wave?: OscillatorType;
    baseGain?: number;
    duration?: number; // seconds
  }
> = {
  green: { freqs: [520, 780], wave: "sine", baseGain: 0.16, duration: 0.12 },
  blue: { freqs: [440, 660], wave: "sine", baseGain: 0.14, duration: 0.12 },
  red: { freqs: [220, 330, 440], wave: "sawtooth", baseGain: 0.18, duration: 0.14 },
  yellow: { freqs: [620, 860], wave: "triangle", baseGain: 0.13, duration: 0.12 },
  purple: { freqs: [300, 420, 480], wave: "sawtooth", baseGain: 0.14, duration: 0.18 },
  orange: { freqs: [520], wave: "square", baseGain: 0.14, duration: 0.10 },
  teal: { freqs: [380, 760], wave: "sine", baseGain: 0.12, duration: 0.11 },
  gray: { freqs: [440], wave: "sine", baseGain: 0.11, duration: 0.08 },
};

/** play a short tone/chord; if harsh true, adds detune/noise */
function playTone(
  audioContext: AudioContext,
  freqs: number[],
  opts: { wave?: OscillatorType; duration?: number; baseGain?: number; harsh?: boolean }
) {
  const now = audioContext.currentTime;
  const duration = opts.duration ?? 0.12;
  const wave = opts.wave ?? "sine";
  const baseGain = opts.baseGain ?? 0.14;
  const harsh = !!opts.harsh;

  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(baseGain * (harsh ? 2.5 : 1.8), now);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 1.05);
  masterGain.connect(audioContext.destination);

  freqs.forEach((f, idx) => {
    const osc = audioContext.createOscillator();
    osc.type = wave;
    // slight detune if harsh
    const detune = harsh ? (idx % 2 === 0 ? -12 : +8) : (idx % 2 === 0 ? -2 : +1);
    osc.frequency.setValueAtTime(f, now);
    if (osc.detune) osc.detune.setValueAtTime(detune, now);

    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(harsh ? Math.max(900, f * 2) : Math.max(1200, f * 3), now);

    const g = audioContext.createGain();
    const partialGain = baseGain / Math.max(1, freqs.length) * (1 - idx * 0.12);
    g.gain.setValueAtTime(partialGain, now);

    osc.connect(filter);
    filter.connect(g);
    g.connect(masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  });

  // add a tiny noise burst for harshness (keeps deterministic feel since harsh is deterministic)
  if (harsh) {
    const noiseDur = Math.min(0.06, duration);
    const bufferSize = Math.floor(audioContext.sampleRate * noiseDur);
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.25;
    }
    const src = audioContext.createBufferSource();
    src.buffer = buffer;
    const ng = audioContext.createGain();
    ng.gain.setValueAtTime(0.10, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + noiseDur);
    src.connect(ng);
    ng.connect(audioContext.destination);
    src.start(now);
    src.stop(now + noiseDur);
  }
}

/** Play a small default snap/click sound (used when no arg passed). */
function playDefaultSnap(audioContext: AudioContext) {
  const now = audioContext.currentTime;
  // short click: single oscillator + very fast envelope
  const osc = audioContext.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1000, now);

  const g = audioContext.createGain();
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.16, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  // tiny highpass to make it snappier
  const hp = audioContext.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(800, now);

  osc.connect(hp);
  hp.connect(g);
  g.connect(audioContext.destination);

  osc.start(now);
  osc.stop(now + 0.09);
}

/**
 * Hook: useSnapSound
 * returns (blockOrColor?: object|string|undefined) => void
 * - if called with Block obj: derives color from type + deterministic harsh variant via hash(id)
 * - if called with color string: uses that color mapping
 * - if called with nothing/undefined: plays a short default snap (like previous behavior)
 */
export const useSnapSound = () => {
  const audioRef = useRef<AudioContext | null>(null);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (!audioRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      audioRef.current = new AudioCtx();
    }
    const ctx = audioRef.current!;
    // try resume if suspended (mobile browsers)
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        // ignore resume errors
      });
    }
    return ctx;
  }, []);

  const playFn = useCallback(
    (blockOrColor?: any) => {
      const ctx = ensureCtx();
      if (!ctx) return;

      // If no argument -> behavior restored: play default snap
      if (typeof blockOrColor === "undefined" || blockOrColor === null) {
        try {
          playDefaultSnap(ctx);
        } catch (e) {
          // swallow
          // eslint-disable-next-line no-console
          console.warn("playDefaultSnap failed", e);
        }
        return;
      }

      // If a string was passed, treat as color key
      let colorKey = "gray";
      let blockId = "palette-default";
      if (typeof blockOrColor === "string") {
        colorKey = blockOrColor;
      } else if (typeof blockOrColor === "object") {
        colorKey = colorForBlockType(blockOrColor.type ?? "");
        blockId = blockOrColor.id ?? blockId;
      }

      const spec = COLOR_SOUNDS[colorKey] ?? COLOR_SOUNDS.gray;
      const h = hashString(String(blockId));
      const harsh = h % 7 === 0; // deterministic harshness rule

      try {
        playTone(ctx, spec.freqs, {
          wave: spec.wave,
          duration: spec.duration,
          baseGain: spec.baseGain,
          harsh,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("playTone failed", e);
      }
    },
    [ensureCtx]
  );

  return playFn;
};

export default useSnapSound;
