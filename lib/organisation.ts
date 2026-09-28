/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI PEUT VOIR LE COMPTE DE QUI — et jusqu'où.
 *
 * ══ POURQUOI CE MODULE EST LE PLUS DANGEREUX DU DÉPÔT ══
 *
 * Tout le cloisonnement des données tient à UNE chose : la RLS de Supabase
 * plus le `user_id` du JWT (`lib/tenant.ts`). Un compte ne voit que ses
 * lignes, point. Ce module ouvre délibérément une brèche dans ce mur — c'est
 * exactement ce qu'on demande quand on dit « piloter le compte du client ».
 *
 * Une brèche dans le seul mur qui existe se conçoit avant de s'écrire, pas
 * après. D'où ce fichier : la RÈGLE est ici, pure et testable ; l'exécution
 * (routes, SQL) la lit et ne la redéduit jamais.
 *
 * ══ TROIS RÔLES, ET DEUX SONT DES CLIENTS ══
 *
 *  · `maitre`      — nous. EAGLEYE. Le socle des opérations.
 *  · `responsable` — un client qui pilote des commerciaux. C'est LUI le
 *                    titulaire du contrat, c'est SON entreprise.
 *  · `membre`      — un commercial rattaché à un responsable. Un « sous-compte ».
 *
 * ══ LA DISTINCTION QUI GOUVERNE TOUT : PÉRIMÈTRE ≠ CONTENU ══
 *
 * « Voir un compte » recouvre deux choses radicalement différentes, et les
 * confondre est la faute qu'on ne rattrape pas :
 *
 *  · **L'EXPLOITATION** (`exploitation`) — combien de fiches, quel statut
 *    d'abonnement, quelle dernière activité, quelles briques ouvertes, est-ce
 *    que ça tourne. Des COMPTEURS et des ÉTATS. Aucun nom, aucun numéro,
 *    aucune adresse, aucun montant de deal.
 *
 *  · **LE CONTENU** (`contenu`) — les fiches elles-mêmes. Nom du dirigeant,
 *    téléphone, email, ce qu'il a dit au téléphone, le montant qu'on lui
 *    demande. C'est le fonds de commerce du client, et ce sont des DONNÉES
 *    PERSONNELLES DE TIERS qui n'ont jamais entendu parler de nous.
 *
 * ⚠ UN RESPONSABLE A DROIT AU CONTENU DE SES MEMBRES. C'est normal et ce
 * n'est pas une faveur : les prospects appartiennent à l'entreprise, pas au
 * commercial qui les a saisis. Un directeur commercial qui ne peut pas
 * reprendre le portefeuille d'un vendeur parti n'a pas de CRM, il a un
 * carnet privé par personne.
 *
 * ⚠⚠ NOUS, NON — ET CE N'EST PAS DE LA PRUDENCE DÉCORATIVE.
 *
 * Lire le CRM d'un client, c'est lire les nom, téléphone et email de gens qui
 * ne nous connaissent pas. Au regard du RGPD, ça fait de nous un
 * SOUS-TRAITANT de notre client (art. 28) : il faut un contrat de
 * sous-traitance écrit, une finalité déclarée, une durée, et le client doit
 * pouvoir dire non. Rien de tout ça n'existe aujourd'hui.
 *
 * Et surtout : **l'exploitation suffit à faire le travail demandé.** Le
 * support, le succès client et l'encaissement ont besoin de savoir si le
 * compte tourne, s'il consomme, s'il paie et s'il est bloqué. Aucun de ces
 * trois métiers n'a besoin du numéro de téléphone d'un prospect. Encaisser
 * avant le client se règle par Stripe Connect (`application_fee_amount`), qui
 * ne touche à aucune donnée métier.
 *
 * Le jour où l'accès au CONTENU devient nécessaire — un vrai ticket de
 * support qu'on ne peut pas résoudre autrement — il devra être : demandé,
 * consenti par le client, BORNÉ dans le temps, et JOURNALISÉ. C'est
 * `AccesContenu` plus bas, et il rend `false` par défaut.
 * ─────────────────────────────────────────────────────────────────────
 */

export type RoleCompte = "maitre" | "responsable" | "membre";

export interface CompteOrg {
  /** L'identifiant Supabase (`auth.users.id`). */
  id: string;
  role: RoleCompte;
  /**
   * Le responsable auquel ce compte est rattaché. `null` pour un maître et
   * pour un responsable.
   *
   * ⚠ UN SEUL NIVEAU DE RATTACHEMENT, ET C'EST VOULU. Un membre ne peut pas
   * avoir de membres. Autoriser une chaîne (A pilote B qui pilote C) rendrait
   * la question « qui voit quoi ? » récursive — donc impossible à vérifier
   * d'un coup d'œil, et impossible à tester exhaustivement. Une hiérarchie
   * profonde est une fonctionnalité qu'on ajoutera si un client la demande,
   * jamais « au cas où » sur le mur qui protège tout.
   */
  parentId: string | null;
}

/** Ce qu'un compte a le droit de voir d'un autre. */
export type Portee =
  /** Rien. Les deux comptes n'ont aucun lien. */
  | "aucune"
  /** Compteurs et états : ça tourne ? ça consomme ? ça paie ? */
  | "exploitation"
  /** Les fiches elles-mêmes. */
  | "contenu";

/**
 * La portée de `observateur` sur `cible`.
 *
 * ⚠ CETTE FONCTION EST LA RÈGLE ENTIÈRE. Toute route qui lit les données
 * d'un autre compte doit l'appeler et rien d'autre. Une seconde façon de
 * répondre à « ai-je le droit ? » finirait par diverger, et la divergence
 * s'appellerait « fuite ».
 */
export function porteeSur(observateur: CompteOrg, cible: CompteOrg): Portee {
  // Son propre compte : évidemment tout.
  if (observateur.id === cible.id) return "contenu";

  /**
   * ⚠ LE MAÎTRE N'A **PAS** LE CONTENU, et c'est la décision centrale de ce
   * fichier. Il voit l'exploitation de tout le monde — c'est ce qui permet le
   * support, le succès client et le suivi de la facturation. Il ne voit
   * aucune fiche.
   *
   * Écrire `return "contenu"` ici serait une ligne, et cette ligne ferait de
   * nous un sous-traitant RGPD de chacun de nos clients sans contrat, avec
   * accès aux données personnelles de tous leurs prospects. Le confort d'un
   * dépannage ne vaut pas ça.
   */
  if (observateur.role === "maitre") return "exploitation";

  /**
   * Un responsable voit le CONTENU de SES membres — les prospects sont à
   * l'entreprise, pas au commercial qui les a saisis. `parentId` doit
   * pointer sur lui : « responsable » n'est pas un laissez-passer, c'est un
   * lien vers des comptes précis.
   */
  if (observateur.role === "responsable" && cible.parentId === observateur.id) return "contenu";

  /**
   * ⚠ TOUT LE RESTE EST « AUCUNE », par défaut et sans exception, y compris
   * les cas qu'on oublie de nommer : un membre qui regarde son responsable,
   * un membre qui regarde un collègue du même responsable, un responsable qui
   * regarde le client d'à côté. Une liste de refus se laisse distancer par
   * les cas ; un refus par défaut, non.
   */
  return "aucune";
}

/** Raccourcis lisibles, pour que les routes n'aient pas à comparer des chaînes. */
export const peutVoirExploitation = (o: CompteOrg, c: CompteOrg): boolean =>
  porteeSur(o, c) !== "aucune";
export const peutVoirContenu = (o: CompteOrg, c: CompteOrg): boolean =>
  porteeSur(o, c) === "contenu";

/**
 * ── QUI PEUT CRÉER UN SOUS-COMPTE ──
 *
 * ⚠ PAS LE MAÎTRE, et ce refus est délibéré. Nous pourrions techniquement
 * créer un membre sous n'importe quel client. Mais un compte créé par nous
 * sous le nom d'un client est un compte dont le client ignore l'existence —
 * et c'est exactement la forme qu'aurait une porte dérobée. Si un client veut
 * un commercial de plus, il le crée ; si nous le faisons pour lui pendant un
 * accompagnement, ça se fait DEPUIS SON COMPTE, avec lui.
 *
 * ⚠⚠ ET PAS UN MEMBRE : sinon un commercial se fabrique ses propres
 * sous-comptes et la hiérarchie plate décrite plus haut n'en est plus une.
 */
export function peutCreerSousCompte(compte: CompteOrg): boolean {
  return compte.role === "responsable";
}

/**
 * ── L'ACCÈS AU CONTENU PAR LE SUPPORT — la porte qui n'est pas encore ouverte
 *
 * Elle existe ici pour une raison précise : quand le besoin se présentera, il
 * se présentera un mardi soir, avec un client au téléphone et une envie de
 * faire vite. C'est le pire moment pour concevoir une exception. Elle est donc
 * conçue maintenant, et elle rend `false`.
 *
 * Les quatre conditions, et elles sont cumulatives :
 *  1. le client a **consenti** explicitement, depuis son compte ;
 *  2. le consentement porte une **date de fin** — un accès permanent n'est
 *     pas un dépannage, c'est un abonnement à ses données ;
 *  3. l'accès est **journalisé** — qui, quand, quoi ;
 *  4. un **contrat de sous-traitance** (art. 28 RGPD) existe avec ce client.
 *
 * La quatrième ne se code pas : elle se signe. C'est pour ça que la fonction
 * la prend en paramètre au lieu de la supposer — pour qu'on ne puisse pas
 * l'oublier en croyant que le code s'en occupe.
 */
export interface AccesContenu {
  /** Le client a-t-il ouvert l'accès depuis SON compte ? */
  consenti: boolean;
  /** Jusqu'à quand (ISO). Un accès sans terme n'en est pas un. */
  expireLe: string | null;
  /** Un contrat de sous-traitance RGPD est-il signé avec ce client ? */
  contratSousTraitance: boolean;
}

export function accesContenuAutorise(
  observateur: CompteOrg,
  cible: CompteOrg,
  acces: AccesContenu | null,
  maintenant: Date = new Date()
): boolean {
  // Le chemin normal reste le chemin normal : si la portée donne déjà le
  // contenu (soi-même, ou son propre membre), il n'y a pas d'exception à
  // demander.
  if (porteeSur(observateur, cible) === "contenu") return true;

  // L'exception n'existe que pour NOUS, et seulement vers un client.
  if (observateur.role !== "maitre") return false;
  if (!acces) return false;
  if (!acces.consenti || !acces.contratSousTraitance) return false;

  /**
   * ⚠ IL Y AVAIT ICI DEUX GARDES DE PLUS, ET LES DEUX ÉTAIENT MORTS.
   *
   * `if (!acces.expireLe) return false;` puis `if (Number.isNaN(fin)) return
   * false;`. Retirés l'un après l'autre par mutation : aucun test ne bougeait,
   * ni pour une date absente, ni pour une date illisible.
   *
   * La raison est dans la comparaison finale, et elle mérite d'être écrite
   * parce qu'elle est contre-intuitive : **toute comparaison avec `NaN` rend
   * `false`**. `Date.parse(null)` et `Date.parse("pas une date")` rendent
   * `NaN`, donc `fin > maintenant` rend `false`, donc l'accès est refusé.
   * Le refus est déjà là ; les deux `if` ne faisaient que le répéter.
   *
   * ⚠⚠ POURQUOI ON LES RETIRE AU LIEU DE LES GARDER « PAR SÉCURITÉ ».
   * Un garde qui ne garde rien coûte plus qu'il ne rapporte : il fait croire
   * à une protection, et le jour où le garde VIVANT est modifié — ici, si
   * quelqu'un inversait la comparaison — les tests qui « couvraient » les
   * gardes morts continueraient de passer. C'est le piège nommé dans la
   * doctrine : asserter la PRÉSENCE d'un refus au lieu de la CONDITION qui y
   * mène. On garde donc la condition qui décide, et on écrit pourquoi elle
   * suffit — ce commentaire remplace les deux `if`, et il protège mieux.
   *
   * (Corollaire, pour qui relira : ne pas « corriger » ce code en rajoutant
   * un test de validité de date. Il ne changerait aucun comportement.)
   */
  return Date.parse(acces.expireLe ?? "") > maintenant.getTime();
}

/**
 * ── CE QUE L'EXPLOITATION A LE DROIT DE CONTENIR ──
 *
 * ⚠ UNE LISTE BLANCHE, PAS UNE LISTE NOIRE. Décrire ce qu'on retire d'une
 * fiche condamne à se souvenir de chaque champ ajouté ensuite : le jour où
 * quelqu'un ajoute `telephoneDirect` à `Prospect`, une liste noire le laisse
 * passer et personne ne le voit. On énumère ce qui SORT, et tout le reste est
 * refusé par construction.
 *
 * Aucune de ces clés ne peut identifier une personne : ce sont des comptes,
 * des dates et des états.
 */
export const CHAMPS_EXPLOITATION = [
  "tenantId",
  "role",
  "parentId",
  "nbFiches",
  "nbFichesSignees",
  "derniereActivite",
  "briques",
  "statutAbonnement",
  "membres",
] as const;

export type ChampExploitation = (typeof CHAMPS_EXPLOITATION)[number];

/** Une vue d'exploitation — ce que le maître (ou un responsable) peut lire. */
export type VueExploitation = Partial<Record<ChampExploitation, unknown>>;

/**
 * Filtre un objet quelconque pour n'en garder que l'exploitation.
 *
 * ⚠ C'est le dernier filet, et il doit exister même quand l'appelant croit
 * bien faire : une requête SQL qui sélectionne trop, un `select *` ajouté
 * pendant un débogage et jamais retiré. Le filtre est en SORTIE parce que
 * c'est le seul endroit par lequel tout passe.
 */
export function filtrerExploitation(brut: Record<string, unknown>): VueExploitation {
  const vue: VueExploitation = {};
  for (const champ of CHAMPS_EXPLOITATION) {
    if (champ in brut) vue[champ] = brut[champ];
  }
  return vue;
}
