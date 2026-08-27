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

  const essai = offre.id === "essai";
  return {
    bricks,
    // Un essai est un essai : il a une fin, et le statut le dit. Le marquer
    // « actif » ferait vivre un compte gratuit indéfiniment le jour où
    // personne ne repasse derrière.
    statut: essai ? "essai" : "actif",
    essaiJusquA: essai
      ? new Date(new Date(achatLe).getTime() + ESSAI_JOURS * 86_400_000).toISOString()
      : null,
  };
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
