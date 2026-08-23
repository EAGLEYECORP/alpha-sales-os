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
  "/demarrage",
];

/**
 * La carte. Une entrée par page de l'app.
 *
 * Plusieurs briques possibles : la page s'ouvre si le compte en possède AU
 * MOINS UNE. C'est le cas de la salle de contrôle, qui agrège — la refuser à
 * qui possède une seule brique serait absurde.
 */
export const ACCES_PAR_CHEMIN: Record<string, BrickId[]> = {
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
