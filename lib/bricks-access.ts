/**
 * ─────────────────────────────────────────────────────────────────────
 * QUELLE BRIQUE OUVRE QUELLE PORTE.
 *
 * ── LE PASSAGE À L'ÉCHELLE ──
 *
 * Jusqu'ici Alpha Sales OS était l'outil d'UN opérateur. Pour le vendre à la
 * carte, il faut que le compte d'un client n'ouvre QUE ce qu'il a payé — et
 * que notre propre usage (EAGLEYE) reste séparé de celui des clients.
 *
 * La doctrine maison dit « il ne voit QUE sa brique ; nous voyons tout ».
 * Elle était écrite dans CLAUDE.md et sur la vitrine, et NULLE PART dans le
 * code : `grep ownedBricks` ne renvoyait rien. Un client à qui on donnait un
 * compte voyait toute l'app.
 *
 * ── CE MODULE EST UNE CARTE, PAS UNE SERRURE ──
 *
 * Il dit seulement quelle brique gouverne quel chemin. Il ne décide de rien :
 * la décision est prise côté serveur (`lib/entitlements.ts` + middleware), là
 * où elle ne peut pas être contournée. Cette carte, elle, est publique par
 * nature — savoir que `/cerveau` appartient à la brique « cerveau » n'ouvre
 * aucune porte.
 *
 * ── LA RÈGLE QUI ÉVITE LE TROU ──
 *
 * Une page ABSENTE de cette carte est REFUSÉE, pas autorisée. C'est l'inverse
 * du réflexe, et c'est le seul choix tenable : on ajoute des pages sans y
 * penser, et une page oubliée en mode « autorisé par défaut » est une fuite
 * qui ne se voit jamais. Un test refuse toute page non classée.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Les briques du catalogue, telles qu'elles gouvernent l'accès. */
export type BrickId =
  | "alpha-voice"
  | "campagnes"
  | "cerveau"
  | "crm"
  | "audits"
  | "tracking"
  | "alpha-live"
  | "closer"
  | "agent-alpha"
  | "pilotage";

/**
 * Chemins ouverts à TOUT compte authentifié, quelle que soit sa brique.
 *
 * Le strict nécessaire pour qu'un compte existe et se gère lui-même. Un client
 * qui ne peut pas voir sa facture ni se déconnecter n'est pas un client, c'est
 * un otage.
 */
export const CHEMINS_COMMUNS = [
  "/", // l'accueil s'adapte à ce qu'on possède
  "/login",
  "/compte",
  "/settings",
  /**
   * ⚠ LA PAGE QUI EXPLIQUE POURQUOI UNE BRIQUE EST FERMÉE DOIT ÊTRE OUVERTE.
   *
   * Elle ne montre aucune donnée : le nom de la brique, la raison technique
   * pour laquelle elle est payante, et l'offre qui l'ouvre — trois choses
   * déjà publiques sur la page de vente. La ranger derrière la brique
   * qu'elle explique serait la boucle parfaite : on ne peut savoir pourquoi
   * c'est fermé qu'en l'ayant déjà acheté.
   */
  "/offre-brique",
  "/demarrage",
  /**
   * Les prompts sont un réglage de la MACHINE, pas une brique vendue : ils
   * décident de ce que l'IA a le droit de dire pour ce compte. Les ouvrir à
   * tout compte authentifié suit la même logique que `/settings` — sauf que la
   * route qui sert les TEXTES, elle, reste réservée au compte maître
   * (`/api/prompts` : la doctrine récite les taux du portefeuille). L'écran
   * s'ouvre donc pour tous, et il dit franchement à un non-maître qu'il ne
   * peut rien y lire, au lieu de renvoyer un 404 incompréhensible.
   */
  "/prompts",
];

/**
 * La carte. Une entrée par page de l'app.
 *
 * Plusieurs briques possibles : la page s'ouvre si le compte en possède AU
 * MOINS UNE. C'est le cas de la salle de contrôle, qui agrège — la refuser à
 * qui possède une seule brique serait absurde.
 */
export const ACCES_PAR_CHEMIN: Record<string, BrickId[]> = {
  /**
   * ── ALPHA CEO — MAÎTRE SEUL, et le raisonnement n'est pas le confort ──
   *
   * ⚠ `[]` = aucune brique ne l'achète. C'est une console d'EXPLOITATION de
   * NOTRE déploiement : elle dit si le SMTP délivre, si les prix Stripe sont
   * branchés, si une migration manque. Rien de tout ça n'appartient au
   * client — il n'existe aucun chemin d'identifiants par locataire, donc ces
   * réglages sont les nôtres et lui seraient incompréhensibles.
   *
   * ⚠⚠ ET ELLE SE MASQUE, ELLE NE SE GRISE PAS (`lib/verrous.ts`) : griser,
   * c'est annoncer. Montrer à un client une porte « Alpha CEO » l'inviterait
   * à demander ce qu'on y voit de son compte — alors que la réponse est
   * « rien de personnel », mais qu'il faudrait la donner à chaque fois.
   *
   * Ce qui LE concerne — son stockage, ses brouillons, ses fiches sans
   * prochaine action — vit déjà sur ses écrans : `/controle`, `/aujourdhui`,
   * et le bandeau de stockage monté dans la coquille.
   */
  "/ceo": [],
  // ── CRM & Pipeline : le socle de la vente ──
  "/pipeline": ["crm"],
  "/prospects": ["crm"],
  "/aujourdhui": ["crm"],
  "/decisions": ["crm"],
  "/meetings": ["crm"],
  "/nurture": ["crm"],
  "/prescripteurs": ["crm"],
  "/milestones": ["crm"],

  // ── Alpha Voice : l'agent vocal ──
  "/voice": ["alpha-voice"],
  "/appels": ["alpha-voice"],

  // ── Campagnes & outreach ──
  "/campaigns": ["campagnes"],
  "/outbox": ["campagnes"],
  "/templates": ["campagnes"],
  "/newsletter": ["campagnes"],
  "/linkedin": ["campagnes"],
  "/social": ["campagnes"],

  // ── Le Cerveau (RAG) ──
  "/cerveau": ["cerveau"],
  "/intel": ["cerveau"],

  // ── Audits automatisés ──
  "/audits": ["audits"],

  // ── Tracking & délivrabilité ──
  "/activity": ["tracking"],
  "/recette": ["tracking"],

  // ── Alpha Live : le souffleur en direct ──
  "/overlay": ["alpha-live"],

  // ── Closer OS & débrief ──
  "/closer": ["closer"],
  "/debrief": ["closer"],

  // ── Agent ALPHA : le copilote ──
  "/agent": ["agent-alpha"],

  // ── Salle de contrôle & KPIs : agrège, donc ouvert dès une brique ──
  "/controle": ["pilotage", "crm"],
  "/kpis": ["pilotage"],
  "/pilote": ["pilotage"],
  "/preuves": ["pilotage"],
  "/trajectoire": ["pilotage"],

  // ── Économie de NOTRE portefeuille : jamais un client ──
  // Payouts et /offre parlent de commissions et de coûts entre nous et nos
  // partenaires. Aucune brique ne les ouvre : seul le compte MAÎTRE y accède.
  "/payouts": [],
  "/offre": [],

  /**
   * NOS JEUX DE DONNÉES RÉELS — protégés par le middleware, et désormais
   * classés ici de façon COHÉRENTE avec lui.
   *
   * `/api/pipeline` sert `lib/pipeline-juillet` (78 prospects réellement
   * démarchés : raison sociale, adresse, numéro de téléphone, étape de vente,
   * montant) et `lib/prospects-icp`. Ce ne sont pas des fiches de démo — le
   * module le dit en tête.
   *
   * ⚠ CE N'EST PAS UN TROU QU'ON BOUCHE : `MAITRE_SEULEMENT` (middleware.ts)
   * liste déjà `/api/pipeline` et refuse 403 à tout compte non maître, AVANT
   * le contrôle par brique. La route a toujours été fermée.
   *
   * Ce qui était faux, c'est la CLASSIFICATION : `CHEMIN_PAR_API` rattachait
   * cette route à `/pipeline`, donc à la brique `crm` — devenue gratuite le
   * 02/09/2026. Les deux couches répondaient donc l'inverse l'une de l'autre à
   * la même question, et seule la plus haute disait vrai. Le jour où quelqu'un
   * allège `MAITRE_SEULEMENT` — ce qui est un geste anodin, la liste ressemble
   * à une optimisation — la couche restante ouvrait la route à tous les
   * inscrits. Une défense qui ne tient que parce qu'une AUTRE tient n'est pas
   * une défense en profondeur, c'est un point unique déguisé en deux.
   *
   * Aucune brique n'ouvre ce chemin : les deux couches disent maintenant la
   * même chose.
   */
  "/jeux-internes": [],
};

/**
 * La brique qui gouverne un chemin, ou `null` si le chemin est commun.
 * `undefined` = chemin NON CLASSÉ → à refuser (voir l'en-tête).
 */
export function briquesPourChemin(pathname: string): BrickId[] | null | undefined {
  const chemin = normaliser(pathname);
  if (CHEMINS_COMMUNS.includes(chemin)) return null;
  return ACCES_PAR_CHEMIN[chemin];
}

/**
 * Réduit un chemin à son segment de tête.
 *
 * `/prospects/abc-123/edit` → `/prospects`. Sans ça, chaque fiche serait un
 * chemin non classé, donc refusée — et l'app deviendrait inutilisable pour
 * tout le monde. Le piège inverse existe aussi : ne PAS normaliser laisserait
 * passer `/cerveau/quelquechose` si on avait choisi l'autorisation par défaut.
 */
export function normaliser(pathname: string): string {
  const p = (pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
  if (p === "/") return "/";
  const tete = p.split("/")[1] ?? "";
  return "/" + tete;
}

/**
 * Ce compte peut-il ouvrir ce chemin ?
 *
 * `maitre` : notre compte EAGLEYE. Il voit tout, par définition — c'est nous
 * qui vendons. C'est le SEUL contournement, et il est explicite.
 */
export function peutOuvrir(chemin: string, possedees: readonly string[], maitre = false): boolean {
  if (maitre) return true;
  const requises = briquesPourChemin(chemin);
  if (requises === null) return true; // chemin commun
  if (requises === undefined) return false; // non classé → refusé
  if (requises.length === 0) return false; // réservé au maître
  return requises.some((b) => possedees.includes(b));
}
