/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SIREN D'UNE FICHE — une seule définition, pur, client + serveur.
 *
 * Trois endroits le lisaient chacun à sa façon : la cadence légale le
 * cherchait dans les NOTES (c'est là que l'import terrain l'écrit), la lecture
 * de site gardait sa clé de Luhn en privé, et les signaux publics en ont
 * besoin à leur tour (22/10/2026). Deux relectures différentes du même champ
 * finissent par donner deux réponses pour la même fiche.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le SIREN tel que l'import terrain l'écrit dans les notes après croisement au registre. */
export const SIREN_DANS_NOTES = /\bSIREN\s*:?\s*(\d{9})\b/i;

/**
 * Clé de Luhn : un SIREN valide la vérifie. Un nombre lu au hasard, presque jamais.
 *
 * ⚠ « 000000000 » la vérifie AUSSI (somme nulle) — et c'est le numéro de
 * remplissage des entités non immatriculées : mesuré le 22/10/2026, il porte
 * 1 563 annonces au BODACC. Une feuille qui met des zéros faute de SIREN
 * aurait collé sur une fiche saine les liquidations de 1 563 inconnus.
 */
export function sirenValide(s: string): boolean {
  if (!/^\d{9}$/.test(s) || /^0+$/.test(s)) return false;
  let somme = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(s[8 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 === 0;
}

/** « 982 880 064 », « 982880064 », « 98288006400017 » (un SIRET) → « 982880064 ». */
export function normaliserSiren(brut: string | undefined): string {
  const chiffres = (brut ?? "").replace(/\D/g, "");
  return chiffres.length === 9 || chiffres.length === 14 ? chiffres.slice(0, 9) : "";
}

/**
 * Le SIREN de la fiche : le champ structuré d'abord, puis ce que l'import a
 * écrit dans les notes. `undefined` quand on ne sait pas — jamais deviné à
 * partir d'un nom (un faux rapprochement poserait les annonces d'une société
 * sur la fiche d'une autre).
 *
 * ⚠ PAS de contrôle de Luhn ici : la cadence légale lit ce champ, et un SIREN
 * hors Luhn existe (La Poste). La clé sert à juger une TROUVAILLE (un nombre lu
 * sur un site), pas un numéro qu'on nous a donné.
 */
export function sirenDeLaFiche(p: { siren?: string; notes?: string }): string | undefined {
  const lu = normaliserSiren(p.siren) || (p.notes ?? "").match(SIREN_DANS_NOTES)?.[1];
  // Des zéros ne sont pas un SIREN : ils disent « pas de numéro ». Les lire
  // comme un SIREN ferait passer un particulier pour une entreprise inscrite —
  // donc lever le plafond légal de la cadence (`plafondRappels`).
  return lu && !/^0+$/.test(lu) ? lu : undefined;
}
