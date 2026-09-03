import type { NextRequest } from "next/server";
import { getTenant } from "./tenant";
import { peutOuvrir, type BrickId } from "./bricks-access";
import { serverAuthEnforced } from "./supabase-jwt";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES DROITS D'UN COMPTE — la serrure, côté serveur.
 *
 * `lib/bricks-access.ts` dit quelle brique ouvre quelle porte. Ce module dit
 * QUI possède quoi, et il le dit là où le navigateur ne peut pas mentir.
 *
 * ── POURQUOI ÇA NE PEUT PAS ÊTRE CÔTÉ CLIENT ──
 *
 * Une navigation filtrée dans le navigateur est un CONFORT, jamais une
 * sécurité : le client tape l'URL, ou lit le JavaScript — qui est
 * téléchargeable, `_next/static/**` étant exclu du middleware. La seule
 * barrière réelle est ici : le middleware refuse la page, et chaque route API
 * refuse la donnée. Une page bloquée dont l'API répond ne protège rien.
 *
 * ── LES DEUX ÉCHECS QUI N'ONT RIEN À VOIR ──
 *
 * C'est LA subtilité de ce module, et celle qui casse un produit si on la rate.
 *
 *  · NON CONFIGURÉ (pas de Supabase, pas de JWT) → mode SOLO. L'opérateur est
 *    maître, tout est ouvert. C'est l'usage d'aujourd'hui : Alpha Sales OS
 *    tourne en local pour une seule personne. Refuser ici transformerait un
 *    outil qui marche en écran de connexion vide.
 *
 *  · CONFIGURÉ MAIS LECTURE ÉCHOUÉE (base injoignable, ligne absente) →
 *    SOCLE GRATUIT, jamais plus. Un droit PAYANT qu'on ne peut pas prouver
 *    n'existe pas — ouvrir le payant « parce que la base ne répond pas » est
 *    exactement la panne qu'un attaquant provoque. Mais refuser TOUT était
 *    juste seulement tant que les comptes étaient provisionnés à la main :
 *    depuis que l'inscription est libre, un compte neuf n'a aucune ligne, et
 *    le mur serait l'accueil de tous les nouveaux arrivants.
 *
 * Confondre les deux donne soit un produit inutilisable, soit une passoire.
 *
 * ⚠ L'INVARIANT QUI TIENT TOUT : on ne descend jamais sous le GRATUIT, on ne
 * monte jamais au-dessus sans une ligne prouvée en base. Une panne dégrade
 * donc un payant en gratuit — ennuyeux et visible ; l'inverse serait invisible
 * et coûteux.
 * ─────────────────────────────────────────────────────────────────────
 */

export type StatutCompte = "essai" | "actif" | "suspendu";

export interface Entitlement {
  tenantId: string | null;
  /** Les briques réellement payées. Vide = aucun accès métier. */
  bricks: BrickId[];
  statut: StatutCompte;
  /** Fin d'essai (ISO). Passée, l'essai vaut « suspendu ». */
  essaiJusquA?: string;
  /**
   * Notre compte à nous. Il voit tout : c'est nous qui vendons l'OS, et c'est
   * depuis là qu'on provisionne les comptes clients.
   */
  maitre: boolean;
  /**
   * `true` quand aucun système de comptes n'est configuré (usage solo).
   * Distinct de `maitre` : l'un est un mode, l'autre est un rôle.
   */
  solo: boolean;
}

/** Le droit du mode solo : tout ouvert, parce qu'il n'y a personne d'autre. */
export const DROIT_SOLO: Entitlement = {
  tenantId: null,
  bricks: [],
  statut: "actif",
  maitre: true,
  solo: true,
};

/** Le refus. Aucun droit, aucune brique — utilisé quand il n'y a pas de session. */
export const DROIT_REFUSE: Entitlement = {
  tenantId: null,
  bricks: [],
  statut: "suspendu",
  maitre: false,
  solo: false,
};

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SOCLE GRATUIT — ce qu'on ouvre à quiconque crée un compte.
 *
 * ── LA LIGNE, ET CE QUI LA DÉCIDE ──
 *
 * Elle n'est PAS un arbitrage commercial : elle est imposée par un fait
 * technique qu'il faut écrire, parce qu'il gouverne tout le reste.
 *
 * `/api/send` lit `SMTP_HOST/USER/PASS` dans l'ENVIRONNEMENT DU SERVEUR.
 * `/api/voice/call` lit `LIVEKIT_URL/API_KEY/API_SECRET`, idem. Il n'existe
 * aujourd'hui AUCUN chemin d'identifiants par locataire. Autrement dit :
 * chaque email part du domaine de l'éditeur et brûle SA réputation ; chaque
 * appel consomme SES minutes.
 *
 * Donc : tout ce qui SORT de la machine est payant, non par choix de
 * monétisation mais parce que l'ouvrir gratuitement reviendrait à offrir à
 * des inconnus une carte de crédit et un nom de domaine. Le jour où les
 * identifiants deviennent par locataire, cette contrainte tombe et la ligne
 * pourra se rediscuter — pas avant.
 *
 * ── CE QUE ÇA DONNE, ET POURQUOI C'EST UN VRAI PRODUIT ──
 *
 * GRATUIT = tes données, ton organisation. Un CRM complet, le Closer OS de
 * terrain, le Cerveau, et les tableaux de bord — tout ce qui tourne sur SES
 * données sans rien dépenser chez nous. C'est utilisable seul, tous les
 * jours, indéfiniment. Un gratuit qui ne sert à rien ne convertit personne.
 *
 * PAYANT = la machine agit à ta place. Envoyer, appeler, tracer, rédiger,
 * souffler en direct. C'est exactement la frontière du coût, donc elle est
 * facile à défendre en vente : « tant que ça reste chez toi, c'est gratuit ».
 *
 * ⚠ `/controle` s'ouvre au gratuit (il agrège CRM + pilotage) et affiche donc
 * le lanceur de campagnes. Le bouton existe, le serveur refuse (403
 * `brique_absente`). C'est délibéré : voir la porte fermée vaut mieux que ne
 * pas savoir qu'elle existe — et la sécurité ne dépend pas de l'écran.
 * ─────────────────────────────────────────────────────────────────────
 */
export const BRIQUES_GRATUITES: readonly BrickId[] = ["crm", "closer", "cerveau", "pilotage"];

/**
 * Le droit d'un compte créé librement, sans ligne en base et sans paiement.
 *
 * `statut: "actif"` et non `"essai"` : le gratuit n'expire pas. Un essai qui
 * se referme au bout de 14 jours n'est pas un freemium, c'est une démo — et
 * ça se voit dans les chiffres de rétention.
 */
export const DROIT_GRATUIT: Entitlement = {
  tenantId: null,
  bricks: [...BRIQUES_GRATUITES],
  statut: "actif",
  maitre: false,
  solo: false,
};

/** Le socle gratuit, attaché à un compte réel. */
export function droitGratuit(tenantId: string): Entitlement {
  return { ...DROIT_GRATUIT, bricks: [...BRIQUES_GRATUITES], tenantId };
}

/** Le système de comptes est-il actif sur ce déploiement ? */
export function comptesActifs(): boolean {
  return Boolean(process.env.SUPABASE_JWT_SECRET && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA SERRURE DE REMPLACEMENT EST-ELLE RÉELLEMENT EN PLACE ?
 *
 * ⚠ C'EST LA QUESTION LA PLUS DANGEREUSE DU DÉPÔT, ET ELLE ÉTAIT POSÉE À DEUX
 * ENDROITS.
 *
 * `middleware.ts` la posait chez lui (`verrouDeComptesActif`) pour décider si
 * `SITE_PASSWORD` mure encore toute l'application. Dès qu'un deuxième
 * appelant en a eu besoin — l'écran de connexion, qui doit savoir si le
 * SERVEUR exige un compte — la recopier aurait créé deux réponses possibles
 * à « l'app est-elle protégée ? ». Le jour où elles divergent, l'une des deux
 * ouvre tout.
 *
 * Une seule définition, ici, importée des deux côtés.
 *
 * Les deux moitiés sont OPT-IN et doivent l'être : sans elles, il n'existe
 * aucune autre serrure et `/api/send` enverrait de vrais emails à n'importe
 * qui. Tant qu'elles ne sont pas toutes les deux vraies, le mot de passe
 * continue de tout garder — c'est le comportement par défaut, et il protège.
 * ─────────────────────────────────────────────────────────────────────
 */
export function verrouDeComptesActif(): boolean {
  return comptesActifs() && serverAuthEnforced();
}

/** Emails du compte MAÎTRE (le nôtre), séparés par des virgules. */
function emailsMaitres(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Un email est-il le nôtre ?
 *
 * Deux formes acceptées : l'adresse exacte, ou `@domaine` pour tout un
 * domaine. Une entrée vide ne matche rien — sans cette garde, une variable
 * d'environnement mal remplie donnerait le compte maître à tout le monde.
 */
export function estMaitre(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  return emailsMaitres().some((m) => (m.startsWith("@") ? e.endsWith(m) : e === m));
}

/** Un essai expiré vaut suspension : le droit suit la DATE, pas le statut écrit. */
export function statutEffectif(ent: Entitlement, now: Date = new Date()): StatutCompte {
  if (ent.statut !== "essai") return ent.statut;
  if (!ent.essaiJusquA) return "essai";
  return new Date(ent.essaiJusquA).getTime() < now.getTime() ? "suspendu" : "essai";
}

/**
 * La décision finale : ce compte peut-il ouvrir ce chemin, maintenant ?
 *
 * Pure et testable — elle ne lit ni base ni requête. C'est ce qui permet de la
 * vérifier sans monter l'app, et c'est elle que le middleware ET les routes
 * API appellent, pour qu'il n'existe qu'UNE règle.
 */
export function autorise(ent: Entitlement, chemin: string, now: Date = new Date()): boolean {
  if (ent.solo) return true;
  // Un compte suspendu garde l'accès aux chemins COMMUNS : il doit pouvoir se
  // connecter, voir pourquoi il est bloqué, et payer. L'enfermer dehors ne
  // récupère aucun impayé.
  const suspendu = statutEffectif(ent, now) === "suspendu";
  /**
   * ⚠ Un impayé retombe au SOCLE GRATUIT, pas au néant.
   *
   * Avant, il ne gardait que les chemins communs : plus de pipeline, plus de
   * fiches, plus rien. Or ses données sont toujours là et lui appartiennent.
   * Le mettre dehors ne récupère aucun impayé — ça fabrique un ancien client
   * en colère qui ne peut même pas exporter son CRM. Il perd ce qui coûte
   * (envoyer, appeler, tracer), il garde ce qui ne coûte rien.
   */
  /**
   * ⚠ Le repli gratuit n'appartient qu'à un compte QUI EXISTE.
   *
   * Trouvé en une assertion : `DROIT_REFUSE` porte lui aussi
   * `statut: "suspendu"`, et sans ce discriminant il héritait du socle — donc
   * une requête SANS AUCUNE SESSION ouvrait `/pipeline`. Le statut ne
   * distingue pas « client en retard de paiement » de « personne ». Le
   * locataire, si : pas de `tenantId`, pas de session, pas de plancher.
   */
  const compteReel = Boolean(ent.tenantId);
  if (suspendu) {
    if (ent.maitre) return true;
    return peutOuvrir(chemin, compteReel ? BRIQUES_GRATUITES : [], false);
  }
  return peutOuvrir(chemin, ent.bricks, ent.maitre);
}

/** Les briques connues — pour valider ce qui vient de la base. */
const BRIQUES_CONNUES: readonly string[] = [
  "alpha-voice", "campagnes", "cerveau", "crm", "audits",
  "tracking", "alpha-live", "closer", "agent-alpha", "pilotage",
];

/** Nettoie une liste venue de la base : on n'accorde jamais un droit inconnu. */
export function normaliserBriques(brut: unknown): BrickId[] {
  if (!Array.isArray(brut)) return [];
  return brut.filter((b): b is BrickId => typeof b === "string" && BRIQUES_CONNUES.includes(b));
}

/**
 * Résout les droits de la requête courante.
 *
 * Ordre volontaire :
 *  1. comptes non configurés → SOLO (l'usage d'aujourd'hui reste intact) ;
 *  2. pas de session valide → REFUS ;
 *  3. notre email → MAÎTRE (aucune lecture de base nécessaire : si la base
 *     tombe, on doit encore pouvoir entrer chez nous) ;
 *  4. sinon → lecture des droits ; toute erreur = REFUS.
 */
export async function resoudreDroits(req: NextRequest): Promise<Entitlement> {
  if (!comptesActifs()) return DROIT_SOLO;

  const tenant = await getTenant(req);
  if (!tenant?.id) return DROIT_REFUSE;

  if (estMaitre(tenant.email)) {
    return { tenantId: tenant.id, bricks: [], statut: "actif", maitre: true, solo: false };
  }

  /**
   * ─────────────────────────────────────────────────────────────────────
   * L'INVARIANT DE TOUT CE QUI SUIT :
   *   on ne descend JAMAIS sous le gratuit, on ne monte JAMAIS au-dessus
   *   sans une ligne prouvée en base.
   *
   * ⚠ CE QUI A CHANGÉ, ET POURQUOI CE N'EST PAS UN RELÂCHEMENT.
   *
   * Avant, chacun de ces chemins rendait `DROIT_REFUSE` : pas de ligne, pas
   * de service role, base injoignable → porte close. C'était juste tant que
   * les comptes étaient PROVISIONNÉS À LA MAIN par nous. Ça ne l'est plus :
   * l'inscription est libre, et un compte tout neuf n'a évidemment aucune
   * ligne. Le refuser, c'est accueillir chaque nouvel arrivant par un mur.
   *
   * Le repli devient donc le SOCLE GRATUIT — et il est sûr, parce qu'il ne
   * contient aucune brique qui dépense chez nous (cf. `BRIQUES_GRATUITES`).
   * Une base en panne dégrade un client payant en client gratuit : c'est
   * ennuyeux et visible, là où l'inverse — accorder du payant sans preuve —
   * serait invisible et coûteux.
   * ─────────────────────────────────────────────────────────────────────
   */
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Service role absent : on ne PEUT pas lire les droits. Configuration
  // incomplète — donc gratuit, jamais plus.
  if (!url || !key) return droitGratuit(tenant.id);

  try {
    const r = await fetch(
      `${url}/rest/v1/entitlements?select=bricks,statut,essai_jusqu_a&tenant_id=eq.${encodeURIComponent(tenant.id)}&limit=1`,
      { headers: { apikey: key, authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    if (!r.ok) return droitGratuit(tenant.id);
    const lignes = (await r.json()) as { bricks?: unknown; statut?: string; essai_jusqu_a?: string }[];
    const l = lignes[0];
    // Aucune ligne = compte créé librement et jamais payé. C'est le cas
    // NORMAL depuis que l'inscription est ouverte, plus une anomalie : il
    // reçoit le socle gratuit.
    if (!l) return droitGratuit(tenant.id);

    const statut: StatutCompte =
      l.statut === "actif" || l.statut === "essai" || l.statut === "suspendu" ? l.statut : "suspendu";

    return {
      tenantId: tenant.id,
      bricks: normaliserBriques(l.bricks),
      statut,
      essaiJusquA: l.essai_jusqu_a,
      maitre: false,
      solo: false,
    };
  } catch {
    // Base injoignable : on ne peut prouver aucun droit PAYANT, donc il n'y en
    // a pas. Le socle gratuit, lui, ne se prouve pas — il est le plancher.
    return droitGratuit(tenant.id);
  }
}
