import type { NextRequest } from "next/server";
import { getTenant } from "./tenant";
import { peutOuvrir, type BrickId } from "./bricks-access";
import { serverAuthEnforced } from "./supabase-jwt";
import { etatEssai, HORS_ESSAI, type EtatEssai } from "./essai";
import { coutGlobalEssais } from "./compteur-essai";

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
  /**
   * ─────────────────────────────────────────────────────────────────────
   * L'ÉTAT DE L'ESSAI — présent MÊME QUAND L'ESSAI EST FERMÉ.
   *
   * ⚠⚠ C'EST TOUT L'INTÉRÊT DE CE CHAMP, et il répare un trou que le lot du
   * 17/09 a créé lui-même.
   *
   * Un essai qui se ferme retombe au socle gratuit — invariant du dépôt, il
   * ne bouge pas. Mais le socle gratuit porte `statut: "actif"`. Donc, vu de
   * l'écran, **un essai terminé était indistinguable d'un compte qui n'en a
   * jamais eu** : le locataire perdait `/campaigns`, `/agent` et `/audits`
   * du jour au lendemain, et rien nulle part ne disait pourquoi.
   *
   * Pire : `etatEssai` produit déjà une `phrase` écrite pour être lue par un
   * humain, et personne ne la lisait. Un mécanisme juste, testé, branché
   * nulle part — le défaut récurrent de ce dépôt, commis sur la brique qu'on
   * venait d'ouvrir.
   *
   * ⚠ `undefined` ≠ « essai fermé ». `undefined` veut dire **ce compte n'a
   * pas d'essai du tout** (client payant, compte maître, mode solo, gratuit
   * de toujours). La distinction gouverne ce que l'écran a le droit de dire :
   * on ne raconte pas la fin d'un essai à quelqu'un qui n'en a jamais ouvert.
   *
   * ⚠ Ce champ est DESCRIPTIF, jamais décisionnel. Les droits restent ceux
   * de `bricks` ; `autorise()` ne le lit pas et ne doit jamais le lire —
   * sinon on aurait deux définitions de ce qui est ouvert.
   * ─────────────────────────────────────────────────────────────────────
   */
  essai?: EtatEssai;
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
 * PAYANT = la machine agit à ta place. Envoyer, appeler, tracer, rédiger.
 * C'est exactement la frontière du coût, donc elle est facile à défendre en
 * vente : « tant que ça reste chez toi, c'est gratuit ».
 *
 * ⚠⚠ CETTE PHRASE DISAIT AUSSI « SOUFFLER EN DIRECT », ET C'ÉTAIT LA SEULE
 * BRIQUE CLASSÉE PAR CATÉGORIE AU LIEU DE L'ÊTRE PAR SON COÛT (12/09/2026).
 *
 * `alpha-live` — le copilote d'appel — garde un seul chemin, `/overlay`, et
 * **aucune route API ne le sert**. Mesuré : `components/live/alpha-live.tsx`
 * n'appelle aucun `/api/…`. Il tourne entièrement dans le navigateur — le
 * store local, le RAG maison hors-ligne, les correspondances d'objections, et
 * la reconnaissance vocale du navigateur. Il ne consomme ni nos jetons, ni nos
 * minutes, ni notre SMTP, ni notre bande passante.
 *
 * Il était donc payant au titre de « la machine agit à ta place » — une
 * FAMILLE — alors que le critère énoncé six lignes plus haut est le COÛT. Et
 * il n'agit même pas à la place de l'opérateur : il lui souffle pendant qu'il
 * parle, exactement comme le Closer OS, qui est gratuit.
 *
 * `tests/entitlements.test.ts` rend maintenant le critère EXÉCUTABLE : une
 * brique ne peut être payante que si elle garde un chemin servi par une route
 * qui dépense chez nous. La doctrine affirmait « ce n'est pas un arbitrage
 * commercial, c'est un fait technique » — c'est vérifié, plus seulement écrit.
 *
 * ⚠ `/controle` s'ouvre au gratuit (il agrège CRM + pilotage) et affiche donc
 * le lanceur de campagnes. Le bouton existe, le serveur refuse (403
 * `brique_absente`). C'est délibéré : voir la porte fermée vaut mieux que ne
 * pas savoir qu'elle existe — et la sécurité ne dépend pas de l'écran.
 * ─────────────────────────────────────────────────────────────────────
 */
export const BRIQUES_GRATUITES: readonly BrickId[] = ["crm", "closer", "cerveau", "pilotage", "alpha-live"];

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

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN DÉPLOIEMENT PUBLIC SANS AUCUNE SERRURE — le trou qui ne se voyait pas.
 *
 * ⚠ CE N'ÉTAIT PAS UNE CONFIG MANQUANTE, C'ÉTAIT UN DÉFAUT DE CONCEPTION.
 *
 * `resoudreDroits` rendait `DROIT_SOLO` dès que les comptes n'étaient pas
 * configurés. `DROIT_SOLO` est `maitre: true` et `autorise()` lui répond `true`
 * sur TOUT. C'était le bon choix quand Alpha Sales OS était un outil local
 * pour une personne : refuser aurait transformé un outil qui marche en écran
 * de connexion vide.
 *
 * Mais la même ligne, sur un déploiement joignable depuis internet, veut dire :
 * **quiconque connaît l'URL est maître.** `/payouts`, `/offre`, notre
 * portefeuille, `/api/send` qui envoie de vrais emails depuis notre domaine,
 * `/api/voice/call` qui compose de vrais numéros sur nos minutes. Et rien ne
 * l'annonce — l'app a exactement le même air.
 *
 * Le mode solo n'a jamais été pensé pour être exposé. Il n'y avait simplement
 * aucun endroit dans le code qui faisait la différence entre « ça tourne sur
 * ma machine » et « c'est en ligne ».
 *
 * ── LA DISTINCTION, ET POURQUOI CELLE-LÀ ──
 *
 * Trois conditions ensemble, et seulement les trois ensemble :
 *   · on est en PRODUCTION (donc pas `npm run dev`) ;
 *   · aucun compte n'est configuré ;
 *   · aucun mot de passe de site n'est posé.
 *
 * `SITE_PASSWORD` compte comme une serrure : s'il est là, le middleware mure
 * déjà l'application entière, et le mode solo derrière ce mur est l'usage
 * voulu — l'outil interne. Ce n'est que lorsqu'il n'y a RIEN que le problème
 * existe.
 *
 * ── CE QU'ON FAIT ALORS, ET CE QU'ON NE FAIT PAS ──
 *
 * On ne coupe PAS le site : une page blanche sur une production en ligne est
 * une panne, et on n'en crée pas une pour corriger une faille. On retombe sur
 * le SOCLE GRATUIT — l'application reste utilisable, la démonstration reste
 * possible, mais plus personne n'est maître par défaut et rien de ce qui
 * dépense chez nous n'est atteignable.
 *
 * C'est le même invariant que partout ailleurs ici : **on ne monte jamais
 * au-dessus du gratuit sans preuve.** Le mode solo était la dernière porte qui
 * y échappait.
 * ─────────────────────────────────────────────────────────────────────
 */
export function deploiementSansSerrure(): boolean {
  const enProduction = process.env.NODE_ENV === "production";
  const motDePasse = Boolean((process.env.SITE_PASSWORD ?? "").trim());
  return enProduction && !comptesActifs() && !motDePasse;
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

/**
 * Les briques connues — pour valider ce qui vient de la base.
 *
 * ⚠ EXPORTÉE parce qu'un test en dérive la liste des PAYANTES (tout ce qui
 * n'est pas dans `BRIQUES_GRATUITES`). La recopier dans le test aurait créé
 * une seconde définition du catalogue : on ajoute une brique, on oublie le
 * test, et elle échappe au contrôle de coût sans que rien ne le dise.
 */
export const BRIQUES_CONNUES: readonly BrickId[] = [
  "alpha-voice", "campagnes", "cerveau", "crm", "audits",
  "tracking", "alpha-live", "closer", "agent-alpha", "pilotage",
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE L'ESSAI OUVRE — tout le catalogue, moins la téléphonie.
 *
 * ⚠⚠ DÉRIVÉ, JAMAIS ÉCRIT À LA MAIN, et c'est la garantie centrale de
 * l'ouverture : une brique ajoutée demain au catalogue entre AUTOMATIQUEMENT
 * dans l'essai, sauf si quelqu'un l'inscrit dans `HORS_ESSAI` — un geste qui
 * se voit au diff et qui exige d'écrire pourquoi. Une liste recopiée aurait
 * l'effet inverse : la brique suivante serait absente de l'essai par oubli, et
 * personne ne saurait dire si c'était une décision.
 *
 * ⚠⚠ ET C'EST LE CODE QUI TIENT LE PÉRIMÈTRE, PAS LA COLONNE `bricks`.
 * `resoudreDroits` IGNORE ce que la ligne d'essai porte et substitue cette
 * liste. Sans ça, le périmètre de l'essai vivrait dans des lignes SQL écrites
 * à la main ou par une migration : une ligne `{alpha-voice}` posée un soir de
 * démonstration ouvrirait nos minutes, et rien dans le dépôt ne le
 * contredirait. La migration 012 pose donc `bricks = '{}'` et ne connaît
 * aucun nom de brique.
 * ─────────────────────────────────────────────────────────────────────
 */
export const BRIQUES_ESSAI: readonly BrickId[] = BRIQUES_CONNUES.filter((b) => !HORS_ESSAI.includes(b));

/** Nettoie une liste venue de la base : on n'accorde jamais un droit inconnu. */
export function normaliserBriques(brut: unknown): BrickId[] {
  if (!Array.isArray(brut)) return [];
  // ⚠ L'élargissement en `string[]` est nécessaire ET sûr : `brut` vient de la
  // BASE, donc de `unknown`. Un `includes` typé `BrickId` refuserait de
  // comparer — or c'est précisément la comparaison qui fait le nettoyage.
  return brut.filter((b): b is BrickId => typeof b === "string" && (BRIQUES_CONNUES as readonly string[]).includes(b));
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
  /**
   * ⚠ L'ORDRE COMPTE : ce contrôle passe AVANT le mode solo, sinon il ne sert
   * à rien. C'est précisément le `return DROIT_SOLO` de la ligne suivante qui
   * rendait tout le monde maître sur une production sans serrure.
   */
  if (deploiementSansSerrure()) return { ...DROIT_GRATUIT, bricks: [...BRIQUES_GRATUITES] };
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
      `${url}/rest/v1/entitlements?select=bricks,statut,essai_jusqu_a,cout_consomme_eur&tenant_id=eq.${encodeURIComponent(tenant.id)}&limit=1`,
      { headers: { apikey: key, authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    if (!r.ok) return droitGratuit(tenant.id);
    const lignes = (await r.json()) as {
      bricks?: unknown;
      statut?: string;
      essai_jusqu_a?: string;
      cout_consomme_eur?: number | string | null;
    }[];
    const l = lignes[0];
    // Aucune ligne = compte créé librement et jamais payé. C'est le cas
    // NORMAL depuis que l'inscription est ouverte, plus une anomalie : il
    // reçoit le socle gratuit.
    if (!l) return droitGratuit(tenant.id);

    const statut: StatutCompte =
      l.statut === "actif" || l.statut === "essai" || l.statut === "suspendu" ? l.statut : "suspendu";

    /**
     * ⚠⚠ L'ESSAI A DEUX LIMITES, ET LA SECONDE EST LA SEULE QUI PROTÈGE.
     *
     * `statutEffectif` expire déjà l'essai sur la DATE. Mais les briques
     * ouvertes pendant l'essai DÉPENSENT chez nous, et il n'existe aucun
     * chemin d'identifiants par locataire : un compte motivé consomme en deux
     * jours ce qu'on comptait donner en trente. `etatEssai` arbitre le COÛT.
     *
     * ⚠ `null` ⇒ inconnu ⇒ l'essai FERME (voir `lib/essai.ts`). PostgREST rend
     * un `numeric` en CHAÎNE : le lire sans conversion donnerait `"12.50" >= 30`
     * → `false`, c'est-à-dire un plafond qui ne mord jamais. Une comparaison
     * de chaîne qui a l'air d'une comparaison de nombre ne fait rien tomber :
     * elle laisse la porte ouverte en silence.
     */
    if (statut === "essai") {
      const brut = l.cout_consomme_eur;
      const coutConsommeEur = brut === null || brut === undefined ? null : Number(brut);
      /**
       * ⚠ La somme globale n'est lue QUE pour un compte en essai. Un client
       * qui paie n'a rien à voir avec l'enveloppe d'acquisition, et lui faire
       * payer une requête d'agrégat à chaque navigation serait du coût pour
       * rien.
       */
      const essai = etatEssai({
        jusquA: l.essai_jusqu_a ?? null,
        coutConsommeEur: Number.isFinite(coutConsommeEur) ? coutConsommeEur : null,
        coutGlobalEur: await coutGlobalEssais(),
      });

      /**
       * Un essai fermé — durée, plafond, enveloppe ou compteur illisible —
       * retombe au socle gratuit, jamais au néant : ses fiches lui
       * appartiennent. C'est l'invariant du dépôt, il ne bouge pas.
       *
       * ⚠ Mais il repart AVEC son état d'essai. Sans ça, l'écran voit un
       * compte gratuit `statut: "actif"` et ne peut pas distinguer « ton
       * essai vient de finir, voici pourquoi » de « tu n'as jamais eu
       * d'essai ». Le locataire perdrait trois briques en silence.
       */
      if (!essai.actif) return { ...droitGratuit(tenant.id), essai };

      /**
       * ⚠⚠ `BRIQUES_ESSAI`, PAS `l.bricks`. Le périmètre de l'essai se dérive
       * du catalogue moins `HORS_ESSAI` ; ce que porte la colonne est ignoré.
       * C'est ce qui rend « la téléphonie est grisée » vrai quoi qu'il arrive
       * en base — une ligne posée à la main ne peut pas ouvrir nos minutes.
       */
      return {
        tenantId: tenant.id,
        bricks: [...BRIQUES_ESSAI],
        statut,
        essaiJusquA: l.essai_jusqu_a,
        maitre: false,
        solo: false,
        essai,
      };
    }

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
