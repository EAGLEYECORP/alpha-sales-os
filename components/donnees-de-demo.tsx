"use client";

import { AlertTriangle } from "lucide-react";
import type { Prospect, Campaign } from "@/lib/types";
import { isDemoProspect, isDemoCampaign } from "@/lib/seed";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES CHIFFRES DE DÉMONSTRATION DOIVENT DIRE QU'ILS SONT DE DÉMONSTRATION.
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT, PAS EN LE TESTANT.
 *
 * Le jeu de démo est l'état par défaut (le premier bouton de l'app est
 * « Explorer la démo »). Deux familles d'écrans en affichaient les chiffres
 * sans rien qui les distingue du réel :
 *
 *   /payouts, /trajectoire  « 1 390 € encaissés · 2 ventes »
 *   /campaigns              « 42 envoyés · 67 % ouverts · 21 % réponses »
 *
 * Ce sont exactement les écrans qu'on ouvre pour PROUVER que l'OS
 * fonctionne. CLAUDE.md est explicite : zéro vente, donc zéro preuve
 * disponible ; l'afficher quand même la fabrique. Et un chiffre se croit plus
 * vite qu'une phrase — c'est la même ligne rouge que « nos clients » dans un
 * script, en pire.
 *
 * Le cas des campagnes est le plus net : sur LE MÊME écran, le panneau de
 * tracking dit honnêtement « MESSAGES 0 · TAUX D'OUVERTURE 0 % » avec sa
 * réserve, pendant que la carte du dessous affiche 67 %. Le produit se
 * contredisait à deux centimètres près.
 *
 * ── CE QUE CES BANDEAUX FONT, ET CE QU'ILS NE FONT PAS ──
 *
 * Ils ne bloquent rien et ne masquent aucun chiffre : l'opérateur a besoin de
 * voir ses écrans remplis pour comprendre à quoi ils servent. Ils NOMMENT, et
 * ils disparaissent tout seuls dès que la démo est remplacée par du réel. Un
 * avertissement qu'il faut penser à retirer est un avertissement qu'on
 * oublie, puis qu'on montre.
 *
 * ── POURQUOI UN SEUL FICHIER ──
 *
 * `isDemoProspect` existait depuis longtemps et n'était câblé que sur deux
 * surfaces (boîte d'envoi, push Notion). C'est le défaut que je trouve le
 * plus souvent ici : une garde juste, branchée à un seul endroit. Le bandeau
 * vit donc à UN endroit, avec sa coquille partagée — le troisième écran qui
 * en aura besoin copiera quelque chose qui marche.
 * ─────────────────────────────────────────────────────────────────────
 */
function BandeauDemo({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-signal-amber/50 bg-signal-amber/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-signal-amber">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

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
    <BandeauDemo>
      <strong>{total.toLocaleString("fr-FR")} €</strong> de ces montants viennent des {demoAvecArgent.length} fiche(s)
      de <strong>démonstration</strong> — de l&apos;argent qui n&apos;a jamais été encaissé. Ne montre pas cet écran à
      un prospect tant que le jeu de démo est chargé : un chiffre se croit plus vite qu&apos;une phrase, et il ne se
      rattrape pas.
      <span className="text-paper-faint">
        {" "}
        Il disparaît tout seul quand tu remplaces la démo par tes vraies fiches (Réglages → Tout vider).
      </span>
    </BandeauDemo>
  );
}

/**
 * Les taux d'une campagne de démonstration.
 *
 * ⚠ Un TAUX est plus dangereux qu'un total : il se cite. « 67 % d'ouverture »
 * se retient, se répète en rendez-vous, et sert à comparer deux campagnes —
 * alors qu'il n'a jamais été mesuré. La doctrine de la boucle l'écrit noir sur
 * blanc : zéro donnée → zéro chiffre, et jamais un taux nu.
 */
export function ChiffresDeCampagneDemo({ campaigns }: { campaigns: Campaign[] }) {
  const demo = campaigns.filter((c) => isDemoCampaign(c.id) && c.stats.sent > 0);
  if (demo.length === 0) return null;

  return (
    <BandeauDemo>
      {demo.length === 1 ? "Une campagne affichée est" : `${demo.length} campagnes affichées sont`} de{" "}
      <strong>démonstration</strong> : leurs compteurs (envoyés, ouvertures, réponses, RDV) sont{" "}
      <strong>inventés</strong>. Aucun message n&apos;est parti — le panneau de tracking ci-dessus, lui, compte le réel
      et affiche 0. Un taux d&apos;ouverture se cite en rendez-vous : celui-là n&apos;a jamais été mesuré, ne le
      reprends nulle part.
      <span className="text-paper-faint">
        {" "}
        Le bandeau disparaît tout seul dès que ces campagnes sont remplacées par les tiennes.
      </span>
    </BandeauDemo>
  );
}
