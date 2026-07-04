"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Kanban, List, Plus, Search, Trash2 } from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { Prospect, Sector, Stage } from "@/lib/types";
import { STAGES, weightedValue } from "@/lib/hormozi";
import { cn, dateFr, eur } from "@/lib/utils";
import { KanbanBoard } from "@/components/pipeline/kanban";
import { ProspectFormModal } from "@/components/pipeline/prospect-form";
import { StageBadge } from "@/components/ui/stage-badge";

const col = createColumnHelper<Prospect>();

export default function PipelinePage() {
  const { prospects, deleteProspect } = useAlpha();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<Sector | "tous">("tous");
  const [stage, setStage] = useState<Stage | "tous">("tous");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([]);

  const filtered = useMemo(
    () =>
      prospects.filter(
        (p) =>
          (sector === "tous" || p.sector === sector) &&
          (stage === "tous" || p.stage === stage) &&
          (query === "" ||
            `${p.company} ${p.name} ${p.city} ${p.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
      ),
    [prospects, sector, stage, query]
  );

  const totalPipe = filtered.reduce((s, p) => s + weightedValue(p), 0);

  const columns = useMemo(
    () => [
      col.display({
        id: "sel",
        header: "",
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="accent-bronze-500"
            checked={selected.has(row.original.id)}
            onChange={(e) =>
              setSelected((s) => {
                const n = new Set(s);
                e.target.checked ? n.add(row.original.id) : n.delete(row.original.id);
                return n;
              })
            }
          />
        ),
      }),
      col.accessor("company", {
        header: "Commerce",
        cell: (info) => (
          <Link href={`/prospects/${info.row.original.id}`} className="font-medium text-paper hover:text-bronze-300">
            {info.getValue()}
            <span className="block text-[11px] font-normal text-paper-faint">
              {info.row.original.name} · {info.row.original.city}
            </span>
          </Link>
        ),
      }),
      col.accessor("sector", { header: "Secteur", cell: (i) => <span className="capitalize text-paper-dim">{i.getValue()}</span> }),
      col.accessor("stage", { header: "Étape", cell: (i) => <StageBadge stage={i.getValue()} /> }),
      col.accessor("trust", { header: "Confiance", cell: (i) => <Bar value={i.getValue()} /> }),
      col.accessor("probability", { header: "Prob.", cell: (i) => <span className="font-mono">{i.getValue()} %</span> }),
      col.accessor((r) => weightedValue(r), {
        id: "weighted",
        header: "Pondéré",
        cell: (i) => <span className="font-mono text-bronze-400">{eur(i.getValue())}</span>,
      }),
      col.accessor((r) => r.nextStep?.date ?? "", {
        id: "next",
        header: "Next step",
        cell: (i) =>
          i.row.original.nextStep ? (
            <span className="text-paper-dim">
              {dateFr(i.row.original.nextStep.date)} — {i.row.original.nextStep.action.slice(0, 40)}
            </span>
          ) : (
            <span className="text-signal-red">manquant ⚠</span>
          ),
      }),
    ],
    [selected]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const bulkDelete = () => {
    if (!confirm(`Supprimer ${selected.size} prospect(s) ?`)) return;
    selected.forEach((id) => deleteProspect(id));
    setSelected(new Set());
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper">Pipeline</h1>
          <p className="text-sm text-paper-faint">
            {filtered.length} prospect(s) · pipe pondéré <span className="font-mono text-bronze-400">{eur(totalPipe)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-ink-600 p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={cn("rounded-md px-2.5 py-1.5", view === "kanban" ? "bg-bronze-900/80 text-bronze-300" : "text-paper-faint")}
              title="Vue Kanban"
            >
              <Kanban size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn("rounded-md px-2.5 py-1.5", view === "list" ? "bg-bronze-900/80 text-bronze-300" : "text-paper-faint")}
              title="Vue liste"
            >
              <List size={16} />
            </button>
          </div>
          <button className="btn-bronze" onClick={() => setAdding(true)}>
            <Plus size={15} /> Prospect
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-paper-faint" />
          <input
            className="input w-56 pl-8"
            placeholder="Rechercher…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={sector} onChange={(e) => setSector(e.target.value as Sector | "tous")}>
          <option value="tous">Tous secteurs</option>
          <option value="restaurant">Restaurants</option>
          <option value="pub">Pubs</option>
          <option value="ambulance">Ambulances</option>
          <option value="artisan">Artisans</option>
        </select>
        {view === "list" && (
          <select className="input w-auto" value={stage} onChange={(e) => setStage(e.target.value as Stage | "tous")}>
            <option value="tous">Toutes étapes</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        )}
        {selected.size > 0 && (
          <button className="btn-danger" onClick={bulkDelete}>
            <Trash2 size={14} /> Supprimer ({selected.size})
          </button>
        )}
      </div>

      {view === "kanban" ? (
        <KanbanBoard prospects={filtered} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-ink-700 text-left">
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="cursor-pointer select-none px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-paper-faint"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getCanSort() && h.id !== "sel" && <ArrowUpDown size={11} />}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-ink-800 hover:bg-ink-850/60">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProspectFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-700">
        <span className="block h-full rounded-full bg-bronze-500" style={{ width: `${value}%` }} />
      </span>
      <span className="font-mono text-[11px] text-paper-faint">{value}</span>
    </span>
  );
}
