"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative card w-full max-h-[90vh] overflow-y-auto p-5 md:p-6 animate-fade-up rounded-b-none md:rounded-b-xl",
          wide ? "md:max-w-3xl" : "md:max-w-lg"
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-paper">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-paper-faint hover:bg-ink-700 hover:text-paper">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
