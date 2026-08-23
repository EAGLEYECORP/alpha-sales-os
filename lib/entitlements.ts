import type { NextRequest } from "next/server";
import { getTenant } from "./tenant";
import { peutOuvrir, type BrickId } from "./bricks-access";

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
 *    REFUS. Une fois qu'on vend des comptes, un droit qu'on ne peut pas
 *    prouver n'existe pas. Ouvrir « parce que la base ne répond pas » est
 *    exactement la panne qu'un attaquant provoque.
 *
 * Confondre les deux donne soit un produit inutilisable, soit une passoire.
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

/** Le refus. Aucun droit, aucune brique — utilisé quand on ne peut pas prouver. */
export const DROIT_REFUSE: Entitlement = {
  tenantId: null,
  bricks: [],
  statut: "suspendu",
  maitre: false,
  solo: false,
};

/** Le système de comptes est-il actif sur ce déploiement ? */
export function comptesActifs(): boolean {
  return Boolean(process.env.SUPABASE_JWT_SECRET && process.env.NEXT_PUBLIC_SUPABASE_URL);
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
  if (suspendu) return peutOuvrir(chemin, [], false) || ent.maitre;
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Comptes actifs mais service role absent : on ne PEUT pas lire les droits.
  // C'est une configuration incomplète, pas une autorisation.
  if (!url || !key) return DROIT_REFUSE;

  try {
    const r = await fetch(
      `${url}/rest/v1/entitlements?select=bricks,statut,essai_jusqu_a&tenant_id=eq.${encodeURIComponent(tenant.id)}&limit=1`,
      { headers: { apikey: key, authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    if (!r.ok) return DROIT_REFUSE;
    const lignes = (await r.json()) as { bricks?: unknown; statut?: string; essai_jusqu_a?: string }[];
    const l = lignes[0];
    // Aucune ligne = compte créé mais jamais provisionné. Ce n'est pas un
    // client sans brique, c'est un client qu'on a oublié : on refuse, et
    // l'écran le dit — plutôt que d'ouvrir « au cas où ».
    if (!l) return DROIT_REFUSE;

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
    // Base injoignable : on ne peut pas prouver le droit, donc il n'existe pas.
    return DROIT_REFUSE;
  }
}
