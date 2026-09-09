"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Handshake, ShieldAlert } from "lucide-react";
import { OFFRES } from "@/lib/offres-publiques";
import {
  MOIS_COMMISSIONNES,
  TAUX_MENSUEL,
  TAUX_SETUP,
  commissionPour,
  messageVersement,
  siretBienForme,
} from "@/lib/apporteur";
import { REV_SHARE } from "@/lib/pricing";
import { eur } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'UN APPORT RAPPORTE — la grille, enfin visible.
 *
 * ⚠ POURQUOI CE COMPOSANT EXISTE : `lib/apporteur.ts` ÉTAIT MORT.
 *
 * Le module était écrit, commenté, testé — et `grep` ne trouvait aucun
 * importeur hors de ses propres tests. Un modèle de commission que personne ne
 * peut lire ne se pitche pas : on retombe sur « je te donnerai un truc », qui
 * est exactement la promesse floue que la doctrine interdit ailleurs.
 *
 * C'est LE défaut récurrent du dépôt, sur le module qui porte une décision
 * commerciale reconfirmée le jour même.
 *
 * ══ CE QUE CE COMPOSANT NE FAIT PAS, ET IL FAUT LE DIRE ══
 *
 * Il affiche la GRILLE. Il ne suit aucun apport réel : il n'existe encore ni
 * code de parrainage, ni attribution à l'inscription, ni rattachement d'une
 * vente à celui qui l'a amenée. Tant que ça n'existe pas, on peut annoncer un
 * taux, pas un solde.
 *
 * Afficher un solde inventé serait pire que de ne rien afficher : ça se
 * casserait devant quelqu'un qui a déjà fait le travail.
 * ─────────────────────────────────────────────────────────────────────
 */
export function GrilleApporteur() {
  const [siret, setSiret] = useState("");
  const [contrat, setContrat] = useState(false);

  const lignes = useMemo(
    () => OFFRES.map((o) => ({ offre: o, commission: commissionPour(o) })),
    []
  );

  const bienForme = siretBienForme(siret);
  const message = messageVersement({ id: "moi", siret: siret.trim() || null, contratSigne: contrat });

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Handshake size={15} className="text-bronze-400" /> Ce qu&apos;un apport rapporte
        </h2>
        <span className="font-mono text-[10.5px] text-paper-faint">
          {Math.round(TAUX_SETUP * 100)} % du setup · {Math.round(TAUX_MENSUEL * 100)} % du mensuel ×{" "}
          {MOIS_COMMISSIONNES} mois
        </span>
      </div>

      <p className="mt-1.5 text-[11.5px] leading-relaxed text-paper-faint">
        {/* ⚠ Les deux « 30 % » du dépôt vont dans des sens opposés. Le rappeler
            ici est ce qui empêche de facturer un client au taux qu'on paie à
            un apporteur, ou l'inverse. */}
        <strong className="text-paper-dim">Ce que NOUS payons</strong> à qui nous amène un client — l&apos;inverse des
        {Math.round(REV_SHARE * 100)} % que nous <em>facturons</em> sur le CA généré (<code className="font-mono">REV_SHARE</code>).
        Les {MOIS_COMMISSIONNES} mois ne sont pas une radinerie : une commission qui court un an donne à
        l&apos;apporteur un intérêt direct à ce que le client <strong className="text-paper-dim">reste</strong>.
      </p>

      <ul className="mt-3 space-y-1.5">
        {lignes.map(({ offre, commission }) => (
          <li
            key={offre.id}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-ink-700 px-3 py-2"
          >
            <span className="text-[12.5px] font-medium text-paper">{offre.nom}</span>
            <span
              className={cn(
                "font-display text-base font-bold",
                offre.cadence === "devis" ? "text-paper-faint" : "text-bronze-400"
              )}
            >
              {offre.cadence === "devis" ? "au cadrage" : eur(commission.totalEur)}
            </span>
            <span className="w-full text-[11px] leading-relaxed text-paper-faint">{commission.phrase}</span>
          </li>
        ))}
      </ul>

      {/* ── LA CONDITION QUI N'EST PAS TECHNIQUE ── */}
      <div className="mt-4 rounded-lg border border-ink-700 px-3 py-2.5">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">
          <ShieldAlert size={13} className="text-signal-amber" /> Avant de verser quoi que ce soit
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            placeholder="SIRET (14 chiffres)"
            inputMode="numeric"
            aria-label="SIRET de l'apporteur"
            className={cn(
              "min-w-0 flex-1 rounded border bg-transparent px-2.5 py-1.5 font-mono text-[12px] text-paper placeholder:text-paper-faint",
              siret.trim() === "" ? "border-ink-600" : bienForme ? "border-signal-green/50" : "border-signal-red/50"
            )}
          />
          <label className="flex items-center gap-1.5 text-[11.5px] text-paper-dim">
            <input type="checkbox" checked={contrat} onChange={(e) => setContrat(e.target.checked)} />
            contrat signé
          </label>
        </div>

        {/* ⚠ La forme, et rien de plus : un SIRET bien formé peut être inventé,
            radié, ou appartenir à quelqu'un d'autre. Le dire évite de prendre
            un voyant vert pour une vérification. */}
        {siret.trim() !== "" && !bienForme && (
          <p className="mt-1.5 text-[11px] text-signal-red">
            Forme invalide (14 chiffres, clé de Luhn). Ce contrôle attrape les fautes de frappe — il ne prouve pas que
            l&apos;entreprise existe.
          </p>
        )}

        <p className="mt-2 text-[11.5px] leading-relaxed text-paper-dim">{message}</p>
      </div>

      {/* ── CE QUI MANQUE, DIT EN CLAIR ── */}
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-paper-faint">
        <ChevronRight size={12} className="mt-0.5 shrink-0" />
        <span>
          <strong className="text-paper-dim">Aucun apport réel n&apos;est encore suivi.</strong> Il n&apos;existe ni
          code de parrainage, ni attribution à l&apos;inscription, ni rattachement d&apos;une vente à celui qui l&apos;a
          amenée. Cette grille dit un taux, elle ne dit pas un solde — et afficher un solde inventé se casserait devant
          quelqu&apos;un qui a déjà fait le travail.
        </span>
      </p>
    </section>
  );
}
