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

/** Ce que le compteur sait débiter. Un canal de plus = une entrée ici. */
export type Depense = "ia" | "email";

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
  return depense === "email" ? COUT_EMAIL_EUR : coutEstimeIaEur(route);
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
export async function coutGlobalEssais(): Promise<number | null> {
  const sb = serviceClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("entitlements")
    .select("cout_consomme_eur")
    .eq("statut", "essai");
  if (error) return null;
  let total = 0;
  for (const l of data ?? []) {
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
