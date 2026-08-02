"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Activity, BarChart3, Bot, CalendarDays, CornerDownLeft, Gauge, Kanban, Mail,
  Gem, Navigation, PhoneCall, ScrollText, Search, Settings, Sprout, Swords, User,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { StageBadge } from "@/components/ui/stage-badge";
import { cn } from "@/lib/utils";

const PAGES = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/closer", label: "Closer OS", icon: Navigation },
  { href: "/appels", label: "Session d'appels", icon: PhoneCall },
  { href: "/agent", label: "Agent ALPHA", icon: Bot },
  { href: "/templates", label: "Templates", icon: ScrollText },
  { href: "/campaigns", label: "Campagnes", icon: Mail },
  { href: "/kpis", label: "KPIs", icon: Gauge },
  { href: "/preuves", label: "Preuves", icon: Gem },
  { href: "/meetings", label: "Rendez-vous", icon: CalendarDays },
  { href: "/nurture", label: "Relances", icon: Sprout },
  { href: "/intel", label: "Concurrents", icon: Swords },
  { href: "/activity", label: "Activité", icon: Activity },
  { href: "/settings", label: "Réglages", icon: Settings },
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Recherche globale — Ctrl/Cmd+K partout, bouton dans la sidebar et le
 * header mobile. Prospects + pages, navigation au clavier.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const prospects = useAlpha((s) => s.prospects);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const items = useMemo(() => {
    const q = norm(query.trim());
    const matchedProspects = prospects
      .filter((p) => !q || norm(`${p.company} ${p.name} ${p.city} ${p.sector}`).includes(q))
      .slice(0, 7)
      .map((p) => ({
        key: `p-${p.id}`,
        href: `/prospects/${p.id}`,
        label: p.company,
        sub: `${p.name}${p.city ? ` · ${p.city}` : ""}`,
        prospect: p,
      }));
    const matchedPages = PAGES.filter((pg) => !q || norm(pg.label).includes(q)).map((pg) => ({
      key: `page-${pg.href}`,
      href: pg.href,
      label: pg.label,
      sub: "page",
      icon: pg.icon,
    }));
    return [...matchedProspects, ...matchedPages].slice(0, 10);
  }, [query, prospects]);

  useEffect(() => setIndex(0), [items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && items[index]) {
        router.push(items[index].href);
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, items, index, router, onClose]);

  useEffect(() => {
    listRef.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm" onClick={onClose} />
      <div className="card relative w-full max-w-lg overflow-hidden p-0 animate-fade-up">
        <div className="flex items-center gap-2.5 border-b border-ink-700 px-4 py-3">
          <Search size={16} className="text-bronze-400" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[15px] text-paper outline-none placeholder:text-paper-faint"
            placeholder="Chercher un prospect, une page…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="rounded border border-ink-600 px-1.5 py-0.5 font-mono text-[9px] uppercase text-paper-faint">esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.map((item, i) => (
            <button
              key={item.key}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                router.push(item.href);
                onClose();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                i === index ? "bg-bronze-900/60" : "hover:bg-ink-800"
              )}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink-800 text-bronze-400">
                {"prospect" in item ? <User size={14} /> : <item.icon size={14} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-paper">{item.label}</span>
                <span className="block truncate text-[11px] text-paper-faint">{item.sub}</span>
              </span>
              {"prospect" in item && item.prospect && <StageBadge stage={item.prospect.stage} />}
              {i === index && <CornerDownLeft size={13} className="shrink-0 text-paper-faint" />}
            </button>
          ))}
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-paper-faint">Aucun résultat pour « {query} »</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
