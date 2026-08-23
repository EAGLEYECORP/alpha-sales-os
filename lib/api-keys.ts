import { safeEqual } from "./access";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES CLÉS D'API ET LEURS DROITS.
 *
 * ── LE PROBLÈME ──
 *
 * `ALPHA_API_KEYS` était une liste plate : toute clé pouvait tout faire.
 * Tant qu'il n'y avait qu'un utilisateur, c'était une simplification. Avec un
 * client payant, c'est un trou — la clé qu'on donne à son n8n pour pousser des
 * prospects pourrait, demain, lire tout le pipe ou déclencher des appels.
 *
 * ── LE MODÈLE ──
 *
 * Une clé porte un NOM, un PROPRIÉTAIRE et des PORTÉES. Le nom sert aux
 * journaux : « qui a fait ça » doit se lire sans enquête. Les portées sont
 * accordées explicitement — une clé sans portée ne peut rien, et c'est le
 * comportement voulu pour une clé mal configurée.
 *
 * Format d'une entrée : `nom:proprietaire:portee1|portee2:secret`
 *   ex. `n8n-couvreur:client-couvreur:prospects.write:sk_live_xxxxx`
 *
 * Rétro-compatible : une entrée sans deux-points reste une clé complète au
 * nom de l'opérateur. Casser les intégrations existantes pour un refactor
 * serait un mauvais échange.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Les portées, du moins au plus dangereux.
 *
 * `propositions.write` mérite une explication : elle N'AUTORISE PAS à agir.
 * Elle autorise à DÉPOSER une proposition qu'un humain approuvera dans l'app.
 * C'est la portée de l'orchestrateur — voir `lib/propositions.ts`.
 */
export const PORTEES = [
  "etat.read",
  "prospects.read",
  "prospects.write",
  "propositions.read",
  "propositions.write",
] as const;

export type Portee = (typeof PORTEES)[number];

export interface CleApi {
  /** Nom lisible — c'est lui qui apparaît dans les journaux. */
  nom: string;
  /** À qui elle appartient : « operateur », ou l'identifiant d'un client. */
  proprietaire: string;
  portees: Portee[];
  secret: string;
}

/** Une portée inconnue n'accorde rien — on n'invente pas un droit. */
const porteeValide = (p: string): p is Portee => (PORTEES as readonly string[]).includes(p);

/**
 * Analyse `ALPHA_API_KEYS`.
 *
 * Une entrée mal formée est IGNORÉE plutôt que corrigée : deviner ce qu'un
 * administrateur voulait dire, c'est accorder un droit qu'il n'a pas écrit.
 */
export function lireCles(brut = process.env.ALPHA_API_KEYS): CleApi[] {
  const source = (brut ?? "").trim();
  if (!source) return [];

  const out: CleApi[] = [];
  for (const entree of source.split(",")) {
    const e = entree.trim();
    if (!e) continue;

    const parts = e.split(":");
    if (parts.length === 1) {
      // Ancien format : clé nue = opérateur, toutes les portées. Casser les
      // intégrations existantes pour un refactor serait un mauvais échange.
      out.push({ nom: "heritee", proprietaire: "operateur", portees: [...PORTEES], secret: parts[0] });
      continue;
    }
    if (parts.length !== 4) continue; // format inconnu → ignorée, pas devinée

    const [nom, proprietaire, porteesBrut, secret] = parts.map((x) => x.trim());
    if (!nom || !proprietaire || !secret) continue;

    const portees = porteesBrut.split("|").map((p) => p.trim()).filter(porteeValide);
    // Une clé sans portée valide est conservée mais ne peut rien : elle
    // apparaîtra dans les journaux comme refusée, ce qui est diagnosticable.
    out.push({ nom, proprietaire, portees, secret });
  }
  return out;
}

export interface Appelant {
  nom: string;
  proprietaire: string;
  portees: Portee[];
}

export type Verdict =
  | { ok: true; appelant: Appelant }
  | { ok: false; statut: 401 | 403; erreur: string; pourquoi: string };

/**
 * Authentifie et autorise une requête.
 *
 * Trois refus distincts, parce qu'ils appellent trois corrections différentes
 * et qu'un message unique fait perdre une heure à l'intégrateur :
 *  · aucune clé configurée → la porte est fermée côté serveur ;
 *  · clé absente ou inconnue → 401 ;
 *  · clé valide sans la portée → 403, en nommant la portée manquante.
 */
export function autoriserApi(header: string | null, requise: Portee): Verdict {
  const cles = lireCles();
  if (cles.length === 0) {
    return {
      ok: false,
      statut: 401,
      erreur: "API fermée.",
      pourquoi: "Aucune clé configurée côté serveur (ALPHA_API_KEYS). Une API d'écriture ouverte par défaut est une faute.",
    };
  }

  const brut = (header ?? "").trim();
  const fourni = brut.toLowerCase().startsWith("bearer ") ? brut.slice(7).trim() : brut;
  if (!fourni) {
    return { ok: false, statut: 401, erreur: "Clé manquante.", pourquoi: "Fournis « Authorization: Bearer <clé> »." };
  }

  // Comparaison à temps constant sur CHAQUE clé : sortir à la première
  // correspondance en comparaison naïve laisse fuir la longueur du secret.
  let trouvee: CleApi | null = null;
  for (const c of cles) if (safeEqual(c.secret, fourni)) trouvee = c;
  if (!trouvee) {
    return { ok: false, statut: 401, erreur: "Clé inconnue.", pourquoi: "Cette clé ne figure pas dans ALPHA_API_KEYS." };
  }

  if (!trouvee.portees.includes(requise)) {
    return {
      ok: false,
      statut: 403,
      erreur: "Portée insuffisante.",
      pourquoi: `La clé « ${trouvee.nom} » n'a pas la portée « ${requise} ». Portées accordées : ${trouvee.portees.join(", ") || "aucune"}.`,
    };
  }

  return { ok: true, appelant: { nom: trouvee.nom, proprietaire: trouvee.proprietaire, portees: trouvee.portees } };
}
