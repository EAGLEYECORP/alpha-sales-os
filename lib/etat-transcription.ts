/**
 * ─────────────────────────────────────────────────────────────────────
 * « PAS CONFIGURÉ » ET « PAS LE DROIT » NE SE DISENT PAS PAREIL.
 *
 * ══ LE DÉFAUT, MESURÉ LE 17/09/2026 ══
 *
 * `/debrief` interroge `GET /api/transcribe` au chargement pour savoir si la
 * dictée serveur est disponible, et lit la réponse ainsi :
 *
 *     .then((d) => setServerASR(Boolean(d.configured)))
 *
 * Or `/debrief` est gardé par la brique **`closer`, qui est GRATUITE**, tandis
 * que `/api/transcribe` est classée sur `/voice`, donc sur **`alpha-voice`,
 * qui est PAYANTE et exclue de l'essai**. Un compte gratuit ou en essai reçoit
 * donc un **403 `{ error, code: "brique_absente" }`** — pas un rapport.
 *
 * `d.configured` vaut alors `undefined`, `Boolean(undefined)` vaut `false`, et
 * l'écran annonce « la transcription serveur n'est pas branchée ». C'est
 * FAUX, et la fausseté coûte cher dans le détail : on envoie l'opérateur
 * poser `DEEPGRAM_API_KEY` — **une variable de NOTRE environnement serveur,
 * à laquelle il n'a aucun accès**. Il cherchera un réglage qui n'existe pas
 * pour lui, au lieu de lire « cette brique se paie ».
 *
 * ⚠ C'est la même famille que le bug de `/demarrage` (« undefined
 * enregistrement(s) DNS manquant(s) ») : `r.json()` rend `any`, donc rien
 * n'arrête une réponse d'une autre forme — ni le compilateur, ni les tests.
 * Le dépôt a déjà répondu à ça une fois, avec `lireRapportDns` ; ce module
 * applique le même remède à la même maladie.
 *
 * ══ POURQUOI LA CLASSIFICATION NE CHANGE PAS ══
 *
 * Le réflexe serait de reclasser `/api/transcribe` sur `/debrief` pour que le
 * gratuit y ait droit. **Non** : la transcription est facturée à la minute
 * chez Deepgram ou Whisper, sur NOTRE clé. L'ouvrir au gratuit reviendrait à
 * « donner notre carte de crédit à des inconnus », ce que la doctrine refuse
 * explicitement. Elle reste payante ; c'est le MESSAGE qui était faux, pas le
 * classement.
 *
 * ⚠ Et c'est le schéma déjà assumé de `/controle`, qui affiche le lanceur de
 * campagnes à un gratuit : « voir la porte fermée vaut mieux que ne pas savoir
 * qu'elle existe ». À condition que la porte dise pourquoi elle est fermée.
 * ─────────────────────────────────────────────────────────────────────
 */

export type EtatTranscription =
  /** Une clé est en place côté serveur : la dictée marche. */
  | "prete"
  /** Le droit est là, mais aucun fournisseur n'est branché. C'est à NOUS de le poser. */
  | "non-configuree"
  /** La brique n'est pas incluse dans cette offre. Rien à configurer, c'est un achat. */
  | "brique-absente"
  /**
   * La réponse n'a aucune des formes attendues.
   *
   * ⚠ Cet état existe pour ne JAMAIS interpoler `undefined` à l'écran. Il vaut
   * mieux dire « je ne sais pas lire la réponse » que d'afficher une phrase
   * construite sur un champ absent — c'est exactement ce qui a produit
   * « undefined enregistrement(s) DNS manquant(s) » en production.
   */
  | "illisible";

/**
 * Traduit une réponse de `GET /api/transcribe` en état lisible.
 *
 * ⚠ LE STATUT HTTP EST UN ARGUMENT, ET IL EST OBLIGATOIRE. C'est lui qui porte
 * l'information que le corps ne porte pas : un 403 n'a pas de champ
 * `configured`, et un corps sans `configured` n'est pas forcément un refus.
 * Les distinguer demande les deux. Un lecteur qui ne prendrait que le JSON
 * reproduirait le bug qu'il est censé corriger.
 */
export function lireEtatTranscription(statut: number, corps: unknown): EtatTranscription {
  /**
   * ⚠ LE STATUT SUFFIT, ET ON NE LIT PAS LE `code`.
   *
   * J'avais d'abord écrit une condition sur `code === "brique_absente"` — et
   * ses deux branches rendaient la même valeur. Du code mort déguisé en
   * prudence.
   *
   * Le raisonnement juste : un 403 sur cette route est un refus d'accès, quel
   * que soit le libellé que le middleware y met. Exiger un code précis ferait
   * retomber un middleware modifié dans « illisible » — donc dans un message
   * PLUS VAGUE que celui qu'on sait déjà donner. On perdrait de l'information
   * en croyant être rigoureux.
   */
  if (statut === 403) return "brique-absente";
  if (statut < 200 || statut >= 300) return "illisible";
  if (typeof corps !== "object" || corps === null) return "illisible";
  const configured = (corps as { configured?: unknown }).configured;
  if (typeof configured !== "boolean") return "illisible";
  return configured ? "prete" : "non-configuree";
}

/**
 * Ce qu'on AFFICHE, par état. Rendu ici plutôt que dans l'écran : deux écrans
 * liront cette route le jour où la dictée servira ailleurs, et deux
 * formulations divergeraient — c'est celle qu'on ne relit pas qui mentirait.
 *
 * ⚠ `null` pour « prête » : quand ça marche, on ne dit rien. Un bandeau
 * permanent « tout va bien » est un bandeau qu'on cesse de lire.
 */
export function phraseTranscription(etat: EtatTranscription): string | null {
  switch (etat) {
    case "prete":
      return null;
    case "non-configuree":
      return "Dictée serveur indisponible : aucun fournisseur de transcription n'est branché côté serveur. La reconnaissance du navigateur reste utilisable.";
    case "brique-absente":
      return "La dictée serveur fait partie d'Alpha Voice, qui n'est pas incluse dans ton offre — la transcription se facture à la minute. La reconnaissance vocale de ton navigateur reste utilisable, et elle est gratuite.";
    case "illisible":
      return "Dictée serveur : état indéterminé. Utilise la reconnaissance du navigateur en attendant.";
  }
}
