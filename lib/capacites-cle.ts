import { CHEMIN_PAR_API, MAITRE_SEULEMENT } from "./api-access";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'UNE CLÉ APPORTÉE OUVRE — la moitié PURE du BYOK.
 *
 * Extraite de `lib/credentials.ts` le 13/10/2026. La question « sa propre
 * clé lui ouvre-t-elle ce chemin ? » se pose à DEUX endroits : le
 * middleware (qui accorde) et l'écran qui explique un verrou (qui le DIT).
 * Les deux doivent répondre pareil — sinon l'écran promet « branche ta clé »
 * sur une porte que le serveur refusera, ou se tait sur une porte ouverte.
 * Une seule définition, ici, sans base ni secret : rien de ce fichier ne
 * dépend de qui appelle.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Les capacités qu'un locataire peut apporter.
 *
 * ⚠ **On n'en déclare que ce qu'on sait servir.** Le chiffrage
 * (`docs/BYOK-CHIFFRAGE.md`) en identifie cinq ; `sms`, `transcription` et
 * `telephonie` viendront avec leur lot. Les déclarer d'avance créerait des
 * valeurs mortes qu'un lecteur croirait branchées : le défaut le plus fréquent
 * de ce dépôt, commis exprès. Chaque lot ajoute SA valeur ici ET dans la
 * contrainte SQL, dans le même diff — un test croise les deux.
 */
export type Capacite = "ia" | "email";

export const CAPACITES: readonly Capacite[] = ["ia", "email"];

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
export const CAPACITES_PAR_API: Readonly<Record<string, readonly Capacite[]>> = {
  "/api/ai": ["ia"],
  "/api/agent": ["ia"],
  "/api/sparring": ["ia"],
  "/api/icp": ["ia"],
  "/api/brain": ["ia"],
  "/api/debrief": ["ia"],
  "/api/social": ["ia"],
  /**
   * ⚠⚠ `/api/send` SERT DEUX CANAUX — email ET SMS — et c'est ce qui rend la
   * porte forcément GROSSIÈRE : le canal vit dans le CORPS de la requête, que
   * le middleware ne lit pas (et ne doit pas lire).
   *
   * Conséquence assumée : apporter un SMTP ouvre le chemin, donc rend la
   * branche SMS ATTEIGNABLE. Ce qui empêche un gratuit d'y dépenser NOS
   * crédits Textbelt n'est donc pas cette liste — c'est la résolution au
   * runtime, dans la route, qui refuse le canal qu'il ne peut pas payer.
   *
   * Précédent assumé dans ce dépôt : `/controle` est ouvert au gratuit et
   * affiche le lanceur de campagnes ; le bouton existe, le serveur refuse.
   * « Voir la porte fermée vaut mieux que ne pas savoir qu'elle existe, et la
   * sécurité ne dépend jamais de l'écran. » Ici : jamais de la porte non plus.
   */
  "/api/send": ["email"],
  "/api/reponses": ["email"],
  "/api/digest": ["email"],
  /**
   * ⚠ `/api/gmail` est VOLONTAIREMENT ABSENTE, alors qu'elle appartient à la
   * même famille : elle écrit un brouillon via **notre IMAP**, et la capacité
   * `email` n'apporte qu'un SMTP. L'inscrire ici affirmerait qu'une clé
   * d'envoi la couvre — c'est faux, et ça ouvrirait notre boîte de réception
   * le jour où `/api/compose` serait classée à son tour.
   *
   * Aujourd'hui `/outbox` reste fermé de toute façon (`/api/compose` n'est pas
   * classée non plus), donc l'inscrire ne changerait rien de VISIBLE — c'est
   * exactement ce qui rend le piège dangereux : il ne se déclencherait que
   * plus tard, pour quelqu'un d'autre.
   */
};

/**
 * Les API qui ne nous coûtent RIEN, et qui ne bloquent donc pas l'ouverture
 * d'un chemin par ailleurs entièrement couvert.
 *
 * ⚠⚠ CETTE LISTE EST UN TROU PAR CONSTRUCTION : tout ce qu'on y met échappe
 * au contrôle de coût. Elle doit rester minuscule, et chaque entrée porter sa
 * raison MESURÉE — pas « ça a l'air gratuit ».
 *
 * · `/api/deliverability` — mesuré en ouvrant le fichier : il n'interroge que
 *   des enregistrements DNS **publics** via le résolveur système. Aucune
 *   requête vers un hôte arbitraire (donc aucune surface SSRF), aucun jeton,
 *   aucune minute. Sans cette entrée, `/campaigns` resterait fermé à un
 *   locataire qui apporte pourtant tout ce qui coûte.
 */
export const API_SANS_COUT: readonly string[] = ["/api/deliverability"];

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
  if (capacites.length === 0) return false;
  return servantes.every((api) => {
    /**
     * ⚠ Une API réservée au maître n'est JAMAIS atteignable par un locataire :
     * la garde d'identité passe AVANT celle des droits, dans le middleware.
     * La compter comme « non couverte » fermerait un chemin pour une porte
     * que l'intéressé ne peut de toute façon pas pousser.
     */
    if (MAITRE_SEULEMENT.includes(api)) return true;
    if (API_SANS_COUT.includes(api)) return true;
    const requises = CAPACITES_PAR_API[api];
    // ⚠ `some` DANS une API (elle peut dépenser plusieurs choses, le runtime
    // tranche le canal), `every` ENTRE les API (aucune ne doit rester à notre
    // charge). Inverser l'un des deux ouvre ce qu'on ne paie pas.
    return requises !== undefined && requises.some((c) => capacites.includes(c));
  });
}
