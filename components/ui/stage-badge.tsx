"use client";

import type { Stage } from "@/lib/types";
import { stageById } from "@/lib/hormozi";
import { cn } from "@/lib/utils";

const TONES: Record<Stage, string> = {
  prospect: "border-ink-600 text-paper-dim",
  contact: "border-ink-500 text-paper",
  audit: "border-bronze-700 text-bronze-400",
  demo: "border-bronze-600 text-bronze-300",
  offre: "border-bronze-500 text-bronze-300 bg-bronze-900/40",
  redzone: "border-signal-red/60 text-signal-red bg-signal-red/10",
  signe: "border-signal-green/60 text-signal-green bg-signal-green/10",
  perdu: "border-ink-600 text-paper-faint line-through",
};

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return <span className={cn("chip", TONES[stage], className)}>{stageById(stage).label}</span>;
}
