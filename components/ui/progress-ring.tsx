"use client";

import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  max = 100,
  size = 44,
  stroke = 4,
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
  tone?: "bronze" | "green" | "red" | "dim";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const colors = {
    bronze: "stroke-bronze-500",
    green: "stroke-signal-green",
    red: "stroke-signal-red",
    dim: "stroke-paper-faint",
  };
  return (
    <div className={cn("relative inline-flex flex-col items-center gap-1", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ink-700" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn("transition-all duration-500", colors[tone])}
        />
      </svg>
      <span
        className="absolute font-mono text-[11px] text-paper"
        style={{ top: size / 2 - 8 }}
      >
        {Math.round(value)}
      </span>
      {label && <span className="text-[9px] uppercase tracking-wider text-paper-faint">{label}</span>}
    </div>
  );
}
