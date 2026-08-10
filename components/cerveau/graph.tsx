"use client";

import { useEffect, useRef } from "react";
import { extractLinks, type KnowledgeNote } from "@/lib/knowledge";

/**
 * Vue graphe du Cerveau — la carte des notes reliées par [[wikilinks]] (façon
 * Obsidian). Mise en page force-directed en canvas (zéro dépendance). Clique un
 * nœud pour l'ouvrir. Respecte prefers-reduced-motion (layout figé après calcul).
 */
export function KnowledgeGraph({
  notes,
  selectedId,
  onOpen,
}: {
  notes: KnowledgeNote[];
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Graphe : nœuds = notes, arêtes = wikilinks résolus par titre.
    const byTitle = new Map(notes.map((n) => [n.title.trim().toLowerCase(), n.id]));
    type N = { id: string; title: string; x: number; y: number; vx: number; vy: number; deg: number };
    type E = { a: string; b: string };
    const edges: E[] = [];
    const deg = new Map<string, number>();
    for (const n of notes) {
      for (const l of extractLinks(n.body)) {
        const target = byTitle.get(l.trim().toLowerCase());
        if (target && target !== n.id) {
          edges.push({ a: n.id, b: target });
          deg.set(n.id, (deg.get(n.id) ?? 0) + 1);
          deg.set(target, (deg.get(target) ?? 0) + 1);
        }
      }
    }

    let w = 0;
    let h = 0;
    let nodes: N[] = [];
    const idIndex = new Map<string, N>();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    nodes = notes.map((n, i) => {
      const a = (i / Math.max(1, notes.length)) * Math.PI * 2;
      const node: N = {
        id: n.id,
        title: n.title,
        x: w / 2 + Math.cos(a) * Math.min(w, h) * 0.3,
        y: h / 2 + Math.sin(a) * Math.min(w, h) * 0.3,
        vx: 0,
        vy: 0,
        deg: deg.get(n.id) ?? 0,
      };
      idIndex.set(n.id, node);
      return node;
    });

    const REST = 70;
    const tick = () => {
      // Répulsion (O(n²), n petit).
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { dx = Math.random(); dy = Math.random(); d2 = 1; }
          const f = 1400 / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }
      // Ressorts sur les arêtes.
      for (const e of edges) {
        const a = idIndex.get(e.a);
        const b = idIndex.get(e.b);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = (d - REST) * 0.02;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // Gravité vers le centre + intégration amortie.
      for (const n of nodes) {
        n.vx += (w / 2 - n.x) * 0.002;
        n.vy += (h / 2 - n.y) * 0.002;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += Math.max(-6, Math.min(6, n.vx));
        n.y += Math.max(-6, Math.min(6, n.vy));
        n.x = Math.max(16, Math.min(w - 16, n.x));
        n.y = Math.max(16, Math.min(h - 16, n.y));
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // Arêtes
      ctx.lineWidth = 1;
      for (const e of edges) {
        const a = idIndex.get(e.a);
        const b = idIndex.get(e.b);
        if (!a || !b) continue;
        ctx.strokeStyle = "rgba(210, 128, 74, 0.35)";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // Nœuds + labels
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      for (const n of nodes) {
        const r = 4 + Math.min(6, n.deg * 1.4);
        const sel = n.id === selectedId;
        ctx.fillStyle = sel ? "rgba(210, 64, 47, 0.95)" : "rgba(210, 128, 74, 0.9)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (sel) {
          ctx.strokeStyle = "rgba(210, 64, 47, 0.4)";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = sel ? "rgba(244, 242, 237, 0.95)" : "rgba(244, 242, 237, 0.6)";
        const label = n.title.length > 22 ? n.title.slice(0, 21) + "…" : n.title;
        ctx.fillText(label, n.x + r + 4, n.y + 3);
      }
    };

    let raf = 0;
    let frames = 0;
    const loop = () => {
      tick();
      draw();
      frames += 1;
      // Après stabilisation, on lève le pied (redémarre au besoin via resize/hover).
      if (frames < 600) raf = requestAnimationFrame(loop);
    };
    if (reduce) {
      for (let i = 0; i < 250; i++) tick();
      draw();
    } else {
      raf = requestAnimationFrame(loop);
    }

    const hit = (mx: number, my: number): N | null => {
      let best: N | null = null;
      let bd = 22 * 22;
      for (const n of nodes) {
        const d2 = (n.x - mx) ** 2 + (n.y - my) ** 2;
        if (d2 < bd) { bd = d2; best = n; }
      }
      return best;
    };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const n = hit(e.clientX - rect.left, e.clientY - rect.top);
      if (n) onOpen(n.id);
    };
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      canvas.style.cursor = hit(e.clientX - rect.left, e.clientY - rect.top) ? "pointer" : "default";
      // Toute interaction relance l'animation si elle s'était arrêtée.
      if (!reduce && frames >= 600) { frames = 0; raf = requestAnimationFrame(loop); }
    };
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, [notes, selectedId, onOpen]);

  return <canvas ref={ref} className="h-[62vh] w-full rounded-xl border border-ink-700 bg-ink-950/40" />;
}
