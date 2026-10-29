import type { Prospect } from "./types";
import { sirenDeLaFiche } from "./siren";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES COORDONNÉES D'UNE ENTREPRISE TROUVÉE — Dropcontact, avec la clé de
 * l'inscrit, DEPUIS SON NAVIGATEUR (29/10/2026).
 *
 * ── POURQUOI ──
 * Le registre (`lib/trouver-clients.ts`) dit QUI : une entreprise active, son
 * SIREN, son représentant légal. Il ne dit ni téléphone ni email — et une
 * entreprise qu'on ne peut pas joindre n'est pas un client, c'est une ligne.
 * Sans ce maillon, ALPHA trouvait des noms et s'arrêtait.
 *
 * ── POURQUOI DROPCONTACT ──
 * · Il prend exactement ce que le registre donne : raison sociale + SIREN
 *   (+ le représentant quand il est unique). Sans nom de personne, il cherche
 *   lui-même le représentant légal d'une entité française (documenté).
 * · Il rend un email VÉRIFIÉ et QUALIFIÉ (`nominative@pro`, `generic@pro`…),
 *   le téléphone de la société, le site.
 * · Le crédit n'est débité que si un email vérifié est trouvé (« pay on
 *   success », documenté) : une recherche qui échoue ne coûte rien.
 * · Français, et c'est son métier d'être conforme au RGPD.
 *
 * ── ⚠⚠ DU NAVIGATEUR, AVEC SA CLÉ — notre serveur ne voit rien ──
 * Vérifié le 29/10/2026 : le préflight CORS de `api.dropcontact.com` répond à
 * notre origine en autorisant l'en-tête `x-access-token`. La clé reste dans
 * le navigateur de l'inscrit (`lib/cle-locale.ts`), la requête part de chez
 * lui, et nous ne voyons ni ses cibles ni sa clé. Même règle que le registre
 * et le BODACC.
 *
 * ── ⚠ CE QU'ON GARDE, ET CE QU'ON LAISSE ──
 * · Email : `nominative@pro` d'abord, sinon `generic@pro`. JAMAIS une adresse
 *   `@perso` (gmail, hotmail…) : la prospection B2B par email vise une adresse
 *   PROFESSIONNELLE ; une boîte personnelle n'en est pas une, même chez un
 *   artisan. Ni `catch_all` (le domaine accepte tout : rien ne dit qu'une
 *   personne lit), ni `random`, ni `invalid`.
 * · Le nom de la personne n'est posé QUE s'il accompagne un email nominatif :
 *   c'est le fournisseur qui l'a trouvé avec cette adresse, pas nous qui
 *   l'avons deviné.
 * · Rien trouvé ⇒ tag `contacts-introuvables` : l'autopilote ne repaie pas une
 *   recherche qui a déjà échoué.
 *
 * ⚠ NON TESTÉ CONTRE LE VRAI SERVICE : ce conteneur n'a pas de clé, et le
 * fournisseur est payant. La forme des requêtes et des réponses vient de sa
 * documentation (lue le 29/10/2026) ; le premier inscrit qui branche sa clé
 * est le vrai test, et une réponse inattendue se lit `non-lu`, jamais « rien
 * trouvé ».
 * ─────────────────────────────────────────────────────────────────────
 */

export const DROPCONTACT = "https://api.dropcontact.com/v1/enrich/all";
/** L'API accepte 250 contacts par requête ; on en envoie au plus une page de registre. */
export const LOT_ENRICHISSEMENT = 25;
export const TAG_INTROUVABLE = "contacts-introuvables";
export const TAG_ENRICHI = "contacts-dropcontact";

export interface DemandeContact {
  company: string;
  num_siren?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Ce qu'on demande pour une fiche. `null` si on n'a ni SIREN ni raison
 * sociale : Dropcontact refuse un contact sans contexte d'entreprise, et on
 * ne paie pas une requête qu'on sait vaine.
 */
export function demandeDepuisFiche(p: Pick<Prospect, "company" | "siren" | "notes" | "representant">): DemandeContact | null {
  const siren = sirenDeLaFiche(p);
  const company = (p.company ?? "").trim();
  if (!company && !siren) return null;
  const d: DemandeContact = { company: company || siren || "" };
  if (siren) d.num_siren = siren;
  if (p.representant?.nom) {
    d.last_name = p.representant.nom;
    if (p.representant.prenom) d.first_name = p.representant.prenom;
  }
  return d;
}

/** Une fiche mérite-t-elle une recherche de coordonnées ? */
export function aEnrichir(p: Prospect): boolean {
  if (p.email?.trim()) return false;
  if ((p.tags ?? []).includes(TAG_INTROUVABLE)) return false;
  if (p.stage === "signe" || p.stage === "perdu") return false;
  return demandeDepuisFiche(p) !== null;
}

interface EmailQualifie {
  email?: unknown;
  qualification?: unknown;
}

/** Ce que Dropcontact rend pour un contact — seulement les champs qu'on lit. */
export interface ContactTrouve {
  siren?: string | null;
  num_siren?: string | null;
  email?: EmailQualifie[] | null;
  phone?: string | null;
  mobile_phone?: string | null;
  full_name?: string | null;
  linkedin?: string | null;
  website?: string | null;
}

/** L'email qu'on a le droit d'utiliser, et pourquoi. */
export function emailRetenu(c: ContactTrouve): { email: string; nominatif: boolean } | null {
  const liste = Array.isArray(c.email) ? c.email : [];
  const bons = liste
    .map((e) => ({ email: typeof e.email === "string" ? e.email.trim() : "", q: typeof e.qualification === "string" ? e.qualification : "" }))
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email));
  const nominatif = bons.find((e) => e.q === "nominative@pro");
  if (nominatif) return { email: nominatif.email, nominatif: true };
  const generique = bons.find((e) => e.q === "generic@pro");
  return generique ? { email: generique.email, nominatif: false } : null;
}

/**
 * Ce que la fiche reçoit. Pur : la même réponse donne le même patch.
 * On ne remplace JAMAIS une donnée déjà posée (saisie à la main, ou lue
 * ailleurs) : on complète ce qui manque.
 */
export function patchDepuisContact(p: Prospect, c: ContactTrouve, maintenant: Date = new Date()): Partial<Prospect> {
  const mail = emailRetenu(c);
  const tel = (c.phone || c.mobile_phone || "").trim();
  const trouve = Boolean(mail || tel);
  const tags = new Set(p.tags ?? []);
  if (trouve) {
    tags.delete("a-joindre");
    tags.add(TAG_ENRICHI);
  } else {
    tags.add(TAG_INTROUVABLE);
  }
  const patch: Partial<Prospect> = { tags: [...tags], updatedAt: maintenant.toISOString() };
  if (mail && !p.email?.trim()) patch.email = mail.email;
  if (tel && !p.phone?.trim()) patch.phone = tel;
  if (mail?.nominatif && !p.name?.trim() && c.full_name?.trim()) patch.name = c.full_name.trim();
  if (c.linkedin?.trim() && !p.linkedin?.trim()) patch.linkedin = c.linkedin.trim();
  if (c.website?.trim() && !/(^|\n)Site : /.test(p.notes ?? "")) {
    patch.notes = [p.notes, `Site : ${c.website.trim()}`].filter(Boolean).join("\n");
  }
  return patch;
}

/** Le résumé posé sur la timeline — un FAIT, pas une promesse. */
export function resumeEnrichissement(c: ContactTrouve): string {
  const mail = emailRetenu(c);
  const tel = (c.phone || c.mobile_phone || "").trim();
  if (!mail && !tel) return "Coordonnées cherchées (Dropcontact) : rien de professionnel trouvé.";
  const parts = [mail ? `email ${mail.nominatif ? "nominatif" : "générique"} vérifié` : "", tel ? "téléphone" : ""].filter(Boolean);
  return `Coordonnées trouvées (Dropcontact) : ${parts.join(" + ")}.`;
}

/**
 * Quelle fiche reçoit quel contact.
 *
 * ⚠⚠ VU AU RENDU (29/10/2026) : associer par la seule POSITION dans la réponse
 * suppose que le fournisseur rend ses résultats dans l'ordre envoyé. Le jour où
 * ce n'est pas vrai, l'email d'une entreprise est posé sur la fiche d'une
 * autre — et part vers la mauvaise société. Le SIREN rendu tranche : s'il
 * désigne une autre fiche du lot, c'est elle ; s'il n'en désigne aucune, le
 * contact n'est posé NULLE PART. La position ne sert que quand rien ne la
 * contredit.
 */
export function associerContacts(
  lot: readonly { id: string; siren?: string }[],
  contacts: readonly ContactTrouve[]
): { id: string; contact: ContactTrouve }[] {
  const chiffres = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(0, 9);
  const parSiren = new Map(lot.filter((f) => chiffres(f.siren).length === 9).map((f) => [chiffres(f.siren), f.id]));
  const out: { id: string; contact: ContactTrouve }[] = [];
  const pris = new Set<string>();
  contacts.forEach((c, i) => {
    const rendu = chiffres(c.siren ?? c.num_siren);
    let id: string | undefined;
    // Un SIREN rendu tranche ; sans lui, la position (rien ne la contredit).
    if (rendu.length === 9) id = parSiren.get(rendu);
    else id = lot[i]?.id;
    if (id && !pris.has(id)) {
      pris.add(id);
      out.push({ id, contact: c });
    }
  });
  return out;
}

// ══════════ LE TRANSPORT (navigateur) ══════════

type Fetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type Lancement = { etat: "lance"; requestId: string; credits: number | null } | { etat: "non-lu"; raison: string };
export type Resultat =
  | { etat: "pret"; contacts: ContactTrouve[]; credits: number | null }
  | { etat: "en-cours" }
  | { etat: "non-lu"; raison: string };

function raisonHttp(status: number): string {
  if (status === 401 || status === 403) return "Dropcontact refuse la clé — vérifie-la dans ton compte Dropcontact";
  if (status === 429) return "Dropcontact limite le débit : on réessaie au prochain passage";
  if (status === 402) return "plus de crédits Dropcontact sur ton compte";
  return `Dropcontact a répondu ${status}`;
}

const credits = (j: Record<string, unknown>) => (typeof j.credits_left === "number" ? j.credits_left : null);

/** Lance une recherche. La clé part dans l'en-tête, jamais dans l'adresse. */
export async function lancerEnrichissement(demandes: DemandeContact[], cle: string, f: Fetch): Promise<Lancement> {
  if (!cle.trim()) return { etat: "non-lu", raison: "aucune clé Dropcontact enregistrée" };
  if (!demandes.length) return { etat: "non-lu", raison: "rien à chercher" };
  try {
    const res = await f(DROPCONTACT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Access-Token": cle.trim() },
      body: JSON.stringify({ data: demandes.slice(0, LOT_ENRICHISSEMENT), language: "fr" }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = ((await res.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    if (!res.ok) return { etat: "non-lu", raison: typeof j.reason === "string" ? `Dropcontact : ${j.reason.slice(0, 160)}` : raisonHttp(res.status) };
    if (j.error === true || typeof j.request_id !== "string") {
      return { etat: "non-lu", raison: typeof j.reason === "string" ? `Dropcontact : ${j.reason.slice(0, 160)}` : "réponse illisible de Dropcontact" };
    }
    return { etat: "lance", requestId: j.request_id, credits: credits(j) };
  } catch {
    return { etat: "non-lu", raison: "Dropcontact n'a pas répondu à temps" };
  }
}

/**
 * Relit une recherche. « Pas encore prête » est un état, pas une panne : la
 * documentation dit de revenir dans 30 secondes.
 */
export async function lireEnrichissement(requestId: string, cle: string, f: Fetch): Promise<Resultat> {
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(requestId)) return { etat: "non-lu", raison: "identifiant de recherche illisible" };
  try {
    const res = await f(`${DROPCONTACT}/${requestId}`, {
      method: "GET",
      headers: { "X-Access-Token": cle.trim() },
      signal: AbortSignal.timeout(15_000),
    });
    const j = ((await res.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    if (!res.ok) return { etat: "non-lu", raison: raisonHttp(res.status) };
    if (j.success === false && j.error === false) return { etat: "en-cours" };
    if (j.error === true) return { etat: "non-lu", raison: typeof j.reason === "string" ? `Dropcontact : ${j.reason.slice(0, 160)}` : "erreur Dropcontact" };
    if (!Array.isArray(j.data)) return { etat: "non-lu", raison: "réponse illisible de Dropcontact" };
    return { etat: "pret", contacts: j.data as ContactTrouve[], credits: credits(j) };
  } catch {
    return { etat: "non-lu", raison: "Dropcontact n'a pas répondu à temps" };
  }
}
