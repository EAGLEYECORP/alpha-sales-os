"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ThumbsDown, ThumbsUp } from "lucide-react";

/**
 * Remplace les prompt() natifs pour « pourquoi OUI / pourquoi NON ».
 * z-[150] : doit passer AU-DESSUS du Mode Closing (z-120).
 */
export function ReasonDialog({
  open,
  kind,
  company,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  kind: "won" | "lost";
  company: string;
  onSubmit: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const won = kind === "won";
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end justify-center p-4 md:items-center">
      <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm" onClick={onCancel} />
      <div className="card relative w-full max-w-md p-5 animate-fade-up">
        <p className={`flex items-center gap-2 font-display text-lg font-extrabold ${won ? "text-signal-green" : "text-signal-red"}`}>
          {won ? <ThumbsUp size={18} /> : <ThumbsDown size={18} />}
          {won ? "Pourquoi OUI ?" : "Pourquoi NON ?"}
        </p>
        <p className="mt-1 text-sm text-paper-dim">
          {won
            ? `Qu'est-ce qui a fait basculer ${company} ? Cette raison alimente les KPIs et tes prochains scripts.`
            : `Qu'est-ce qui a bloqué avec ${company} ? La doctrine exige une raison documentée — c'est le carburant de la reconquête.`}
        </p>
        <textarea
          autoFocus
          className="input mt-3 min-h-20"
          placeholder={won ? "Ex : la garantie résultat + la preuve du confrère de Caluire…" : "Ex : parti chez un low-cost — prix annoncé avant la démo…"}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(reason.trim() || undefined);
          }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => onSubmit(undefined)}>
            Passer
          </button>
          <button className="btn-bronze" onClick={() => onSubmit(reason.trim() || undefined)}>
            {won ? "Signé ✓" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
