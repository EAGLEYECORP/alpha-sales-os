"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const TONE_COLORS = {
  bronze: "#E8C98A",
  green: "#86C06A",
  red: "#E5564E",
  dim: "#8E877B",
} as const;

/** heat coloring à la Closer OS : ≥80 green, ≥65 amber, sinon red */
const heatColor = (h: number) => (h >= 80 ? "#86C06A" : h >= 65 ? "#E0AC46" : "#E5564E");

export function ProgressRing({
  value,
  max = 100,
  size = 44,
  stroke = 3,
  label,
  className,
  tone = "bronze",
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
  tone?: "bronze" | "green" | "red" | "dim" | "heat";
}) {
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const color = tone === "heat" ? heatColor((value / max) * 100) : TONE_COLORS[tone];

  // animate from empty on mount, Closer-OS style
  const [offset, setOffset] = useState(c);
  useEffect(() => {
    const t = setTimeout(() => setOffset(c * (1 - pct)), 60);
    return () => clearTimeout(t);
  }, [c, pct]);

  return (
    <div className={cn("relative inline-flex flex-col items-center gap-1", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="rgba(243,238,228,0.12)" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)",
            filter: `drop-shadow(0 0 5px ${color}66)`,
          }}
        />
      </svg>
      <span
        className="absolute font-display text-[11px] font-extrabold text-paper"
        style={{ top: size / 2 - 8 }}
      >
        {Math.round(value)}
      </span>
      {label && (
        <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-paper-faint">{label}</span>
      )}
    </div>
  );
}
