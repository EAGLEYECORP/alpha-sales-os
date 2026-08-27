"use client";

import { AlertTriangle } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { isDemoProspect } from "@/lib/seed";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ARGENT DE DÉMONSTRATION DOIT DIRE QU'IL EST DE DÉMONSTRATION.
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT, PAS EN LE TESTANT.
 *
 * Avec le jeu de démonstration chargé — l'état par défaut, et le premier
 * bouton de l'app est « Explorer la démo » — deux écrans affichent :
 *
 *   /payouts     « Ta part cumulée 1 390 € · Ventes 2 · Brut encaissé 1 390 € »
 *   /trajectoire « 1 390 € encaissés · 1 % du palier »
 *
 * Rien, nulle part, ne disait que ces euros sont fictifs. Or ce sont
 * exactement les écrans qu'on ouvre pour PROUVER que l'OS fonctionne.
 *
 * C'est la même ligne rouge que « nos clients » dans le script hors-ligne, en
 * pire : un chiffre se croit plus facilement qu'une phrase. CLAUDE.md est
 * explicite — zéro vente, donc zéro preuve disponible ; l'afficher quand même
 * fabrique la preuve.
 *
 * ── CE QUE CE BANDEAU FAIT, ET CE QU'IL NE FAIT PAS ──
 *
 * Il ne bloque rien et ne masque aucun chiffre : l'opérateur a besoin de voir
 * ses écrans remplis pour comprendre à quoi ils servent. Il NOMME, et il
 * disparaît tout seul dès que le jeu de démo est remplacé par de vraies
 * fiches. Un avertissement qu'il faut penser à retirer est un avertissement
 * qu'on oublie.
 *
 * Le mécanisme existait déjà (`isDemoProspect`, `SEED_PROSPECT_IDS`) et n'était
 * branché que sur deux surfaces : la boîte d'envoi et le push Notion. Encore
 * une garde juste, câblée à un seul endroit.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ArgentDeDemo({ prospects }: { prospects: Prospect[] }) {
  // On ne regarde que les fiches qui portent de l'ARGENT : une fiche de démo
  // sans paiement ne fausse aucun total, et prévenir pour rien apprend à
  // ignorer les bandeaux.
  const demoAvecArgent = prospects.filter(
    (p) => isDemoProspect(p.id) && (p.payments ?? []).some((x) => x.status === "paye")
  );
  if (demoAvecArgent.length === 0) return null;

  const total = demoAvecArgent.reduce(
    (s, p) => s + (p.payments ?? []).filter((x) => x.status === "paye").reduce((a, x) => a + x.amount, 0),
    0
  );

  return (
    <div className="flex items-start gap-2 rounded-xl border border-signal-amber/50 bg-signal-amber/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-signal-amber">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <p>
        <strong>{total.toLocaleString("fr-FR")} €</strong> de ces montants viennent des{" "}
        {demoAvecArgent.length} fiche(s) de <strong>démonstration</strong> — de l&apos;argent qui n&apos;a
        jamais été encaissé. Ne montre pas cet écran à un prospect tant que le jeu de démo est chargé :
        un chiffre se croit plus vite qu&apos;une phrase, et il ne se rattrape pas.
        <span className="text-paper-faint">
          {" "}
          Il disparaît tout seul quand tu remplaces la démo par tes vraies fiches (Réglages → Tout vider).
        </span>
      </p>
    </div>
  );
}
