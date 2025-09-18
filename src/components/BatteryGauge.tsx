// src/components/BatteryGauge.tsx
import { useEffect, useState } from 'react';
import { useId } from 'react';
import bluetoothService from '../utils/bluetoothService';

interface Props {
  percentage?: number | null;
  size?: number;
  strokeWidth?: number;
  showPercent?: boolean;
  className?: string;
}

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export default function BatteryGauge({
  percentage,
  size = 48,
  strokeWidth = 2,
  showPercent = true,
  className = '',
}: Props) {
  const id = useId();
  const clipId = `clip-${id}`;
  const waveId = `wave-${id}`;

  // Battery usage state
  const [btPct, setBtPct] = useState<number | null>(null);

  useEffect(() => {
    if (percentage != null) {
      (async () => {
        try {
          await bluetoothService.stopDataListener();
        } catch { /* ignore */ }
        try {
          await bluetoothService.stopDisconnectListener();
        } catch { /* ignore */ }
      })();
      return;
    }

    let mounted = true;
    const BATTERY_RE = /bat\s*\(\s*(\d{1,3})\s*\)/i;

    (async () => {
      try {
        await bluetoothService.initialize();
      } catch (e) {
        console.warn('[BatteryGauge] bluetooth initialize failed', e);
      }

      try {
        await bluetoothService.startDataListener((raw) => {
          if (!mounted) return;
          if (!raw) return;
          const trimmed = String(raw).trim();
          const m = BATTERY_RE.exec(trimmed);
          if (!m) return;
          const parsed = Number.parseInt(m[1], 10);
          if (Number.isNaN(parsed)) return;
          const clamped = Math.max(0, Math.min(100, parsed));
          setBtPct((prev) => (prev === clamped ? prev : clamped));
        });
      } catch (e) {
        console.warn('[BatteryGauge] startDataListener failed', e);
      }

      try {
        await bluetoothService.startDisconnectListener(() => {
          if (!mounted) return;
          setBtPct(null);
        });
      } catch (e) {
        console.warn('[BatteryGauge] startDisconnectListener failed', e);
      }
    })();

    return () => {
      mounted = false;
      (async () => {
        try {
          await bluetoothService.stopDataListener();
        } catch { /* ignore */ }
        try {
          await bluetoothService.stopDisconnectListener();
        } catch { /* ignore */ }
      })();
    };
  }, [percentage]);

  // Decide which percentage to display:
  // - explicit `percentage` prop (if not null)
  // - else bluetooth-derived `btPct`
  const displayPctNumber =
    percentage != null
      ? clamp(Math.round(percentage))
      : btPct != null
      ? clamp(Math.round(btPct))
      : null;

  const pctForFill = displayPctNumber ?? 0;

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  const fillHeight = (pctForFill / 100) * radius * 2;
  const fillTopY = center + radius - fillHeight;
  const topOfCircle = center - radius;
  const waveTranslateY = fillTopY - topOfCircle;

  const green = '#34d399';

  const displayIsNumber = typeof displayPctNumber === 'number' && !Number.isNaN(displayPctNumber);
  const displayText = displayIsNumber ? `${displayPctNumber}%` : 'Load';

  const textColorClass =
    displayIsNumber && displayPctNumber < 20
      ? 'text-red-500'
      : 'text-neutral-900 dark:text-white';

  return (
    <div
      className={`inline-block relative ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={displayIsNumber ? `Battery ${displayPctNumber}%` : 'Battery unknown'}
    >
      <style>{`
        .wg1-${id} { animation: waveX1-${id} 2800ms linear infinite; }
        .wg2-${id} { animation: waveX2-${id} 4200ms linear infinite reverse; opacity:0.85; }

        @keyframes waveX1-${id} { from { transform: translateX(0) } to { transform: translateX(-${size * 0.45}px) } }
        @keyframes waveX2-${id} { from { transform: translateX(0) } to { transform: translateX(-${size * 0.28}px) } }

        .wave-container-${id} { transition: transform 520ms cubic-bezier(.2,.9,.2,1); will-change: transform; }
        .fill-rect-${id} { transition: height 520ms cubic-bezier(.2,.9,.2,1), y 520ms cubic-bezier(.2,.9,.2,1); }
        .pct-${id} { transition: color 180ms; font-weight:600; -webkit-font-smoothing:antialiased; }
      `}</style>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="presentation">
        <defs>
          <clipPath id={clipId}>
            <circle cx={center} cy={center} r={radius} />
          </clipPath>

          <path
            id={waveId}
            d={`
              M 0 ${size * 0.58}
              C ${size * 0.18} ${size * 0.52}, ${size * 0.32} ${size * 0.64}, ${size * 0.5} ${size * 0.58}
              C ${size * 0.68} ${size * 0.52}, ${size * 0.82} ${size * 0.64}, ${size} ${size * 0.58}
              L ${size} ${size} L 0 ${size} Z
            `}
            fill={green}
          />
        </defs>

        {/* outer ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          className="stroke-neutral-400 dark:stroke-white/10"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* clipped fill */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            className={`fill-rect-${id}`}
            x={center - radius}
            y={fillTopY}
            width={radius * 2}
            height={fillHeight}
            fill={green}
            opacity={0.92}
          />

          <g
            className={`wave-container-${id}`}
            style={{ transform: `translateY(${waveTranslateY}px)` }}
          >
            <g className={`wg1-${id}`} style={{ transform: `translateX(0)` }}>
              <use href={`#${waveId}`} x={-size * 0.55} />
              <use href={`#${waveId}`} x={-size * 0.05} />
              <use href={`#${waveId}`} x={size * 0.45} />
            </g>

            <g className={`wg2-${id}`} style={{ transform: `translateX(0)`, opacity: 0.95 }}>
              <use href={`#${waveId}`} x={-size * 0.35} y={2} />
              <use href={`#${waveId}`} x={size * 0.15} y={2} />
              <use href={`#${waveId}`} x={size * 0.65} y={2} />
            </g>
          </g>
        </g>

        {/* inner glossy overlay */}
        <circle
          cx={center}
          cy={center}
          r={radius - strokeWidth * 1.05}
          className="fill-white/5 dark:fill-white/5 stroke-white/5 dark:stroke-white/5"
          strokeWidth={0.4}
        />
      </svg>

      {/* percentage text */}
      <div
        className={`pct-${id} absolute inset-0 flex items-center justify-center pointer-events-none font-bold`}
        style={{
          fontSize: Math.max(13, size * 0.26),
          lineHeight: 1,
        }}
      >
        {showPercent ? (
          <span className={displayIsNumber ? textColorClass : 'text-neutral-500 dark:text-white/60'}>
            {displayText}
          </span>
        ) : null}
      </div>
    </div>
  );
}
