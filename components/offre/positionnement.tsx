"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Gauge, Scale, TrendingDown } from "lucide-react";
import { cn, eur } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * NOTRE PRIX EST-IL DÉFENDABLE ? — la réponse, enfin lisible.
 *
 * ⚠ TROIS MODULES ÉTAIENT MORTS, ET ILS AVAIENT ÉTÉ ÉCRITS L'UN POUR L'AUTRE.
 *
 * `lib/marche.ts` relevait les prix des concurrents et savait déjà comparer
 * (`comparer()`), mais rien ne lui disait quelle offre confronter à quel
 * relevé. `lib/taux-horaire.ts` exportait `TAUX_HORAIRE_EUR` en le décrivant
 * comme « le nombre que le reste du code attend ». `lib/pricing-briques.ts`
 * exigeait ce nombre sans défaut. Aucun des trois n'était importé par autre
 * chose que ses propres tests.
 *
 * ⚠⚠ TOUT VIENT DU SERVEUR, ET CE N'EST PAS UN CHOIX DE CONFORT.
 * `pricing-briques` et `offres-marge` importent `voice-costs` — notre modèle
 * de coût minute par minute. Les importer ici les compilerait dans un chunk
 * `_next/static/**`, téléchargeable SANS COMPTE. Ce dépôt l'a déjà payé une
 * fois avec `cost-panel.tsx`.
 * ─────────────────────────────────────────────────────────────────────
 */

interface Comparaison {
  notreOffre: string;
  notrePrix: number;
  unite: string;
  reference: { acteur: string; basEur: number; hautEur: number; fiabilite: string; source: string; reserve: string };
  ratioHaut: number;
  position: "sous-marche" | "dans-marche" | "au-dessus" | "hors-marche";
  phrase: string;
}

interface Donnees {
  marche: {
    releveLe: string;
    ageJours: number;
    perime: boolean;
    reserve: string;
    offres: { offreId: string; nom: string; comparaison: Comparaison | null; pourquoiPas: string }[];
  };
  taux: {
    horaireEur: number;
    basEur: number;
    hautEur: number;
    tjmEur: number;
    justification: string;
    reserve: string;
    capacite: { bas: { joursFactures: number; caEur: number }; haut: { joursFactures: number; caEur: number } };
  };
  catalogue: {
    verdicts: { brickId: string; label: string; verdict: string; margeMensuellePct: number; phrase: string; reserve: string }[];
    remiseSetupPct: number;
    remiseMensuelPct: number;
    heuresSetupCompletes: number;
    lecture: string[];
    manque: string[];
  };
  marges: { offreId: string; margeMarginalePct: number | null; seuilPerteAppels: number | null; phrase: string }[];
}

const TON_POSITION: Record<Comparaison["position"], string> = {
  "sous-marche": "text-signal-amber",
  "dans-marche": "text-signal-green",
  "au-dessus": "text-bronze-400",
  "hors-marche": "text-signal-red",
};

const TON_VERDICT: Record<string, string> = {
  "sous-facture": "text-signal-red",
  conforme: "text-signal-green",
  "au-dessus": "text-bronze-400",
  "hors-regle": "text-paper-faint",
};

export function Positionnement() {
  const [d, setD] = useState<Donnees | null>(null);
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    fetch("/api/positionnement")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Donnees) => setD(j))
      .catch(() => setEchec(true));
  }, []);

  if (echec) {
    return (
      <section className="card p-4">
        <p className="text-[12px] text-paper-faint">
          Le positionnement n&apos;a pas pu être calculé. Ce n&apos;est pas « notre prix est bon » : c&apos;est
          « on ne sait pas ».
        </p>
      </section>
    );
  }
  if (!d) return null;

  return (
    <div className="space-y-3">
      {/* ── 1. FACE AU MARCHÉ ── */}
      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-paper">
            <Scale size={17} className="text-bronze-400" /> Notre prix face au marché
          </h2>
          <span
            className={cn(
              "flex items-center gap-1 font-mono text-[10.5px]",
              d.marche.perime ? "text-signal-amber" : "text-paper-faint"
            )}
          >
            <Clock size={11} /> relevé il y a {d.marche.ageJours} j
            {d.marche.perime && " — à rouvrir avant de citer"}
          </span>
        </div>

        <ul className="mt-3 space-y-2">
          {d.marche.offres.map((o) => (
            <li key={o.offreId} className="rounded-lg border border-ink-700 px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-medium text-paper">{o.nom}</span>
                {o.comparaison ? (
                  <span className={cn("font-mono text-[10px] uppercase tracking-[0.14em]", TON_POSITION[o.comparaison.position])}>
                    {o.comparaison.position.replace("-", " ")}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-faint">
                    pas comparable
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-paper-dim">
                {o.comparaison ? o.comparaison.phrase : o.pourquoiPas}
              </p>
              {/* ⚠ La réserve du relevé voyage avec le chiffre. Sans elle, une
                  fourchette secondaire se cite comme un tarif opposable. */}
              {o.comparaison && (
                <p className="mt-1 text-[11px] italic leading-relaxed text-paper-faint">
                  {o.comparaison.reference.reserve}
                </p>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-paper-faint">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-signal-amber" />
          {d.marche.reserve}
        </p>
      </section>

      {/* ── 2. CE QUE VAUT UNE HEURE, ET POURQUOI ÇA NE SCALE PAS ── */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-paper">
          <Gauge size={17} className="text-bronze-400" /> Ce que vaut une heure
        </h2>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tuile label="Taux horaire" valeur={`${d.taux.horaireEur} €`} sub={`${d.taux.basEur}–${d.taux.hautEur} €/h`} />
          <Tuile label="TJM retenu" valeur={`${d.taux.tjmEur} €`} sub="par jour facturé" />
          <Tuile
            label="Plafond annuel"
            valeur={eur(d.taux.capacite.haut.caEur)}
            sub={`${d.taux.capacite.bas.joursFactures}–${d.taux.capacite.haut.joursFactures} j facturés`}
          />
        </div>

        <p className="mt-2 text-[11.5px] leading-relaxed text-paper-dim">{d.taux.justification}</p>
        <p className="mt-1.5 text-[11px] italic leading-relaxed text-paper-faint">{d.taux.reserve}</p>

        {/* Le point qui décide de la stratégie entière, et il tient en une
            soustraction : le temps humain a un plafond, le logiciel non. */}
        <p className="mt-2 rounded border border-ink-700 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-paper-dim">
          Même au mieux, vendre du temps plafonne à{" "}
          <strong className="text-bronze-400">{eur(d.taux.capacite.haut.caEur)}</strong> par an. C&apos;est le chiffre
          qui justifie de vendre un produit plutôt que des journées.
        </p>
      </section>

      {/* ── 3. QUELLE BRIQUE SE SOUS-FACTURE ── */}
      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-paper">
            <TrendingDown size={17} className="text-bronze-400" /> Ce que chaque brique coûte vraiment
          </h2>
          <span className="font-mono text-[10.5px] text-paper-faint">
            {d.catalogue.heuresSetupCompletes} h d&apos;installation complète · pack −{d.catalogue.remiseMensuelPct} %
          </span>
        </div>

        <ul className="mt-3 space-y-1.5">
          {d.catalogue.verdicts.map((v) => (
            <li key={v.brickId} className="rounded-lg border border-ink-700 px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-medium text-paper">{v.label}</span>
                <span className={cn("font-mono text-[10px] uppercase tracking-[0.14em]", TON_VERDICT[v.verdict] ?? "")}>
                  {v.verdict.replace("-", " ")} · {v.margeMensuellePct} %
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">{v.phrase}</p>
            </li>
          ))}
        </ul>

        {d.catalogue.lecture.length > 0 && (
          <ul className="mt-3 space-y-1">
            {d.catalogue.lecture.map((l) => (
              <li key={l} className="text-[11.5px] leading-relaxed text-paper-dim">
                {l}
              </li>
            ))}
          </ul>
        )}

        {/* ⚠ Ce qu'on N'A PAS chiffré se dit, séparément et en gris. Un audit
            qui ne montre que ce qu'il sait se lit comme complet. */}
        {d.catalogue.manque.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-ink-700 pt-2">
            {d.catalogue.manque.map((m) => (
              <li key={m} className="text-[11px] leading-relaxed text-paper-faint">
                {m}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 4. LE VOLUME QUI FAIT BASCULER CHAQUE OFFRE EN PERTE ── */}
      <section className="card p-5">
        <h2 className="font-display text-base font-bold text-paper">À partir de quel volume on perd de l&apos;argent</h2>
        <ul className="mt-3 space-y-1.5">
          {d.marges.map((m) => (
            <li key={m.offreId} className="rounded-lg border border-ink-700 px-3 py-2 text-[11.5px] leading-relaxed">
              <span className="text-paper-dim">{m.phrase}</span>
              {m.seuilPerteAppels !== null && (
                <span className="mt-0.5 block font-mono text-[10.5px] text-signal-amber">
                  bascule à {m.seuilPerteAppels} appels
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tuile({ label, valeur, sub }: { label: string; valeur: string; sub: string }) {
  return (
    <div className="panel px-3 py-2">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper-faint">{label}</p>
      <p className="font-display text-xl font-bold text-bronze-400">{valeur}</p>
      <p className="text-[10.5px] text-paper-faint">{sub}</p>
    </div>
  );
}
