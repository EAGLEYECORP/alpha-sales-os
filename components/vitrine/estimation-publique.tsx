"use client";

import { useMemo, useState } from "react";
import { estimationPublique, SIEGES_MAX_ESTIMATION } from "@/lib/cadrage";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ESTIMATION SUR LA PAGE PUBLIQUE — et pourquoi ce n'est pas un devis.
 *
 * ⚠⚠ LA DOCTRINE DIT « CADRAGE OBLIGATOIRE AVANT DEVIS », ET ELLE A RAISON.
 * Un montant annoncé sans avoir regardé le cas se renégocie à la livraison,
 * dans le pire sens : le client a déjà le chiffre en tête, et tout ce qui
 * s'ajoute ressemble à de la mauvaise foi.
 *
 * Mais interdire toute idée de prix avant le rendez-vous ferait fuir la moitié
 * des visiteurs — personne ne prend un créneau pour découvrir un ordre de
 * grandeur. La sortie n'est pas de relâcher la règle : c'est de séparer
 * l'ESTIMATION (la grille publique appliquée à votre effectif) du DEVIS
 * (chiffré, daté, engageant, et qui exige le cadrage).
 *
 * `lib/cadrage.ts` tient la séparation : `estUnDevis` y est typé `false`
 * LITTÉRALEMENT, et les réserves ne sont jamais vides. Ce composant ne fait
 * que rendre ce que ce module décide — il ne recalcule rien.
 *
 * ⚠ Il n'utilise que `PRIX_PUBLICS` (socle, siège, setup du pack) — les mêmes
 * nombres que la carte de tarifs juste au-dessus. Le catalogue brique par
 * brique reste hors de portée : `tests/vitrine-fuite` refuse qu'il descende
 * dans un navigateur, et un estimateur qui l'emporterait serait une fuite
 * déguisée en service.
 * ─────────────────────────────────────────────────────────────────────
 */

const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;

export function EstimationPublique({
  ink,
  muted,
  cream,
  accent,
  line,
}: {
  ink: string;
  muted: string;
  cream: string;
  accent: string;
  line: string;
}) {
  const [sieges, setSieges] = useState(5);
  const e = useMemo(() => estimationPublique(sieges), [sieges]);

  return (
    <div className="mt-12 rounded-2xl p-8" style={{ border: `1px solid ${line}`, background: cream }}>
      <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color: accent }}>
        Un ordre de grandeur, tout de suite
      </p>
      <p className="mt-3 text-[16px] leading-[1.6]" style={{ color: muted }}>
        Combien de personnes s&apos;en serviraient chez vous&nbsp;?
      </p>

      <div className="mt-5 flex items-center gap-4">
        <input
          type="range"
          min={1}
          max={SIEGES_MAX_ESTIMATION}
          step={1}
          value={sieges}
          onChange={(ev) => setSieges(Number(ev.target.value))}
          className="w-full"
          style={{ accentColor: accent }}
          aria-label="Nombre d'utilisateurs"
        />
        <span className="shrink-0 font-serif text-[28px] leading-none tabular-nums" style={{ color: ink }}>
          {sieges}
        </span>
      </div>

      {e && (
        <>
          <div className="mt-7 grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.12em]" style={{ color: muted }}>Installation</p>
              <p className="mt-1 font-serif text-[28px] leading-none" style={{ color: ink }}>{eur(e.setupHT)}</p>
              <p className="mt-1 text-[13px]" style={{ color: muted }}>une fois</p>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.12em]" style={{ color: muted }}>Abonnement</p>
              <p className="mt-1 font-serif text-[28px] leading-none" style={{ color: ink }}>{eur(e.mensuelHT)}</p>
              <p className="mt-1 text-[13px]" style={{ color: muted }}>par mois</p>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.12em]" style={{ color: muted }}>Première année</p>
              <p className="mt-1 font-serif text-[28px] leading-none" style={{ color: accent }}>{eur(e.annee1HT)}</p>
              <p className="mt-1 text-[13px]" style={{ color: muted }}>installation comprise</p>
            </div>
          </div>

          {/* ⚠ LES RÉSERVES SE LISENT AVEC LE CHIFFRE, pas en note de bas de
              page. Un montant nu sur une page publique se lit comme un prix
              ferme — c'est exactement l'erreur que le cadrage existe pour
              empêcher. Elles viennent du module : les réécrire ici en ferait
              une seconde version, et c'est celle qu'on ne relit pas qui
              finirait par mentir. */}
          <ul className="mt-7 space-y-2 border-t pt-6" style={{ borderColor: line }}>
            {e.reserves.map((r) => (
              <li key={r} className="flex gap-3 text-[14px] leading-[1.55]" style={{ color: muted }}>
                <span aria-hidden style={{ color: accent }}>—</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {!e && (
        <p className="mt-7 text-[15px] leading-[1.6]" style={{ color: muted }}>
          Au-delà de {SIEGES_MAX_ESTIMATION} personnes, on ne vous donnera pas un chiffre depuis une
          page web : le dossier change de nature. Parlons-en.
        </p>
      )}
    </div>
  );
}
