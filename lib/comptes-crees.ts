/**
 * ─────────────────────────────────────────────────────────────────────
 * COMPTER LES COMPTES — le chiffre dont tout le plan « 10 M » dépend, et
 * qu'aucun écran ne montrait.
 *
 * `docs/OBJECTIF-10M.md` pose le premier mur à ~30 inscriptions par heure (les
 * emails de confirmation) et dit, en toutes lettres, que son chiffre exact
 * « n'est pas connu ici ». Décision du 20/10/2026 : on remplit la limite
 * d'abord, on traite le reste quand elle est atteinte. Pour la voir arriver
 * au lieu de la deviner à la première réclamation d'un inscrit sans lien, il
 * faut un compteur. Ce module en est le cœur.
 *
 * ── CE QUI SORT D'ICI, ET CE QUI NE SORT JAMAIS ──
 *
 * Deux ENTIERS (le total, et les inscrits de la dernière heure) et une phrase
 * qui dit pourquoi un des deux manque. **Aucun email, aucun identifiant.** La
 * liste des comptes est lue (elle porte des adresses de tiers) mais seule la
 * date de création en est extraite — le test vérifie qu'aucune adresse ne
 * survit dans la sortie.
 *
 * ── `null` N'EST PAS `0` ──
 *
 * Même mode de panne que le moniteur : un compteur qui rend 0 parce que la base
 * est injoignable se lit « personne ne s'inscrit » et fait raisonner dans le
 * vide. Toute lacune rend `null` et SE DIT (`raison`).
 *
 * ── LA FENÊTRE D'UNE HEURE EST UN PLANCHER, PAS UNE MESURE ──
 *
 * On lit les 100 comptes les plus récents. Si tous sont dans l'heure, le vrai
 * nombre est supérieur : `derniereHeureMinimum` le dit, sinon l'écran
 * afficherait « 100 » comme un résultat alors que c'est un plafond de lecture.
 * Et l'ordre de la liste n'est pas supposé : s'il n'est pas du plus récent au
 * plus ancien, la fenêtre rendrait 0 sur une base pleine — on rend `null`.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ComptesCrees {
  /** Comptes existants, ou `null` si on ne sait pas. Jamais 0 par défaut. */
  total: number | null;
  /** Comptes créés depuis une heure, ou `null` si non lisible. */
  derniereHeure: number | null;
  /** Vrai quand les 100 plus récents sont TOUS dans l'heure : le vrai nombre est ≥. */
  derniereHeureMinimum: boolean;
  /** Pourquoi une valeur manque. `null` quand tout est lu. */
  raison: string | null;
}

/** Combien de comptes récents on lit pour estimer la fenêtre d'une heure. */
export const LECTURE_RECENTS = 100;

/**
 * Le mur supposé : ~30 emails de confirmation par heure avec un SMTP perso.
 *
 * ⚠ **SUPPOSÉ, PAS LU.** Source secondaire ; le chiffre réel est dans le tableau
 * de bord Supabase (Authentication → Rate Limits) et n'est pas atteignable
 * d'ici. L'écran doit l'afficher AVEC cette réserve — un seuil d'alerte qui a
 * l'air mesuré est le défaut que ce dépôt refuse partout.
 */
export const MUR_EMAILS_PAR_HEURE_SUPPOSE = 30;

/** À partir de quelle part du mur on prévient (avant, pas après). */
export const PART_D_ALERTE = 0.8;

export type EtatMur = "inconnu" | "loin" | "proche" | "atteint";

/** Où en est-on par rapport au mur supposé ? `inconnu` quand la fenêtre est illisible. */
export function etatDuMur(c: ComptesCrees, mur: number = MUR_EMAILS_PAR_HEURE_SUPPOSE): EtatMur {
  if (c.derniereHeure === null) return "inconnu";
  if (c.derniereHeure >= mur) return "atteint";
  return c.derniereHeure >= Math.ceil(mur * PART_D_ALERTE) ? "proche" : "loin";
}

const AVEUGLE = (raison: string): ComptesCrees => ({
  total: null,
  derniereHeure: null,
  derniereHeureMinimum: false,
  raison,
});

type Env = Record<string, string | undefined>;
type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(nom: string): string | null };
  json(): Promise<unknown>;
}>;

/**
 * Lit le total et la fenêtre d'une heure par l'API d'administration de
 * Supabase Auth (clé service, côté serveur uniquement).
 *
 * `fetch` et l'horloge sont injectés : la fonction se joue dans un test sans
 * réseau, et l'horloge ne se lit jamais en cachette.
 */
export async function lireComptesCrees(
  env: Env,
  fetchImpl: Fetch,
  maintenant: Date = new Date()
): Promise<ComptesCrees> {
  const base = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const cle = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!base || !cle) return AVEUGLE("Supabase n'est pas configuré sur ce serveur.");

  let reponse;
  try {
    reponse = await fetchImpl(`${base}/auth/v1/admin/users?page=1&per_page=${LECTURE_RECENTS}`, {
      headers: { apikey: cle, Authorization: `Bearer ${cle}` },
    });
  } catch {
    return AVEUGLE("Supabase est injoignable depuis ce serveur.");
  }
  // Le statut seulement : le corps d'une erreur peut citer ce qu'on a envoyé.
  if (!reponse.ok) return AVEUGLE(`Supabase a répondu ${reponse.status}.`);

  let corps: unknown;
  try {
    corps = await reponse.json();
  } catch {
    return AVEUGLE("La réponse de Supabase n'est pas lisible.");
  }

  // Seules les DATES de création sont extraites : l'adresse ne quitte jamais cette fonction.
  const liste = Array.isArray(corps) ? corps : (corps as { users?: unknown })?.users;
  if (!Array.isArray(liste)) return AVEUGLE("La liste des comptes a une forme inattendue.");
  const dates: number[] = [];
  for (const u of liste) {
    const t = Date.parse(String((u as { created_at?: unknown })?.created_at ?? ""));
    if (Number.isFinite(t)) dates.push(t);
  }

  // Le total : l'en-tête quand il existe ; sinon la page elle-même, MAIS seulement
  // si elle n'est pas pleine (une page pleine ne dit rien du reste).
  const entete = Number.parseInt(reponse.headers.get("x-total-count") ?? "", 10);
  let total: number | null = Number.isInteger(entete) && entete >= 0 ? entete : null;
  if (total === null && liste.length < LECTURE_RECENTS) total = liste.length;

  let raison: string | null = total === null ? "Le total n'est pas fourni par Supabase." : null;

  // La fenêtre d'une heure n'a de sens que sur une liste du plus récent au plus ancien.
  const recentsDabord = dates.every((t, i) => i === 0 || dates[i - 1] >= t);
  let derniereHeure: number | null = null;
  let minimum = false;
  if (!recentsDabord) {
    raison = raison ?? "L'ordre de la liste n'est pas garanti : la fenêtre d'une heure n'est pas lue.";
  } else if (dates.length === 0 && liste.length > 0) {
    raison = raison ?? "Aucune date de création lisible : la fenêtre d'une heure n'est pas lue.";
  } else {
    const limite = maintenant.getTime() - 3_600_000;
    derniereHeure = dates.filter((t) => t >= limite).length;
    minimum = dates.length >= LECTURE_RECENTS && derniereHeure === dates.length;
  }

  return { total, derniereHeure, derniereHeureMinimum: minimum, raison };
}
