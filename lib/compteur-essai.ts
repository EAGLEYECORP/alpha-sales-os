import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PRIX_MILLE_JETONS, budgetPour } from "./token-budget";
import type { Origine } from "./credentials";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE COMPTEUR — ce qui manquait pour que le plafond d'essai existe.
 *
 * ══ ⚠⚠ CE QUE J'AI MESURÉ AVANT D'ÉCRIRE CE FICHIER ══
 *
 * `entitlements.cout_consomme_eur` était **écrit par personne**. Zéro. La
 * colonne existait depuis la migration 008, `etatEssai` l'arbitrait, un test
 * la couvrait — et aucune ligne du dépôt ne l'incrémentait jamais.
 *
 * Ce n'est pas « le plafond ne mordait pas ». C'est pire, et dans l'autre
 * sens : la colonne vaut `null` par défaut, `null` FERME l'essai, donc **tout
 * compte passé en `statut = 'essai'` retombait au socle gratuit le jour même**.
 * L'essai trente jours ne s'était jamais ouvert une seule fois. Une garde
 * fail-closed parfaitement écrite, posée sur un compteur qui n'existe pas,
 * ne protège rien : elle interdit tout, silencieusement.
 *
 * C'est le défaut récurrent du dépôt — un mécanisme juste, testé, branché à
 * AUCUN endroit — sur le mécanisme dont dépendait l'ouverture entière.
 *
 * ══ LA RÈGLE QUI FAIT TOUT TENIR : ON NE COMPTE QUE CE QU'ON PAIE ══
 *
 * `origine` (lib/credentials) dit qui règle l'appel qui va suivre :
 *
 *   · `"locataire"` → sa clé, sa facture → **débit ZÉRO**. Son essai ne
 *     consomme ni son plafond ni l'enveloppe, et peut donc durer sans nous
 *     coûter un centime. C'est la seule version honnête de « gratuit pour
 *     nous », et c'est ce qui rend l'ouverture finançable.
 *   · `"maison"`  → notre clé → **on débite**.
 *   · `"aucune"`  → rien ne part → rien à débiter.
 *
 * ⚠ Sans ce tri, le BYOK deviendrait absurde : un locataire qui paie déjà son
 * fournisseur verrait son essai se fermer sur une dépense que nous n'avons
 * jamais faite.
 *
 * ══ ⚠ LE DÉBIT EST UNE ESTIMATION, ET IL S'ANNONCE COMME TELLE ══
 *
 * On débite AVANT l'appel, sur le budget de jetons que la route s'accorde
 * elle-même (`budgetPour`), au prix indicatif de `PRIX_MILLE_JETONS`. Donc :
 *
 *  · **avant, pas après** — un débit a posteriori laisse un appel énorme
 *    passer entier puis constate le dépassement. Le plafond ne bornerait plus
 *    rien, il raconterait ce qui s'est déjà produit ;
 *  · **surestimé, jamais sous-estimé** — une route qui échoue après la
 *    résolution aura été débitée pour rien. C'est le bon sens de l'erreur :
 *    un essai qui se ferme trop tôt se répare en une requête, une facture
 *    découverte trente jours plus tard ne se répare pas ;
 *  · **ce n'est pas la facture du fournisseur.** `PRIX_MILLE_JETONS` porte
 *    déjà sa réserve (« à ajuster au fournisseur réel »). Ce compteur borne
 *    une dépense, il ne la comptabilise pas.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Ce que le compteur sait débiter. Un canal de plus = une entrée ici.
 *
 * ⚠⚠ `ia` ET `email` ONT UN CHEMIN BYOK, `egress` ET `video` N'EN ONT PAS.
 * C'est la distinction qui décide du montant : pour les deux premiers,
 * `origine` peut valoir `locataire` et le débit tombe à zéro. Pour les deux
 * autres, **la dépense nous revient toujours** — il n'existe aucun moyen
 * qu'un locataire apporte notre bande passante ou nos crédits de rendu.
 */
export type Depense = "ia" | "email" | "egress" | "video";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠⚠ DEUX ROUTES DÉPENSAIENT SANS RIEN DÉBITER — et ça rendait l'enveloppe
 * partiellement fausse.
 *
 * Trouvé le 17/09 en relisant `API_QUI_DEPENSENT` après avoir branché
 * l'alerte d'enveloppe : le compteur ne connaissait que l'IA et l'email. Or
 * `lib/credentials.ts` dit déjà, noir sur blanc, que `/api/audit` « récupère
 * des sites tiers DEPUIS NOTRE SERVEUR, donc notre egress et notre exposition
 * à l'abus — une clé IA ne paie pas ça ». La phrase était écrite ; le
 * compteur ne la connaissait pas.
 *
 * ── EGRESS (`/api/audit/generate`) ──
 *
 * Ce qui coûte n'est pas la bande passante — quelques kilo-octets. C'est
 * **notre IP qui va frapper chez des tiers** : un essai qui balaie deux cents
 * sites nous fait passer pour un aspirateur, et c'est notre adresse qui se
 * fait bloquer, pas la sienne. Un débit nul rendrait ça invisible, donc
 * illimité.
 *
 * ⚠ Cette route débite DEUX FOIS, et ce n'est pas un doublon : elle appelle
 * `moteurIADeLaRequete` (qui débite l'IA) **et** récupère un site. Deux
 * dépenses distinctes, deux débits. Les confondre sous-compterait l'une des
 * deux.
 *
 * ⚠ `/api/audit/extract` NE DÉBITE PAS d'egress, et c'est volontaire : elle
 * reçoit le texte déjà collé par l'opérateur, elle ne va frapper nulle part.
 * Lui ajouter un débit au motif qu'elle est « dans la famille audit » serait
 * le défaut que ce dépôt a déjà payé trois fois — classer par FAMILLE au lieu
 * de classer par DÉPENSE.
 *
 * ── VIDÉO (`/api/video/render`) ──
 *
 * La vraie fuite : deux voies, aucune ne débitait. `textToVideo` frappe un
 * endpoint GPU, `renderJson2Video` consomme nos crédits. Un rendu coûte
 * l'ordre de grandeur d'une centaine d'emails, pas d'un.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Le coût estimé d'une récupération de site tiers, en euros.
 *
 * ⚠ **DÉCISION, pas mesure.** Ce qu'on tarife n'est pas des octets : c'est le
 * droit d'envoyer notre IP frapper chez quelqu'un. Le nombre est arbitraire et
 * le dit ; ce qui ne l'est pas, c'est qu'il ne soit pas nul.
 */
export const COUT_EGRESS_EUR = 0.02;

/**
 * Le coût estimé d'un rendu vidéo, en euros.
 *
 * ⚠ **DÉCISION, pas mesure** — aucune facture de rendu n'a jamais été lue ici.
 * Posé à cent fois l'email parce qu'un rendu GPU ou un crédit json2video n'est
 * pas du même ordre qu'un message : le mettre au même prix laisserait un essai
 * produire trente vidéos sans que l'enveloppe bouge d'un centime.
 */
export const COUT_VIDEO_EUR = 1;

/**
 * Le coût estimé d'un envoi d'email, en euros.
 *
 * ⚠ **Ce n'est pas zéro, et écrire zéro aurait été le piège.** Un email ne se
 * facture pas au message chez notre hébergeur, donc le réflexe est de ne rien
 * débiter. Mais ce que consomme un envoi n'est pas de l'argent : c'est la
 * RÉPUTATION d'un domaine partagé entre la prospection et les mails de
 * confirmation Supabase (`docs/SMTP-SUPABASE-AMEN.md`) — une ressource qui ne
 * se rachète pas et dont la perte fait qu'un inscrit ne reçoit jamais son lien.
 *
 * Un débit non nul la rend COMPTABLE : mille envois d'essai sur notre domaine
 * touchent l'enveloppe et s'arrêtent, au lieu d'être invisibles parce qu'ils
 * sont « gratuits ». Le montant est arbitraire et le dit ; ce qui ne l'est
 * pas, c'est qu'il ne soit pas nul.
 *
 * ⚠ Le palier du jour (`lib/email-ramp.ts`) borne déjà le RYTHME depuis une
 * boîte. Il ne borne pas le nombre de boîtes d'essai qui tirent dessus.
 */
export const COUT_EMAIL_EUR = 0.01;

/**
 * Le coût estimé d'un appel IA sur une route, en euros.
 *
 * Dérivé, jamais saisi : `budgetPour(route)` est le budget de jetons d'ENTRÉE
 * que la route s'autorise, et la sortie est bornée par le même ordre de
 * grandeur. On facture donc entrée + sortie au budget, ce qui majore — voir
 * l'en-tête : on surestime, on ne sous-estime pas.
 *
 * ⚠ Une route inconnue reçoit le budget par défaut de `budgetPour`, pas zéro.
 * Un `?? 0` aurait ouvert une porte dérobée pour toute route ajoutée demain.
 */
export function coutEstimeIaEur(route: string): number {
  const jetons = budgetPour(route);
  const eur = (jetons / 1000) * (PRIX_MILLE_JETONS.entree + PRIX_MILLE_JETONS.sortie);
  // Deux décimales suffisent pour un plafond en euros, mais un appel bon
  // marché ne doit pas s'arrondir à ZÉRO : il serait gratuit à l'infini.
  return Math.max(0.01, Math.round(eur * 100) / 100);
}

/**
 * Le montant à débiter pour cet appel — `0` si ce n'est pas nous qui payons.
 *
 * Pure et testable : c'est ici que se lit la règle « on ne compte que ce qu'on
 * paie », sans base et sans requête.
 */
export function montantADebiter(depense: Depense, origine: Origine, route: string): number {
  // ⚠ Le tri par origine passe AVANT le calcul. L'inverse — calculer puis
  // multiplier par 0 — marcherait aujourd'hui et se ferait perdre au premier
  // refactor qui déplace le calcul ailleurs.
  if (origine !== "maison") return 0;
  /**
   * ⚠ UN `switch` EXHAUSTIF, PAS UNE CHAÎNE DE TERNAIRES AVEC UN DÉFAUT.
   *
   * La version précédente s'écrivait `depense === "email" ? … : coutIa(…)` :
   * tout ce qui n'était pas « email » retombait sur le calcul IA. Ajouter
   * `egress` aujourd'hui l'aurait donc facturé au prix d'un appel de modèle,
   * en silence et sans que rien ne tombe. Ici, `tsc` refuse une valeur non
   * traitée — le compilateur tient l'exhaustivité, pas la relecture.
   */
  switch (depense) {
    case "email":
      return COUT_EMAIL_EUR;
    case "egress":
      return COUT_EGRESS_EUR;
    case "video":
      return COUT_VIDEO_EUR;
    case "ia":
      return coutEstimeIaEur(route);
  }
}

// ── La base ────────────────────────────────────────────────────────────

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Ce que TOUS les essais en cours nous ont coûté. `null` si on n'a pas su lire.
 *
 * ⚠ Une SOMME, pas une table de compteurs. La dépense de l'ouverture est déjà
 * écrite ligne par ligne dans `entitlements` : en tenir un second total
 * ailleurs créerait deux définitions de la même quantité, et c'est celle qu'on
 * ne relit pas qui finirait par décider. Même arbitrage que partout ici.
 *
 * ⚠ Seuls les comptes en `statut = 'essai'` entrent dans la somme. Un client
 * qui PAIE ne consomme pas l'enveloppe d'acquisition : l'y inclure ferait
 * fermer l'ouverture d'autant plus vite qu'on vend mieux.
 */
export async function coutGlobalEssais(deps: DepsEnveloppe = {}): Promise<number | null> {
  const maintenant = deps.maintenant ?? Date.now;
  const t = maintenant();
  const cache = deps.cache ?? cacheModule;
  if (cache.entree && t < cache.entree.jusqua) return cache.entree.valeur;

  const sb = deps.client !== undefined ? deps.client : (serviceClient() as unknown as ClientEnveloppe | null);
  if (!sb) return null;

  /**
   * ⚠⚠ DEUX CHEMINS, ET LE SECOND NE MENT PLUS (21/10/2026, migration 018).
   *
   * 1. LE COMPTEUR, en base : une ligne, tenue par trigger. Mesuré sur un vrai
   *    Postgres : la somme coûtait 245 ms à un million de comptes (≈ 2,5 s à
   *    dix millions) **à chaque requête d'un inscrit en essai** ; le compteur
   *    coûte une lecture par clé.
   * 2. LE REPLI, quand la migration n'est pas encore posée : l'ancienne somme.
   *    Elle rapatriait toutes les lignes d'essai ET les additionnait en
   *    JavaScript — or PostgREST borne ses réponses (1 000 par défaut). Au-delà,
   *    elle additionnait les 1 000 premières et ignorait le reste : le plafond
   *    de 300 € ne se refermait plus, sans rien dire. **Un total tronqué a
   *    l'air exact** — c'est le pire état d'une garde. Le repli refuse donc de
   *    conclure dès qu'il touche le plafond : `null`, et `null` FERME l'essai.
   */
  const compteur = await lireCompteur(sb);
  let valeur: number | null;
  if (compteur.etat === "ok") valeur = compteur.valeur;
  else if (compteur.etat === "absente") valeur = await sommeDeRepli(sb);
  else valeur = null;

  // ⚠ Seul un chiffre se garde. Un `null` (inconnu) ne se met JAMAIS en cache :
  // il ferait fermer les essais dix secondes de plus que la panne.
  if (valeur !== null) cache.entree = { valeur, jusqua: t + DUREE_CACHE_ENVELOPPE_MS };
  return valeur;
}

/**
 * Combien de temps une lecture de l'enveloppe vaut dans une instance.
 *
 * ⚠ Dix secondes, et c'est un arbitrage écrit : l'enveloppe est un BUDGET
 * (300 €), pas un compteur de sécurité à la milliseconde — le plafond PAR COMPTE
 * (`cout_consomme_eur`) reste lu frais à chaque résolution de droits. Ce qu'on
 * économise : une requête par navigation de chaque inscrit en essai.
 * Le cache vit dans l'instance (serverless : il ne se partage pas, et c'est
 * sans importance — au pire une lecture par instance et par fenêtre).
 */
export const DUREE_CACHE_ENVELOPPE_MS = 10_000;

/**
 * Le plafond de lignes d'une réponse PostgREST. 1 000 par défaut chez Supabase
 * (Settings → API → Max rows : à lire dans le tableau de bord, pas supposé ici).
 * Une réponse qui l'ATTEINT est peut-être tronquée : on ne conclut rien.
 */
export const PLAFOND_LIGNES_POSTGREST = 1000;

/**
 * Le cache est un OBJET passé en paramètre, pas un état caché derrière une
 * fonction de remise à zéro réservée aux tests : une telle fonction n'aurait
 * aucun appelant de production, et c'est exactement ce que `exports-morts`
 * refuse. Chaque test fournit le sien ; la production partage `cacheModule`.
 */
export interface CacheEnveloppe {
  entree: { valeur: number; jusqua: number } | null;
}
const cacheModule: CacheEnveloppe = { entree: null };

/** Ce que cette lecture exige d'un client — celui de Supabase, ou un faux dans un test. */
export interface ClientEnveloppe {
  rpc(nom: string): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
  from(table: string): {
    select(colonnes: string): {
      eq(colonne: string, valeur: string): PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>;
    };
  };
}

export interface DepsEnveloppe {
  /** `null` = pas de client (configuration absente) ; absent = le vrai. */
  client?: ClientEnveloppe | null;
  maintenant?: () => number;
  /** Absent = le cache de l'instance. Un test passe le sien. */
  cache?: CacheEnveloppe;
}

type LectureCompteur = { etat: "ok"; valeur: number } | { etat: "absente" } | { etat: "inconnu" };

/** La fonction SQL n'existe pas encore : la migration 018 n'est pas posée. */
function fonctionAbsente(e: { code?: string; message?: string }): boolean {
  return e.code === "PGRST202" || e.code === "42883" || /could not find the function|does not exist/i.test(e.message ?? "");
}

async function lireCompteur(sb: ClientEnveloppe): Promise<LectureCompteur> {
  const { data, error } = await sb.rpc("cout_global_essais");
  if (error) return fonctionAbsente(error) ? { etat: "absente" } : { etat: "inconnu" };
  // PostgREST rend un `numeric` en CHAÎNE (voir plus bas) ; `null` = ligne absente = inconnu.
  if (data === null || data === undefined || data === "") return { etat: "inconnu" };
  const n = Number(data);
  return Number.isFinite(n) ? { etat: "ok", valeur: Math.round(n * 100) / 100 } : { etat: "inconnu" };
}

async function sommeDeRepli(sb: ClientEnveloppe): Promise<number | null> {
  const { data, error } = await sb.from("entitlements").select("cout_consomme_eur").eq("statut", "essai");
  if (error) return null;
  const lignes = data ?? [];
  // ⚠ Plafond atteint ⇒ peut-être tronqué ⇒ on ne sait pas. L'inconnu vaut refus.
  if (lignes.length >= PLAFOND_LIGNES_POSTGREST) return null;
  let total = 0;
  for (const l of lignes) {
    const brut = (l as { cout_consomme_eur?: number | string | null }).cout_consomme_eur;
    // ⚠ PostgREST rend un `numeric` en CHAÎNE. Additionner sans convertir
    // concatènerait — « 10 » + « 20 » = « 1020 », un total qui explose au
    // lieu de fermer, ou « 0 » + « 5 » = « 05 », qui vaut 5 par chance. Le
    // même piège que `cout_consomme_eur` dans `resoudreDroits`.
    const n = brut === null || brut === undefined ? NaN : Number(brut);
    if (Number.isFinite(n)) total += n;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Le compteur et la SOMME côte à côte — la sonde de dérive. La somme est LA
 * définition ; le compteur n'en est que la copie tenue par trigger. Si les deux
 * divergent (trigger désarmé, `truncate`, écriture avec les triggers coupés),
 * l'écart se lit ici au lieu de se supposer. `null` si la fonction est absente
 * ou illisible : on ne rend jamais « écart 0 » par défaut.
 */
export async function ecartEnveloppeEssais(): Promise<{ compteur: number; somme: number; ecart: number } | null> {
  const sb = serviceClient();
  if (!sb) return null;
  const { data, error } = await sb.rpc("ecart_enveloppe_essais");
  if (error) return null;
  const l = (Array.isArray(data) ? data[0] : data) as { compteur?: unknown; somme?: unknown; ecart?: unknown } | null | undefined;
  if (!l) return null;
  const compteur = Number(l.compteur);
  const somme = Number(l.somme);
  const ecart = Number(l.ecart);
  return [compteur, somme, ecart].every(Number.isFinite) ? { compteur, somme, ecart } : null;
}

/**
 * Débite le compteur d'un locataire. Rend `false` si l'écriture n'a pas eu lieu.
 *
 * ⚠⚠ **L'APPELANT DOIT TRAITER `false` COMME UN REFUS DE DÉPENSER.** C'est le
 * point qui sépare ce compteur d'un simple journal : si on ne sait pas
 * enregistrer ce qu'on s'apprête à dépenser, on ne le dépense pas. Une
 * dépense non enregistrée n'est pas « une ligne de log perdue », c'est une
 * dépense qui échappe au plafond — donc le plafond entier, puisqu'il suffit
 * que l'écriture échoue en boucle pour consommer sans limite.
 *
 * ⚠ Un débit de `0` (locataire qui paie sa clé) rend `true` sans toucher la
 * base : il n'y a rien à enregistrer, et faire dépendre le BYOK de la
 * disponibilité de NOTRE base serait absurde.
 */
export async function debiter(tenantId: string | null, montantEur: number): Promise<boolean> {
  if (montantEur <= 0) return true;
  if (!tenantId) return false;
  const sb = serviceClient();
  if (!sb) return false;
  /**
   * ⚠ INCRÉMENT ATOMIQUE, jamais lire-puis-écrire. Deux appels simultanés du
   * même locataire liraient tous deux 12,00 et écriraient tous deux 12,50 :
   * une des deux dépenses disparaît. Sur une boucle d'appels — le cas même
   * qu'on cherche à borner — la fuite est proportionnelle au débit.
   * La fonction SQL vit dans la migration 012.
   */
  const { error } = await sb.rpc("debiter_essai", { p_tenant: tenantId, p_montant: montantEur });
  return !error;
}
