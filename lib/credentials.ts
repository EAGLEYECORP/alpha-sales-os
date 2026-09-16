import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Entitlement } from "./entitlements";
import { CHEMIN_PAR_API } from "./api-access";

/**
 * ─────────────────────────────────────────────────────────────────────
 * BYOK — « apporte ta propre clé ». Le seul endroit qui décide QUI PAIE.
 *
 * ══ POURQUOI CE MODULE EXISTE ══
 *
 * Mesuré avant de l'écrire : un compte gratuit pouvait appeler 4 familles
 * d'API sur 20. La raison était écrite à dix endroits du dépôt — « il
 * n'existe aucun chemin d'identifiants par locataire » — et c'était vrai :
 * `/api/ai` brûlait NOTRE clé, donc l'ouvrir au gratuit revenait à donner
 * notre carte bancaire à des inconnus. Ce n'était pas un arbitrage
 * commercial qu'on pouvait assouplir, c'était un fait technique.
 *
 * Ce module est ce qui le change. Il ne rend pas l'IA gratuite : il rend
 * possible qu'un locataire la paie LUI-MÊME, chez son fournisseur.
 *
 * ══ ⚠⚠ L'ORDRE DE RÉSOLUTION, ET IL NE SE POSE QU'ICI ══
 *
 *   1. le locataire a une clé VÉRIFIÉE      → origine "locataire"  (il paie)
 *   2. sinon, la brique payante lui est due → origine "maison"     (on paie)
 *   3. sinon                                → origine "aucune"     (on refuse)
 *
 * **Écrit à l'envers, le point 2 ruine l'entreprise.** « Pas de clé
 * locataire ⇒ on prend la nôtre » sans vérifier le droit, et tout inscrit
 * dépense sur notre compte — invisible jusqu'à la facture, un mois plus tard.
 * Cet ordre est testé par MUTATION, jamais par relecture.
 *
 * ⚠ **Toute panne mène à `aucune`.** Base injoignable, déchiffrement raté,
 * clé maître absente : on refuse. C'est l'inverse du réflexe « en cas de
 * doute, ne pas bloquer », et c'est délibéré — la même doctrine que
 * `firstSendAt` (palier le plus bas) et `presence-agent` (ne pas composer
 * dans le vide). Ici, ce qui est en jeu est notre facture.
 *
 * ⚠ **`origine` n'est pas décoratif.** C'est ce qui permettra de compter ce
 * que chaque locataire nous coûte vraiment — aujourd'hui personne ne le sait.
 * Un appelant qui l'ignore perd la seule information que ce module produise
 * en plus des valeurs.
 *
 * ══ ⚠⚠ POURQUOI CE FICHIER EST COUPÉ EN DEUX ══
 *
 * Le MIDDLEWARE tourne en **Edge**, où `node:crypto` n'existe pas — le build
 * de production l'a dit, ni `tsc` ni les tests ne pouvaient le voir. Ce
 * fichier-ci ne porte donc QUE ce dont la porte d'entrée a besoin : quelles
 * capacités un locataire apporte, et ce qu'elles ouvrent.
 *
 * Le déchiffrement et la résolution des moteurs vivent dans
 * `lib/credentials-secret.ts`, côté Node. Ce n'est pas qu'une contrainte de
 * plateforme, c'est la bonne frontière : **la porte d'entrée n'a aucune
 * raison de savoir déchiffrer une clé.** Elle a seulement besoin de savoir
 * qu'il y en a une, vérifiée.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Les capacités qu'un locataire peut apporter.
 *
 * ⚠ **Une seule valeur aujourd'hui, et c'est volontaire.** Le chiffrage
 * (`docs/BYOK-CHIFFRAGE.md`) en identifie cinq — email, sms, transcription,
 * téléphonie suivront avec leur lot. Les déclarer maintenant créerait quatre
 * valeurs mortes qu'un lecteur croirait branchées : le défaut le plus fréquent
 * de ce dépôt, commis d'avance. Chaque lot ajoutera SA valeur ici ET dans la
 * contrainte SQL, dans le même diff — un test croise les deux.
 */
export type Capacite = "ia";

export const CAPACITES: readonly Capacite[] = ["ia"];

/** Qui paie l'appel qui va suivre. Toujours rendu, jamais deviné. */
export type Origine = "locataire" | "maison" | "aucune";

/**
 * Les moteurs joignables pour cet appel, et qui les paie.
 *
 * ⚠ Ollama n'est jamais « locataire » : c'est le moteur LOCAL du serveur qui
 * héberge. Un locataire ne peut pas en apporter un — il n'a pas de machine
 * chez nous. Il appartient donc toujours à `maison`.
 */
export interface MoteurIA {
  origine: Origine;
  ollama?: { url: string; model: string };
  nvidia?: { key: string; baseUrl: string; model: string };
  anthropic?: { key: string; model: string };
}

/** Le moteur vide — rendu sur toute panne, et sur tout refus. */
export const AUCUN_MOTEUR: MoteurIA = { origine: "aucune" };

/** Un moteur peut-il effectivement répondre ? */
export function moteurUtilisable(m: MoteurIA): boolean {
  return Boolean(m.ollama || m.nvidia || m.anthropic);
}


function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
// ── Ce qu'une clé apportée OUVRE ───────────────────────────────────────

/**
 * Les API dont le coût est ENTIÈREMENT couvert par une capacité apportée.
 *
 * ⚠⚠ C'EST UNE LISTE DE COÛTS, PAS DE FONCTIONS. `/api/audit` en est absente
 * alors qu'elle appelle l'IA : elle récupère aussi des sites tiers **depuis
 * notre serveur**, donc notre egress et notre exposition à l'abus. Une clé IA
 * ne paie pas ça. La ranger ici parce qu'« elle fait de l'IA » serait le
 * défaut exact que le freemium a déjà payé : classer par FAMILLE au lieu de
 * classer par DÉPENSE.
 */
export const CAPACITE_PAR_API: Readonly<Record<string, Capacite>> = {
  "/api/ai": "ia",
  "/api/agent": "ia",
  "/api/sparring": "ia",
  "/api/icp": "ia",
  "/api/brain": "ia",
  "/api/debrief": "ia",
  "/api/social": "ia",
};

/**
 * Ce chemin est-il entièrement payé par les capacités apportées ?
 *
 * ⚠⚠ **TOUTES les API qui servent le chemin doivent être couvertes.** Un
 * `some` au lieu d'un `every` ouvrirait `/audits` (servi par `/api/icp`, IA,
 * ET `/api/audit`, notre egress) et `/social` (servi par `/api/social`, IA,
 * ET `/api/video`, notre calcul de rendu). Le locataire paierait ses jetons
 * et nous le reste, sans que rien ne le dise.
 *
 * Rien n'est écrit à la main ici : la liste des API qui servent un chemin se
 * DÉRIVE de `CHEMIN_PAR_API`. Une API ajoutée demain sur un chemin ouvert le
 * referme d'office tant qu'elle n'est pas classée — c'est le bon sens du
 * défaut.
 */
export function cheminOuvertParCle(chemin: string, capacites: readonly Capacite[]): boolean {
  const servantes = Object.entries(CHEMIN_PAR_API)
    .filter(([, c]) => c === chemin)
    .map(([api]) => api);
  if (servantes.length === 0) return false;
  return servantes.every((api) => {
    const cap = CAPACITE_PAR_API[api];
    return cap !== undefined && capacites.includes(cap);
  });
}

/**
 * Les capacités qu'un locataire apporte, VÉRIFIÉES.
 *
 * ⚠ Toute panne rend une liste vide — donc n'ouvre rien. Une erreur de base
 * ne doit jamais accorder un accès : c'est la même doctrine que partout
 * ailleurs ici, et c'est le sens qui protège notre facture.
 */
export async function capacitesDu(tenantId: string | null): Promise<Capacite[]> {
  if (!tenantId) return [];
  const sb = serviceClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("tenant_credentials")
    .select("capacite, verifie_le")
    .eq("tenant_id", tenantId)
    .not("verifie_le", "is", null);
  if (error) return [];
  const connues = new Set<string>(CAPACITES);
  return (data ?? [])
    .map((r) => String((r as { capacite?: string }).capacite ?? ""))
    .filter((c): c is Capacite => connues.has(c));
}

/**
 * La question que pose le middleware : « sa propre clé lui ouvre-t-elle
 * ce chemin ? »
 *
 * ⚠ Un compte sans session n'apporte rien : `tenantId` absent ⇒ `false`.
 * Sinon une requête anonyme hériterait d'un accès qu'aucun compte ne porte.
 */
export async function cleOuvreLeChemin(droits: Entitlement, chemin: string): Promise<boolean> {
  if (!droits.tenantId) return false;
  const caps = await capacitesDu(droits.tenantId);
  if (caps.length === 0) return false;
  return cheminOuvertParCle(chemin, caps);
}
