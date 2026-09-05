import { OFFRES, offreParId } from "./offres-publiques";
import { ESSAI_JOURS } from "./client-onboarding";
import type { BrickId } from "./bricks-access";
import type { StatutCompte } from "./entitlements";

/**
 * ─────────────────────────────────────────────────────────────────────
 * DE L'ARGENT REÇU AUX DROITS OUVERTS — le chaînon qui n'existait pas.
 *
 * ⚠ LE DÉFAUT, ET IL ANNULE TOUT LE RESTE DU TUNNEL.
 *
 * Le webhook Stripe écrit dans `subscriptions`. Le contrôle d'accès
 * (`resoudreDroits`, appelé par le middleware) lit `entitlements`. **Rien ne
 * reliait les deux tables**, et `entitlements` n'existait même pas dans le
 * schéma. Conséquence, dès que les comptes sont activés : le client paie, le
 * webhook enregistre son abonnement, le middleware ne trouve aucune ligne de
 * droits et rend `DROIT_REFUSE`. Il a payé, et l'application le refuse.
 *
 * Le commentaire de `resoudreDroits` décrivait déjà exactement ce cas — « un
 * client qu'on a oublié » — sans que personne ne remarque que c'était le
 * chemin NORMAL de tout nouveau client payant.
 *
 * Ce module est la traduction, en fonction pure : une offre achetée donne
 * des briques et un statut. Le webhook s'en sert pour provisionner.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Les briques que gouverne le contrôle d'accès. Doit rester alignée sur `BrickId`. */
const BRIQUES: readonly BrickId[] = [
  "alpha-voice",
  "campagnes",
  "cerveau",
  "crm",
  "audits",
  "tracking",
  "alpha-live",
  "closer",
  "agent-alpha",
  "pilotage",
];

export interface DroitsProvisionnes {
  bricks: BrickId[];
  statut: StatutCompte;
  /** Fin d'essai, seulement pour une offre d'essai. */
  essaiJusquA: string | null;
}

/**
 * Les droits qu'ouvre une offre — ou `null` si l'offre est inconnue.
 *
 * `null` n'est PAS « aucun droit » : c'est « je ne sais pas », et l'appelant
 * doit alors ne rien écrire. Provisionner un compte à zéro brique serait pire
 * que ne rien provisionner : le client verrait une application vide au lieu
 * d'un message qui dit qu'on n'a pas fini.
 */
export function droitsPourOffre(
  offreId: string | null | undefined,
  achatLe: string = new Date().toISOString()
): DroitsProvisionnes | null {
  if (!offreId) return null;
  const offre = offreParId(offreId);
  if (!offre) return null;

  // Les capacités du catalogue public portent les mêmes identifiants que les
  // briques d'accès. On filtre quand même : une capacité ajoutée côté vitrine
  // sans brique correspondante ouvrirait un droit qui n'existe pas.
  const bricks = offre.capacites.filter((c): c is BrickId => (BRIQUES as readonly string[]).includes(c));

  /**
   * ⚠ LA BRANCHE « ESSAI » A ÉTÉ RETIRÉE LE 04/09/2026, PAS OUBLIÉE.
   *
   * Elle testait `offre.id === "essai"` — une offre payante à 290 € qui
   * ouvrait un statut à durée limitée. Cette offre est sortie de la grille :
   * elle faisait double emploi avec la GARANTIE (« l'installation ne se paie
   * qu'au premier rendez-vous »), qui renverse le risque sans encaisser
   * d'avance, et avec le socle gratuit, qui laisse essayer sans rien payer.
   *
   * ⚠⚠ Le STATUT « essai », lui, reste vivant et géré : `resoudreDroits` le
   * lit depuis la base et le fait expirer. Un abonnement Stripe en `trialing`
   * ou une ligne posée à la main continuent donc de fonctionner. Ce qui
   * disparaît, c'est le chemin « acheter une offre ouvre un essai » — plus
   * aucune offre de la grille ne le fait, et un test le vérifie.
   */
  return { bricks, statut: "actif", essaiJusquA: null };
}

/**
 * La ligne `entitlements` à écrire. `null` = ne rien écrire.
 *
 * ⚠ Un paiement NON ENCAISSÉ ne provisionne rien. C'est la même règle que
 * partout dans ce tunnel : « session terminée » n'est pas « argent reçu », et
 * ouvrir l'accès avant l'encaissement, c'est livrer à crédit sans l'avoir
 * décidé.
 */
export function ligneEntitlements(opts: {
  tenantId: string;
  offreId: string | null | undefined;
  encaisse: boolean;
  achatLe?: string;
}): Record<string, unknown> | null {
  if (!opts.encaisse) return null;
  const d = droitsPourOffre(opts.offreId, opts.achatLe);
  if (!d) return null;
  return {
    tenant_id: opts.tenantId,
    bricks: d.bricks,
    statut: d.statut,
    essai_jusqu_a: d.essaiJusquA,
    updated_at: new Date().toISOString(),
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * ET LA RÉVOCATION — sans elle, résilier ne coûtait rien au client.
 *
 * ⚠ LE TROU LAISSÉ PAR LE PROVISIONNEMENT SEUL. `ligneEntitlements` n'écrit
 * que sur encaissement. À la résiliation, le webhook mettait bien
 * `subscriptions.status = "canceled"` — et la ligne `entitlements` restait
 * `actif`. Le client annulait son abonnement et gardait l'accès complet,
 * indéfiniment. Rien n'alertait : les deux tables se contredisaient en
 * silence, et c'est celle des droits qui décide.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Les états d'abonnement Stripe qui laissent l'accès OUVERT.
 *
 * `past_due` en fait partie volontairement : c'est un délai de grâce. Couper
 * l'accès au premier prélèvement raté ne récupère aucun impayé et transforme
 * une carte expirée en client perdu. Stripe réessaie ; nous attendons.
 *
 * ⚠ Cette liste DOIT rester identique à `ACTIVE` dans `lib/billing.ts`, qui
 * gouverne le même jugement côté écran. Un test le vérifie : deux listes dans
 * deux fichiers finissent toujours par diverger, et là l'écran dirait « actif »
 * pendant que le middleware refuse.
 */
export const ETATS_ABO_OUVERTS: readonly string[] = ["active", "trialing", "past_due"];

/**
 * Que faire des droits à la lecture d'un état d'abonnement ?
 *
 * `null` = ne rien toucher. On ne réactive JAMAIS depuis ici : rouvrir des
 * droits demande de savoir QUELLES briques, donc de repasser par l'offre.
 * Cette fonction ne sait que fermer.
 */
export function revocationPour(statusAbonnement: string | null | undefined): { statut: "suspendu" } | null {
  if (!statusAbonnement) return null;
  return ETATS_ABO_OUVERTS.includes(statusAbonnement) ? null : { statut: "suspendu" };
}

/**
 * La ligne à écrire pour FERMER les droits d'un compte.
 *
 * On garde les briques : elles disent ce qu'il avait, ce qui sert au moment de
 * la reprise et au support. `autorise()` les ignore de toute façon dès que le
 * statut est « suspendu » — un compte suspendu ne garde que les chemins
 * communs, ceux qui lui permettent de se connecter, comprendre et payer.
 */
export function ligneRevocation(tenantId: string): Record<string, unknown> {
  return { tenant_id: tenantId, statut: "suspendu", updated_at: new Date().toISOString() };
}

/**
 * Toutes les offres doivent ouvrir au moins une brique.
 *
 * Sert de test ET de garde-fou à l'exécution : une offre ajoutée au catalogue
 * sans capacité se vendrait et n'ouvrirait rien, ce qui ne se voit qu'au
 * premier client mécontent.
 */
export function offresSansDroits(): string[] {
  return OFFRES.filter((o) => {
    const d = droitsPourOffre(o.id);
    return !d || d.bricks.length === 0;
  }).map((o) => o.id);
}
