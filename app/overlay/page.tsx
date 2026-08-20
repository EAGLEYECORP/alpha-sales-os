"use client";

import { useEffect, useState } from "react";
import { GripVertical } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { LiveCopilot } from "@/components/live/alpha-live";

/**
 * Route dédiée à l'overlay transparent desktop (Electron — voir desktop/).
 * Fond transparent : c'est la fenêtre Electron (transparent + frameless +
 * always-on-top + click-through) qui donne le vrai effet « Cluely » par-dessus
 * n'importe quelle app. La barre du haut est la zone de déplacement (drag).
 */
export default function OverlayPage() {
  const prospects = useAlpha((s) => s.prospects);
  const [id, setId] = useState<string>("");

  // Rendre html/body réellement transparents (ils portent le fond du thème).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevH = html.style.background;
    const prevB = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";
    return () => { html.style.background = prevH; body.style.background = prevB; };
  }, []);

  const prospect = prospects.find((p) => p.id === id);

  return (
    <div className="min-h-screen w-full p-2">
      <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-ink-950/80 shadow-2xl backdrop-blur-xl">
        {/* Barre de déplacement (Electron : -webkit-app-region: drag) */}
        <div
          className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <span className="flex items-center gap-1.5 text-[11px] text-paper-faint"><GripVertical size={12} /> déplacer</span>
          <select
            className="input py-1 text-[11px]"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="">— prospect —</option>
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>{p.company}</option>
            ))}
          </select>
        </div>
        <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <LiveCopilot prospect={prospect} />
        </div>
      </div>
    </div>
  );
}
