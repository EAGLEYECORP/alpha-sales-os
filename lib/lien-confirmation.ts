/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE DIT LE LIEN QU'ON VIENT DE CLIQUER.
 *
 * ── LE DÉFAUT, ET IL EST SILENCIEUX ──
 *
 * Supabase ne rend pas d'erreur quand un lien de confirmation échoue : il
 * REDIRIGE vers l'application avec la raison dans le fragment d'URL —
 * `#error=access_denied&error_code=otp_expired&error_description=…`.
 *
 * Personne ne lisait ce fragment. Conséquence, au moment exact de la
 * conversion : l'inscrit clique son lien, arrive sur une application qui a
 * l'air parfaitement normale, et n'est PAS connecté. Aucun message, aucune
 * trace. Il conclut que le produit est cassé — et il a raison, du sien.
 *
 * Le cas n'a rien d'exotique : le lien expire (24 h par défaut), il a déjà
 * servi, ou un antivirus d'entreprise l'a « pré-visité » et donc consommé
 * avant lui. Ce dernier cas est le plus vicieux : la personne clique un lien
 * déjà brûlé par sa propre messagerie.
 *
 * ── POURQUOI CE MODULE EST PUR ──
 *
 * La lecture d'une URL et le rendu d'un message sont deux choses. Isoler la
 * règle la rend testable sans navigateur — et c'est la règle qui doit être
 * juste : se tromper ici affiche une erreur à quelqu'un qui vient de réussir,
 * ce qui est pire que le silence qu'on corrige.
 *
 * ⚠ ON LIT LE FRAGMENT ET LA QUERY. Supabase met l'erreur dans le fragment
 * (flux implicite) mais dans la query sur certains parcours (PKCE, liens
 * d'invitation). Ne lire qu'un des deux marche neuf fois sur dix, et c'est la
 * dixième qui rappelle.
 * ─────────────────────────────────────────────────────────────────────
 */

export type EtatLien =
  /** Rien dans l'URL : visite ordinaire. Aucun message à afficher. */
  | { type: "aucun" }
  /** L'inscrit revient de son email et la session s'ouvre. */
  | { type: "bienvenue" }
  /** Le lien a échoué. `message` est en français et dit quoi faire. */
  | { type: "erreur"; code: string; message: string };

/**
 * Les messages, par code Supabase.
 *
 * ⚠ ILS DISENT TOUS QUOI FAIRE. Un message d'erreur qui décrit l'erreur sans
 * donner l'action suivante laisse la personne exactement où elle était — dans
 * une impasse, mais informée.
 */
const MESSAGES: Record<string, string> = {
  otp_expired:
    "Ce lien de confirmation a expiré (il est valable 24 h). Demande-en un nouveau ci-dessous : " +
    "l'ancien ne fonctionnera plus, le nouveau arrivera à la même adresse.",
  access_denied:
    "Ce lien n'est plus valable — il a expiré, ou il a déjà servi. " +
    "Certains antivirus d'entreprise ouvrent les liens des emails avant toi et les consomment : " +
    "si c'est le cas, demande un nouveau lien et ouvre-le depuis ton téléphone.",
  email_not_confirmed:
    "L'adresse n'est pas encore confirmée. Le lien de confirmation est dans ta boîte — " +
    "regarde aussi les indésirables, puis demande un nouvel envoi ci-dessous.",
  server_error:
    "Le service d'authentification n'a pas répondu. Ce n'est pas ton compte : réessaie dans une minute.",
};

const REPLI =
  "La confirmation n'a pas abouti. Demande un nouveau lien ci-dessous — " +
  "ton compte existe déjà, il attend seulement d'être confirmé.";

/**
 * Décide ce qu'il faut afficher, à partir des deux moitiés de l'URL.
 *
 * @param recherche la partie `?…` (avec ou sans le `?`)
 * @param fragment  la partie `#…` (avec ou sans le `#`)
 */
export function lireLien(recherche: string, fragment: string): EtatLien {
  const params = new URLSearchParams(recherche.replace(/^\?/, ""));
  const hash = new URLSearchParams(fragment.replace(/^#/, ""));

  /**
   * ⚠ L'ERREUR PASSE AVANT LA BIENVENUE, et l'ordre est la garde.
   *
   * Un lien qui échoue redirige vers l'URL de retour — laquelle porte déjà
   * `?bienvenue=1`, puisque c'est nous qui l'avons construite. Lire la
   * bienvenue en premier ferait donc fêter l'arrivée de quelqu'un à qui on
   * vient de refuser l'entrée : le seul cas où le message est à la fois faux
   * et impossible à rattraper, puisqu'il n'y aurait plus rien à cliquer.
   */
  const code = hash.get("error_code") ?? params.get("error_code") ?? hash.get("error") ?? params.get("error");
  if (code) {
    return { type: "erreur", code, message: MESSAGES[code] ?? REPLI };
  }

  if (params.get("bienvenue") === "1" || hash.get("bienvenue") === "1") {
    return { type: "bienvenue" };
  }

  return { type: "aucun" };
}
