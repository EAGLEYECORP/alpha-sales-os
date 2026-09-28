/**
 * ─────────────────────────────────────────────────────────────────────
 * CLIENT JEV (TypeSafe AI) — le modèle « System One », sorti le 15/09/2026.
 *
 * Jev ne rend pas de texte : il rend une DÉCISION TYPÉE avec un score de
 * confiance, en un passage. C'est la forme EXACTE de nos classements à domaine
 * connu d'avance — l'intention d'une réponse entrante (`veut-rdv` / `prix` /
 * `refus`…), l'intent d'un message Telegram. Là où un LLM rédige, Jev tranche.
 *
 * ⚠⚠ CE CLIENT EST UN JOINT DÉCLARÉ, PAS UNE INTÉGRATION — et c'est honnête,
 * pas paresseux. Au 22/09/2026 : Jev est en accès anticipé, nous n'avons PAS de
 * clé, et le proxy sortant du bac à sable BLOQUE sa doc d'API (egress, vérifié
 * sur deux URL). On ne connaît donc ni la forme de sa requête ni sa réponse, et
 * on ne peut rien tester en vrai. Inventer un `POST` reviendrait à fabriquer une
 * intégration qui enverrait le texte d'un VRAI prospect dans le vide — la faute
 * que ce dépôt refuse partout.
 *
 * Donc, tant que `JEV_URL` + `JEV_API_KEY` ne sont pas posés, `jevDisponible()`
 * rend false et PERSONNE ne passe par ici : le décideur (`lib/decision-typee.ts`)
 * reste sur le LLM. Le jour où on a la clé ET la doc, on remplit `deciderViaJev`
 * avec la vraie forme — un seul endroit, une seule passe. En attendant, il LÈVE,
 * bruyamment, et le décideur retombe sur le LLM sans rien casser.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce que Jev rend : une valeur du domaine + sa confiance (0..1). */
export interface DecisionJev<T extends string> {
  valeur: T;
  confiance: number;
}

/**
 * Jev est-il réellement configuré ? Les DEUX variables, jamais l'une sans
 * l'autre — une URL sans clé (ou l'inverse) n'est pas une configuration, c'est
 * une demi-config qui échouerait à l'appel. Fail-closed : dans le doute, false,
 * et on reste sur le LLM éprouvé.
 */
export function jevDisponible(): boolean {
  return Boolean(process.env.JEV_URL?.trim() && process.env.JEV_API_KEY?.trim());
}

/**
 * Décide via Jev. Le CONTRAT est écrit (entrée : le texte + le domaine de
 * valeurs possibles ; sortie : une valeur + une confiance) ; la FORME de l'API
 * n'est pas connue d'ici. On refuse plutôt que d'inventer.
 *
 * À remplir quand la doc + la clé existent : construire la requête réelle
 * (endpoint `JEV_URL`, en-tête `Authorization: Bearer JEV_API_KEY`), passer le
 * domaine `valeurs` comme schéma de sortie, lire `{valeur, confiance}`.
 */
export async function deciderViaJev<T extends string>(opts: {
  texteEntrant: string;
  valeurs: readonly T[];
}): Promise<DecisionJev<T>> {
  void opts;
  throw new Error(
    "jev: forme d'API non renseignée (doc inaccessible d'ici, aucune clé) — le décideur retombe sur le LLM.",
  );
}
