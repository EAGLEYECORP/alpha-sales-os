"use client";

import { useMemo } from "react";
import { Handshake } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { etatPart, PALIERS_PART } from "@/lib/part-resultat";
import { eur } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE L'OFFRE PERFORMANCE AURAIT COÛTÉ — sur SES propres affaires.
 *
 * ⚠⚠ CE N'EST PAS UNE FACTURE, ET L'ÉCRAN DOIT LE DIRE EN PREMIER.
 *
 * Aucun contrat de part au résultat n'est signé aujourd'hui. Afficher « tu
 * nous dois 6 000 € » à quelqu'un qui n'a rien accepté serait faux, et ce
 * serait faux dans le sens qui détruit la confiance — celui où le client
 * découvre une dette qu'il n'a pas contractée.
 *
 * Ce panneau montre une SIMULATION : sur les affaires qu'il a déjà signées en
 * travaillant dans Alpha, voilà ce que le modèle aurait prélevé. C'est
 * l'argument de conversion le plus honnête qui existe — il est calculé sur ses
 * chiffres à lui, pas sur une étude de cas inventée. Le dépôt interdit déjà la
 * preuve sociale fabriquée ; celle-ci n'est pas fabriquée, elle est à lui.
 *
 * ⚠ Il vit sur `/compte`, pas sur `/payouts`. `/payouts` est réservé au
 * MAÎTRE et parle de la commission que l'opérateur prélève sur SES ventes —
 * son économie. Ici on parle de la nôtre, et on la montre à celui qui la
 * paierait. Les deux « parts » n'ont ni la même base, ni le même payeur : les
 * mettre sur le même écran garantissait la confusion.
 * ─────────────────────────────────────────────────────────────────────
 */
export function PartResultatPanel() {
  const prospects = useAlpha((s) => s.prospects);
  const etat = useMemo(() => etatPart(prospects), [prospects]);

  return (
    <section className="card p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-paper">
        <Handshake size={15} className="text-bronze-400" /> L&apos;offre Performance, sur tes affaires
      </p>
      <p className="mt-1 text-[13px] text-paper-dim">
        Alpha est gratuit tant qu&apos;il ne dépense rien chez nous. L&apos;autre façon de travailler
        ensemble : on ne prend rien tant que tu ne signes pas, et une part de ce que tu signes
        ensuite. Voici ce que ça aurait représenté sur les affaires déjà conclues ici.
      </p>

      {/* ⚠ ZÉRO DONNÉE → ZÉRO CHIFFRE. Un « 0 € » se lirait comme un résultat
          (« Alpha ne rapporte rien ») alors que la vérité est « aucune affaire
          signée n'est encore enregistrée ». */}
      {etat.totalEur === null ? (
        <p className="panel mt-3 p-3 text-[12px] text-paper-faint">
          Aucune affaire signée à mesurer pour l&apos;instant. Ce bloc restera vide tant qu&apos;il
          n&apos;y en aura pas — il ne montrera jamais une estimation à la place.
        </p>
      ) : (
        <>
          <div className="panel mt-3 flex items-baseline justify-between p-3">
            <span className="text-[12px] text-paper-dim">
              Sur {etat.lignes.length} affaire{etat.lignes.length > 1 ? "s" : ""} signée
              {etat.lignes.length > 1 ? "s" : ""}
            </span>
            <span className="font-display text-2xl font-bold text-bronze-400">{eur(etat.totalEur)}</span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {etat.lignes.map((l) => (
              <li key={l.prospectId} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="min-w-0 truncate text-paper">{l.company}</span>
                <span className="shrink-0 text-paper-faint">
                  {l.pct} % de {eur(l.encaisseEur)} encaissés = <span className="text-paper-dim">{eur(l.partEur)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ⚠ Les réserves voyagent AVEC le chiffre. Un montant sans le nombre
          d'affaires qu'on n'a pas pu compter se lit comme un total. */}
      {etat.reserve && <p className="mt-3 text-[11px] leading-snug text-paper-faint">{etat.reserve}</p>}

      <div className="panel mt-3 p-3">
        <p className="text-[11px] font-semibold text-paper-dim">Comment la part est calculée</p>
        <ul className="mt-1.5 space-y-1">
          {PALIERS_PART.map((p) => (
            <li key={p.niveau} className="text-[11px] leading-snug text-paper-faint">
              <span className="font-mono text-bronze-400">{p.pct} %</span> — {p.ceQuAlphaAFait}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-snug text-paper-faint">
          Sur ce que tu as réellement encaissé — jamais sur ton bénéfice : tes coûts sont
          les tiens, et nous n&apos;avons pas à les regarder.
        </p>
      </div>

      {/* ⚠⚠ LA PHRASE QUI EMPÊCHE CET ÉCRAN DE MENTIR. Sans elle, un montant
          affiché dans la section « Compte » se lit comme une somme due. */}
      <p className="mt-3 text-[11px] leading-snug text-paper-faint">
        Simulation — aucun prélèvement n&apos;est en cours et rien ne sera facturé sans un accord
        écrit. Ce calcul existe pour que tu saches ce que cette option vaudrait, avant d&apos;en
        parler.
      </p>
    </section>
  );
}
