/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE CLÉ QUI NE QUITTE PAS LE NAVIGATEUR (29/10/2026).
 *
 * La clé Dropcontact de l'inscrit sert à des requêtes qui partent de SON
 * navigateur (`lib/enrichissement.ts`). Elle n'a donc aucune raison de
 * passer par notre serveur — ni d'y être stockée.
 *
 * ⚠ Elle vit HORS du magasin (`alpha-sales-os-v2`) exprès : le magasin
 * s'exporte (`exportData`), se synchronise (`pipeServeur`) et se colle dans
 * des échanges d'assistance. Une clé rangée là partirait avec une sauvegarde
 * envoyée à quelqu'un. Ici, une clé à part, que rien n'exporte.
 *
 * Tout accès est sous try/catch : navigation privée ou stockage bloqué ⇒ la
 * clé n'existe pas, et l'écran le dit.
 * ─────────────────────────────────────────────────────────────────────
 */

const CLE_DROPCONTACT = "alpha-cle-dropcontact";

export function lireCleDropcontact(): string {
  try {
    return (globalThis.localStorage?.getItem(CLE_DROPCONTACT) ?? "").trim();
  } catch {
    return "";
  }
}

export function enregistrerCleDropcontact(cle: string): boolean {
  try {
    const v = cle.replace(/\s+/g, "");
    if (v) globalThis.localStorage?.setItem(CLE_DROPCONTACT, v);
    else globalThis.localStorage?.removeItem(CLE_DROPCONTACT);
    return true;
  } catch {
    return false;
  }
}

/** « abcd…wxyz » — jamais la clé entière à l'écran. */
export function cleMasquee(cle: string): string {
  const v = cle.trim();
  return v.length <= 8 ? "••••" : `${v.slice(0, 4)}…${v.slice(-4)}`;
}
