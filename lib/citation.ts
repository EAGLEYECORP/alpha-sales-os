/**
 * ─────────────────────────────────────────────────────────────────────
 * CITER LA PHRASE DU PROSPECT — UNE SEULE PAIRE DE GUILLEMETS.
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT, PAS EN LE TESTANT.
 *
 * Sur la fiche et sur le tableau de bord, la prochaine action s'affichait :
 *
 *   Traiter « « C'est trop cher pour un resto comme le mien » »
 *
 * Les objections et les obstacles sont STOCKÉS avec leurs guillemets — c'est
 * la phrase du prospect, mot pour mot, et c'est voulu : le libellé doit rester
 * citable tel quel. Quatre modules la ré-emballaient ensuite dans une seconde
 * paire.
 *
 * Ce n'est pas qu'une coquille. La doctrine du dépôt tient à ce que la phrase
 * du client soit reprise MOT POUR MOT (« l'objection RÉELLE, pas celle
 * affichée »). Une citation mal fermée est le premier signe qu'un texte a été
 * fabriqué par une machine, et c'est l'écran qu'un vendeur regarde toute la
 * journée.
 *
 * La fonction est IDEMPOTENTE, et c'est le seul point qui compte : les
 * libellés viennent de trois sources (le jeu de démo, les suggestions de
 * l'écran, la saisie libre) et on ne peut pas savoir laquelle porte déjà ses
 * guillemets. Normaliser au stockage aurait été l'autre option — mais elle
 * réécrit ce que l'utilisateur a tapé, ce qui est pire.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Les paires de guillemets qu'on reconnaît comme « déjà cité ». */
const DEJA_CITE: [string, string][] = [
  ["«", "»"],
  ['"', '"'],
  ["“", "”"],
];

/**
 * Encadre `texte` de guillemets français — sauf s'il en porte déjà.
 * Une chaîne vide reste vide : `« »` ne cite rien.
 */
export function citer(texte: string | undefined | null): string {
  const t = (texte ?? "").trim();
  if (!t) return "";
  for (const [ouvre, ferme] of DEJA_CITE) {
    if (t.startsWith(ouvre) && t.endsWith(ferme) && t.length > ouvre.length + ferme.length - 1) return t;
  }
  return `« ${t} »`;
}
