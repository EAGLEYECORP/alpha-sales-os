"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CircleDot, Clock, EyeOff, Hand, Radio, RefreshCw } from "lucide-react";
import type { EtatMoniteur } from "@/lib/moniteur";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MONITEUR — pensé pour un pouce, pas pour un bureau.
 *
 * Trois questions, dans cet ordre, parce que c'est l'ordre dans lequel on se
 * les pose en sortant d'un rendez-vous :
 *
 *   1. Est-ce que ça tourne ?      → l'état, en une phrase
 *   2. Qu'est-ce qui est sorti ?   → quatre compteurs
 *   3. Qui demande une main ?      → la seule liste, et elle est courte
 *
 * ⚠ TOUT VIENT DU SERVEUR. Aucun `useAlpha` ici, et c'est délibéré : le store
 * vit dans le `localStorage` de CE navigateur, l'autopilote tourne sur le
 * serveur. Lire le store afficherait zéro appel pendant que le cron en passe
 * quarante — et personne ne comprendrait pourquoi.
 *
 * ⚠⚠ « Pas mesuré » n'affiche pas zéro. Un `0` se lit comme un résultat ;
 * l'absence de mesure est un angle mort, et il se DIT.
 * ─────────────────────────────────────────────────────────────────────
 */

const TON: Record<EtatMoniteur["autopilote"], { point: string; bord: string; mot: string }> = {
  arme: { point: "text-signal-green", bord: "border-signal-green/40", mot: "Armé" },
  simulation: { point: "text-signal-amber", bord: "border-signal-amber/40", mot: "Simulation" },
  "non-configure": { point: "text-paper-faint", bord: "border-ink-700", mot: "Éteint" },
};

/** « il y a 12 min », sans dépendance et sans mentir sur la précision. */
function depuis(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export default function MoniteurPage() {
  const [etat, setEtat] = useState<EtatMoniteur | null>(null);
  const [chargement, setChargement] = useState(true);
  /** Distinct de « pas de données » : là, on n'a même pas pu demander. */
  const [reseau, setReseau] = useState<string | null>(null);

  const sonder = useCallback(() => {
    setChargement(true);
    fetch("/api/moniteur")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((j: EtatMoniteur) => {
        setEtat(j);
        setReseau(null);
      })
      .catch((e: Error) => setReseau(e.message === "403" ? "brique" : "reseau"))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => {
    sonder();
    /**
     * ⚠ 60 s, et pas 5. Un moniteur qui interroge le serveur en boucle sur un
     * téléphone vide la batterie et n'apprend rien de plus : le cron tourne
     * toutes les 10 minutes. Le bouton reste là pour qui veut savoir tout de
     * suite.
     */
    const t = setInterval(sonder, 60_000);
    return () => clearInterval(t);
  }, [sonder]);

  const ton = etat ? TON[etat.autopilote] : TON["non-configure"];
  const quand = depuis(etat?.derniereActivite ?? null);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ce que la machine a fait"
        title="Moniteur"
        subtitle="Lu sur le serveur, pas dans ce navigateur — c'est là que l'autopilote travaille."
        actions={
          <button className="btn-ghost" onClick={sonder} disabled={chargement} aria-label="Rafraîchir">
            <RefreshCw size={14} className={chargement ? "animate-spin" : undefined} /> Rafraîchir
          </button>
        }
      />

      {reseau && (
        <p className="card flex items-start gap-2 p-4 text-[12.5px] leading-relaxed text-paper-faint">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-signal-amber" />
          {reseau === "brique"
            ? "Cet écran fait partie de la brique Campagnes. Le serveur refuse — c'est voulu, pas une panne."
            : "Le serveur n'a pas répondu. Ce n'est pas « rien ne tourne » : c'est « on ne sait pas »."}
        </p>
      )}

      {etat && (
        <>
          {/* ── 1. EST-CE QUE ÇA TOURNE ? ── */}
          <section className={cn("card border p-4", ton.bord)}>
            <p className="flex flex-wrap items-center gap-2">
              <CircleDot size={16} className={ton.point} />
              <span className="font-display text-base font-bold text-paper">Autopilote · {ton.mot}</span>
              {quand && (
                <span className="flex items-center gap-1 font-mono text-[10.5px] text-paper-faint">
                  <Clock size={11} /> dernier appel {quand}
                </span>
              )}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-paper-dim">{etat.phraseAutopilote}</p>

            {etat.fenetre && !etat.fenetre.ouverte && (
              <p className="mt-2 rounded border border-ink-700 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-paper-faint">
                <strong className="text-paper-dim">Fenêtre fermée.</strong> {etat.fenetre.pourquoi} Une machine
                n&apos;appelle pas hors des heures ouvrées — même armée.
              </p>
            )}
          </section>

          {/* ── L'ANGLE MORT, avant les chiffres : sinon on lit des zéros
                comme un calme, alors qu'ils veulent dire « aveugle ». ── */}
          {etat.angleMort && (
            <section className="card p-4">
              <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-paper-faint">
                <EyeOff size={15} className="mt-0.5 shrink-0" />
                {etat.angleMort}
              </p>
            </section>
          )}

          {/* ── 2. QU'EST-CE QUI EST SORTI ? ── */}
          <section className="grid grid-cols-2 gap-2">
            <Compteur label="Appelés aujourd'hui" valeur={etat.tentativesDuJour} sub="par la machine, pas à la main" />
            <Compteur label="Sans résultat" valeur={etat.sansResultat} sub="composés, retour non consigné" />
            <Compteur label="Ont répondu" valeur={etat.ontRepondu} sub="décrochés, tous résultats" />
            <Compteur
              label="En file"
              valeur={etat.fileAttente}
              sub={
                etat.plafondPalier === null
                  ? "plus de bornage par palier"
                  : `palier ${etat.plafondPalier}${etat.composesTotal !== null ? ` · ${etat.composesTotal} composés` : ""}`
              }
            />
          </section>

          {/* ── 3. QUI DEMANDE UNE MAIN ? ── */}
          <section className="card p-4">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
              <Hand size={15} className="text-bronze-400" /> Demandent une main
              {etat.demandentUneMain.length > 0 && (
                <span className="font-mono text-[11px] font-normal text-bronze-400">
                  {etat.demandentUneMain.length}
                </span>
              )}
            </h2>

            {etat.demandentUneMain.length === 0 ? (
              <p className="mt-2 text-[12px] leading-relaxed text-paper-faint">
                Personne pour l&apos;instant.{" "}
                <strong className="text-paper-dim">
                  Un « non » ou un « rappelez-moi » ne réveille personne
                </strong>{" "}
                — seul un intérêt qualifié remonte ici. C&apos;est ce qui rend le volume tenable.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {etat.demandentUneMain.map((f) => (
                  <li key={f.id}>
                    {/* ⚠ Aucun numéro à l'écran : la fiche s'ouvre derrière le
                        contrôle d'accès habituel, et c'est là qu'on appelle. */}
                    <Link
                      href={`/prospects/${f.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-bronze-400/40 px-3 py-2.5 active:bg-bronze-400/10"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-paper">{f.company}</span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-paper-faint">{f.resume}</span>
                        <span className="mt-0.5 block font-mono text-[10px] text-paper-faint">{depuis(f.quand)}</span>
                      </span>
                      <ArrowRight size={15} className="mt-0.5 shrink-0 text-bronze-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-paper-faint">
            <Radio size={12} className="mt-0.5 shrink-0" />
            Lecture seule, rafraîchie chaque minute. Cet écran ne déclenche rien : il regarde. Ce que fait la
            machine se décide dans les paliers, et un palier ne se valide jamais tout seul.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Un compteur. `null` n'affiche PAS zéro — il affiche un tiret.
 *
 * ⚠ C'est la règle « zéro donnée → zéro chiffre » rendue visible. Un `0` se
 * lit comme un résultat calme ; un tiret se lit comme une question.
 */
function Compteur({ label, valeur, sub }: { label: string; valeur: number | null; sub: string }) {
  return (
    <div className="card p-3">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper-faint">{label}</p>
      <p className={cn("font-display text-2xl font-bold", valeur === null ? "text-paper-faint" : "text-bronze-400")}>
        {valeur === null ? "—" : valeur}
      </p>
      <p className="text-[10.5px] leading-snug text-paper-faint">{valeur === null ? "non mesuré" : sub}</p>
    </div>
  );
}
