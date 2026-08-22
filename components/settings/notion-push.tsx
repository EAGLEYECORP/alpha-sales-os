"use client";

import { useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { isDemoProspect } from "@/lib/seed";

/**
 * Envoyer le pipeline vers Notion.
 *
 * Les fiches partent du navigateur : c'est là que vit le store. Le jeton
 * Notion, lui, reste côté serveur — une intégration Notion peut lire et
 * écrire tout ce à quoi elle a accès, ce n'est pas un secret d'affichage.
 *
 * Les fiches de DÉMONSTRATION sont exclues d'office. Les voir apparaître
 * dans l'espace de travail d'une équipe le jour de la mise en route est le
 * genre de détail qui décrédibilise tout le reste.
 */
export function NotionPush() {
  const prospects = useAlpha((s) => s.prospects);
  const [state, setState] = useState<"chargement" | "absent" | "pret">("chargement");
  const [schema, setSchema] = useState<{ name: string; type: string; note?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [rapport, setRapport] = useState<string>("");

  const reels = prospects.filter((p) => !isDemoProspect(p.id));

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/notion/push");
        const d = (await r.json()) as { configured: boolean; schema: typeof schema };
        setSchema(d.schema ?? []);
        setState(d.configured ? "pret" : "absent");
      } catch {
        setState("absent");
      }
    })();
  }, []);

  const envoyer = async () => {
    setBusy(true);
    setRapport("");
    try {
      // Notion limite le débit : on envoie par paquets, et on rend compte de
      // ce qui est passé même si un paquet échoue.
      let created = 0;
      let updated = 0;
      const echecs: string[] = [];
      for (let i = 0; i < reels.length; i += 50) {
        const lot = reels.slice(i, i + 50);
        const res = await fetch("/api/notion/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prospects: lot }),
        });
        const d = (await res.json()) as {
          created?: number;
          updated?: number;
          failed?: { company: string; error: string }[];
          error?: string;
        };
        if (d.error) {
          echecs.push(d.error);
          break;
        }
        created += d.created ?? 0;
        updated += d.updated ?? 0;
        for (const f of d.failed ?? []) echecs.push(`${f.company} : ${f.error}`);
      }

      setRapport(
        [
          `${created} créée(s), ${updated} mise(s) à jour.`,
          echecs.length ? `${echecs.length} échec(s) — ${echecs.slice(0, 3).join(" · ")}` : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
    } catch (e) {
      setRapport(e instanceof Error ? e.message : "Échec réseau.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
        <Upload size={15} className="text-bronze-400" /> Envoyer le pipeline vers Notion
      </h2>
      <p className="mt-1 text-[11px] text-paper-faint">
        Sens unique : ALPHA écrit, Notion lit. Ni les notes libres ni les transcriptions ne partent — elles
        contiennent ce que des gens ont dit au téléphone.
      </p>

      {state === "chargement" && <p className="mt-3 text-[12px] text-paper-faint">Vérification…</p>}

      {state === "absent" && (
        <p className="mt-3 text-[12px] text-signal-amber">
          <code className="font-mono">NOTION_TOKEN</code> et <code className="font-mono">NOTION_DATABASE_ID</code> ne
          sont pas configurés côté serveur. Voir <code className="font-mono">docs/NOTION.md</code>.
        </p>
      )}

      {state === "pret" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={envoyer} disabled={busy || reels.length === 0} className="btn-ghost px-3 py-1.5 text-[12px] disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : `Envoyer ${reels.length} fiche(s)`}
          </button>
          {prospects.length !== reels.length && (
            <span className="text-[11px] text-paper-faint">
              {prospects.length - reels.length} fiche(s) de démonstration exclue(s)
            </span>
          )}
        </div>
      )}

      {rapport && <p className="mt-2 text-[12px] text-paper">{rapport}</p>}

      {schema.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] text-paper-faint hover:text-paper">
            Colonnes que la base Notion doit avoir
          </summary>
          {/* Notion REFUSE une propriété inconnue au lieu de l'ignorer : une
              colonne manquante fait échouer tout l'envoi, avec un message
              d'erreur qui ne dit pas laquelle. */}
          <ul className="mt-2 space-y-0.5 text-[11.5px] text-paper-dim">
            {schema.map((c) => (
              <li key={c.name}>
                <span className="text-paper">{c.name}</span> — {c.type}
                {c.note && <span className="text-paper-faint"> ({c.note})</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
