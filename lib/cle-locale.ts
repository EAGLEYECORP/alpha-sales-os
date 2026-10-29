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

/**
 * L'ADRESSE SECRÈTE DE SON AGENDA — même régime que la clé : hors du magasin.
 * Qui la détient lit son agenda (Google l'appelle « adresse secrète »). Elle
 * part vers `/api/agenda` à chaque lecture, n'y est pas stockée, et ne doit
 * pas voyager dans un export.
 */
const CLE_AGENDA = "alpha-agenda-ics";

export function lireAdresseAgenda(): string {
  try {
    return (globalThis.localStorage?.getItem(CLE_AGENDA) ?? "").trim();
  } catch {
    return "";
  }
}

export function enregistrerAdresseAgenda(adresse: string): boolean {
  try {
    const v = adresse.trim();
    if (v) globalThis.localStorage?.setItem(CLE_AGENDA, v);
    else globalThis.localStorage?.removeItem(CLE_AGENDA);
    return true;
  } catch {
    return false;
  }
}

/** « https://calendar.google.com/…/basic.ics » → l'hôte seul : la partie secrète ne s'affiche jamais. */
export function agendaMasque(adresse: string): string {
  try {
    return `${new URL(adresse.replace(/^webcals?:/i, "https:")).host}/…`;
  } catch {
    return "••••";
  }
}
