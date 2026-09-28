/**
 * ─────────────────────────────────────────────────────────────────────
 * LE FEU VERT DE L'AUTO-RÉPONSE — trois conditions, toutes obligatoires.
 *
 * Décidé le 28/09/2026. Répondre tout seul à un prospect est plus sûr que
 * démarcher à froid (on répond à quelqu'un qui a écrit), mais ça part du même
 * domaine : ça reste gardé. `reply-tick` triait déjà (`envoiBranche: false`) ;
 * ce module porte la DÉCISION d'envoyer réellement, et elle est FAIL-CLOSED.
 *
 * ⚠⚠ POURQUOI UNE ATTESTATION DKIM SÉPARÉE, ET PAS UN AUTO-DÉTECTEUR. Le
 * serveur ne peut PAS vérifier l'alignement DKIM (c'est du DNS ; `/api/health`
 * ne le voit pas — cf. `lib/autonomie-checklist.ts`). Or un envoi sans DKIM
 * aligné part en spam et grille le domaine. On ne peut donc pas laisser le code
 * décider seul que « c'est bon » : c'est l'OPÉRATEUR qui l'atteste, en posant
 * `REPLY_AUTOSEND=on` APRÈS avoir relevé `d=eagleyecorp.fr` à la main. Tant que
 * la variable est absente, la boucle est BRANCHÉE mais INERTE — elle planifie,
 * elle n'envoie pas. C'est l'état par défaut, et c'est voulu.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * L'opérateur a-t-il attesté que le DKIM est aligné et autorisé l'auto-réponse ?
 * `REPLY_AUTOSEND=on` (insensible à la casse/espaces) — rien d'autre n'ouvre.
 */
export function autoReponseAttestee(): boolean {
  return (process.env.REPLY_AUTOSEND ?? "").trim().toLowerCase() === "on";
}

export interface DecisionReponseAuto {
  envoyer: boolean;
  /** La raison — sert au journal du tick, jamais décorative. */
  raison: string;
}

/**
 * Décide, pour UNE réponse, si le tick l'envoie tout seul. Les trois conditions
 * sont cumulatives, et l'ordre des refus va du plus « produit » au plus
 * « infra » pour que le journal dise la vraie cause :
 *  1. l'intention doit être automatisable (milieu de tunnel — `reponse-auto`) ;
 *  2. l'autopilote doit être armé (le bouton / l'env) ;
 *  3. le DKIM doit être attesté (`REPLY_AUTOSEND=on`).
 * N'importe laquelle qui manque ⇒ on NE répond pas tout seul : on planifie.
 */
export function doitEnvoyerReponse(opts: {
  automatisable: boolean;
  arme: boolean;
  atteste: boolean;
}): DecisionReponseAuto {
  if (!opts.automatisable)
    return { envoyer: false, raison: "intention non automatisable — remonte à l'humain (escalade/clore)" };
  if (!opts.arme) return { envoyer: false, raison: "autopilote éteint — le tick planifie sans envoyer" };
  if (!opts.atteste)
    return { envoyer: false, raison: "REPLY_AUTOSEND absent — DKIM non attesté, boucle inerte (fail-closed)" };
  return { envoyer: true, raison: "milieu de tunnel, armé, DKIM attesté — réponse envoyée dans les gardes" };
}
