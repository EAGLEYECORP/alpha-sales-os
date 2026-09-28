import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { autorise, resoudreDroits, statutEffectif, type Entitlement } from "./entitlements";
import { debiter, montantADebiter, type Depense } from "./compteur-essai";
import { AUCUN_MOTEUR, type Capacite, type MoteurIA, type Origine } from "./credentials";
import { MODELE_ANTHROPIC_DEFAUT, MODELE_NIM_DEFAUT } from "./modeles";

/**
 * ─────────────────────────────────────────────────────────────────────
 * BYOK, moitié SECRÈTE — chiffrement et résolution des moteurs.
 *
 * ⚠⚠ SÉPARÉ DE `lib/credentials.ts` PARCE QUE LE BUILD L'A EXIGÉ, et c'est
 * la bonne frontière. Le middleware tourne en **Edge**, où `node:crypto`
 * n'existe pas ; il importait tout le module et le build de production
 * échouait — ni `tsc` ni les tests ne pouvaient le voir.
 *
 * Mais la contrainte technique recouvre une règle de conception : **la porte
 * d'entrée n'a aucune raison de savoir déchiffrer une clé.** Elle a besoin
 * de savoir qu'il en existe une, vérifiée — rien de plus. Tout ce qui touche
 * au secret lui-même vit ici, côté Node, et n'est atteignable que par les
 * routes qui appellent réellement un modèle.
 * ─────────────────────────────────────────────────────────────────────
 */

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
// ── Chiffrement ────────────────────────────────────────────────────────

const ALGO = "aes-256-gcm";

/**
 * La clé maître, 32 octets.
 *
 * ⚠ **Absente ⇒ `null`, jamais une clé de repli.** Une clé par défaut
 * chiffrerait avec un secret que tout le monde peut lire dans le dépôt : le
 * chiffrement aurait l'air fait, et ne protégerait rien. Mieux vaut refuser
 * d'écrire que stocker un secret de client en clair déguisé.
 */
function cleMaitre(): Buffer | null {
  const brut = process.env.CREDENTIALS_MASTER_KEY?.trim();
  if (!brut) return null;
  const buf = /^[0-9a-f]{64}$/i.test(brut) ? Buffer.from(brut, "hex") : Buffer.from(brut, "base64");
  return buf.length === 32 ? buf : null;
}

export interface Chiffre {
  secretChiffre: string;
  nonce: string;
}

/**
 * Chiffre un jeu de valeurs. `null` si la clé maître manque — l'appelant
 * REFUSE alors d'enregistrer, il ne stocke pas en clair.
 */
export function chiffrer(valeurs: Record<string, string>): Chiffre | null {
  const cle = cleMaitre();
  if (!cle) return null;
  const iv = randomBytes(12);
  const c = createCipheriv(ALGO, cle, iv);
  const corps = Buffer.concat([c.update(JSON.stringify(valeurs), "utf8"), c.final()]);
  // Le tag d'authentification voyage avec le chiffré : sans lui, GCM ne peut
  // pas détecter qu'on a modifié la ligne en base.
  return {
    secretChiffre: Buffer.concat([corps, c.getAuthTag()]).toString("base64"),
    nonce: iv.toString("base64"),
  };
}

/** Déchiffre. `null` sur toute erreur — jamais d'exception qui remonte. */
export function dechiffrer(secretChiffre: string, nonce: string): Record<string, string> | null {
  const cle = cleMaitre();
  if (!cle) return null;
  try {
    const tout = Buffer.from(secretChiffre, "base64");
    const corps = tout.subarray(0, tout.length - 16);
    const tag = tout.subarray(tout.length - 16);
    const d = createDecipheriv(ALGO, cle, Buffer.from(nonce, "base64"));
    d.setAuthTag(tag);
    const clair = Buffer.concat([d.update(corps), d.final()]).toString("utf8");
    const parse: unknown = JSON.parse(clair);
    if (!parse || typeof parse !== "object" || Array.isArray(parse)) return null;
    return parse as Record<string, string>;
  } catch {
    return null;
  }
}

/**
 * Ce qu'on affiche dans les Réglages : les quatre derniers caractères.
 *
 * ⚠ C'est ce qui permet de dire « clé … a4f2 » SANS jamais redescendre le
 * secret dans un navigateur. Même doctrine que le mot de passe SMTP que
 * Supabase ne réaffiche jamais : **on écrit, on ne relit pas.**
 */
export function empreinteVisible(secret: string): string {
  const s = secret.trim();
  return s.length <= 4 ? "…" : `…${s.slice(-4)}`;
}

// ── Lecture en base ────────────────────────────────────────────────────

/**
 * Les valeurs déchiffrées d'une capacité, pour un locataire.
 *
 * ⚠ **`verifie_le` null ⇒ rien.** Une clé jamais testée n'ouvre pas la
 * capacité : sinon un locataire colle une clé fausse, la brique s'ouvre, et
 * le premier vrai usage échoue devant un prospect. C'est le pire moment
 * possible pour découvrir une faute de frappe.
 */
export async function identifiantsDu(
  tenantId: string | null,
  capacite: Capacite
): Promise<Record<string, string> | null> {
  if (!tenantId) return null;
  const sb = serviceClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("tenant_credentials")
    .select("secret_chiffre, nonce, verifie_le")
    .eq("tenant_id", tenantId)
    .eq("capacite", capacite)
    .limit(1);
  if (error) return null;
  const ligne = (data ?? [])[0] as
    | { secret_chiffre?: string; nonce?: string; verifie_le?: string | null }
    | undefined;
  if (!ligne?.secret_chiffre || !ligne.nonce || !ligne.verifie_le) return null;
  return dechiffrer(ligne.secret_chiffre, ligne.nonce);
}

// ── La résolution ──────────────────────────────────────────────────────

/** Les moteurs de la MAISON, lus dans notre environnement serveur. */
function moteursMaison(): Omit<MoteurIA, "origine"> {
  const out: Omit<MoteurIA, "origine"> = {};
  const ollama = process.env.OLLAMA_MODEL?.trim();
  if (ollama) {
    out.ollama = { url: (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/+$/, ""), model: ollama };
  }
  const nv = process.env.NVIDIA_API_KEY?.trim();
  if (nv) {
    out.nvidia = {
      key: nv,
      baseUrl: (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, ""),
      model: process.env.NVIDIA_MODEL?.trim() || MODELE_NIM_DEFAUT,
    };
  }
  const an = process.env.ANTHROPIC_API_KEY?.trim();
  if (an) out.anthropic = { key: an, model: process.env.AI_MODEL?.trim() || MODELE_ANTHROPIC_DEFAUT };
  return out;
}

/**
 * Les moteurs apportés par le LOCATAIRE, depuis ses valeurs déchiffrées.
 *
 * ⚠ Exportée sous `moteurDepuisValeurs` : la route d'enregistrement doit
 * TESTER la clé avant de la marquer vérifiée, et elle doit tester exactement
 * ce que la résolution utilisera ensuite. Deux constructions différentes
 * feraient valider une clé par un chemin et échouer par l'autre.
 */
function moteursLocataire(v: Record<string, string>): Omit<MoteurIA, "origine"> {
  const out: Omit<MoteurIA, "origine"> = {};
  const nv = v.NVIDIA_API_KEY?.trim();
  if (nv) {
    out.nvidia = {
      key: nv,
      baseUrl: (v.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, ""),
      model: v.NVIDIA_MODEL?.trim() || MODELE_NIM_DEFAUT,
    };
  }
  const an = v.ANTHROPIC_API_KEY?.trim();
  if (an) out.anthropic = { key: an, model: v.AI_MODEL?.trim() || MODELE_ANTHROPIC_DEFAUT };
  return out;
}

/**
 * ⚠⚠ LA FONCTION QUI DÉCIDE QUI PAIE. Voir l'ordre en tête de fichier.
 *
 * `/agent` est le chemin de la brique payante que l'IA sert (`agent-alpha`).
 * On pose la question à `autorise` plutôt qu'en nommant la brique : deux
 * définitions de « y a-t-il droit ? » finiraient par diverger, et c'est celle
 * qu'on ne relit pas qui ouvrirait le portefeuille.
 */
export async function resoudreMoteurIA(
  tenantId: string | null,
  droits: Entitlement
): Promise<MoteurIA> {
  // 1. Le locataire apporte sa clé — il paie, on n'a rien à vérifier d'autre.
  const siennes = await identifiantsDu(tenantId, "ia");
  if (siennes) {
    const m = moteursLocataire(siennes);
    if (m.nvidia || m.anthropic) return { ...m, origine: "locataire" };
    // Une ligne présente mais vide de toute clé exploitable ne vaut pas
    // autorisation : on NE retombe PAS sur la maison par accident.
    return AUCUN_MOTEUR;
  }

  // 2. Pas de clé à lui : il faut qu'il ait DROIT à ce qu'on paie.
  if (!autorise(droits, "/agent")) return AUCUN_MOTEUR;

  const maison = moteursMaison();
  if (!maison.ollama && !maison.nvidia && !maison.anthropic) return AUCUN_MOTEUR;
  return { ...maison, origine: "maison" };
}



/** Le moteur qu'on obtiendrait de ces valeurs — pour les TESTER avant de les croire. */
export function moteurDepuisValeurs(v: Record<string, string>): MoteurIA {
  const m = moteursLocataire(v);
  return m.nvidia || m.anthropic ? { ...m, origine: "locataire" } : AUCUN_MOTEUR;
}

/**
 * Le moteur IA pour la requête en cours — le point d'entrée des routes.
 *
 * ⚠ Une ligne par route, et c'est voulu : recopier
 * `resoudreDroits` + `resoudreMoteurIA` dans neuf fichiers, c'est neuf
 * endroits où l'ordre « clé du locataire d'abord, la nôtre ensuite »
 * pourrait s'écrire à l'envers. On en veut UN.
 */
export async function moteurIADeLaRequete(
  req: NextRequest,
  opts: { depense?: boolean } = {}
): Promise<MoteurIA> {
  const droits = await resoudreDroits(req);
  const moteur = await resoudreMoteurIA(droits.tenantId, droits);
  /**
   * ⚠ `depense: false` est une SORTIE EXPLICITE, et le défaut débite.
   *
   * L'inverse — ne débiter que si l'appelant le demande — aurait la même
   * forme et la propriété opposée : la route ajoutée demain dépenserait sans
   * compter, et rien ne le dirait. Ici, une route qui oublie l'option débite
   * pour rien (un essai se ferme un peu trop tôt, ça se répare) ; une route
   * qui l'utilise à tort dépense sans compter, ce qui ne se répare pas. Le
   * défaut va donc du côté qui pardonne.
   *
   * Le seul appelant légitime de `false` est `/api/health`, qui RÉSOUT sans
   * APPELER : il rapporte l'état du moteur. Le débiter ferait consommer
   * l'essai à un écran de diagnostic.
   */
  if (opts.depense === false) return moteur;
  const ok = await facturerEssai(droits, montantADebiter("ia", moteur.origine, req.nextUrl.pathname));
  return ok ? moteur : AUCUN_MOTEUR;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE DÉBIT, POSÉ À UN SEUL ENDROIT POUR CHAQUE CANAL.
 *
 * ⚠ Le compteur est celui de l'ESSAI, donc on ne débite QUE pendant un essai.
 * Un client qui paie a acheté sa consommation ; un compte maître ou solo,
 * c'est nous. Débiter tout le monde remplirait la colonne de nombres qui ne
 * gouvernent rien, et le premier lecteur croirait à un suivi de coûts — ce
 * que ce module n'est pas.
 *
 * ⚠⚠ **UN DÉBIT QUI ÉCHOUE REFUSE LA DÉPENSE.** C'est la moitié qui fait que
 * le plafond existe. Si on ne sait pas enregistrer ce qu'on s'apprête à
 * dépenser, on ne le dépense pas : sans ça, il suffit que l'écriture échoue
 * en boucle — base saturée, RPC absente — pour consommer sans aucune limite,
 * et c'est précisément la panne qu'un usage intensif provoque.
 * ─────────────────────────────────────────────────────────────────────
 */
async function facturerEssai(droits: Entitlement, montantEur: number): Promise<boolean> {
  if (montantEur <= 0) return true;
  if (statutEffectif(droits) !== "essai") return true;
  return debiter(droits.tenantId, montantEur);
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE DÉBIT POUR UNE DÉPENSE QUI N'A PAS DE RÉSOLVEUR.
 *
 * L'IA et l'email ont chacun une fonction qui décide QUI PAIE
 * (`resoudreMoteurIA`, `resoudreSmtp`) : le débit s'y pose naturellement, à un
 * seul endroit. L'egress et le rendu vidéo n'ont pas d'équivalent — il n'y a
 * rien à résoudre, puisqu'il n'existe aucun chemin par lequel un locataire
 * apporterait notre bande passante ou nos crédits de rendu.
 *
 * ⚠ D'où cette fonction plutôt qu'un `debiter()` recopié dans chaque route.
 * Le dépôt a déjà payé la dispersion : « combien d'endroits posent la règle,
 * et répondent-ils tous pareil ? ». Un seul, ici.
 *
 * ⚠ `origine: "maison"` est CODÉ EN DUR, et c'est exact : ces deux dépenses
 * nous reviennent toujours. Le jour où un locataire pourra apporter son propre
 * endpoint de rendu, cette ligne se rediscute — pas avant, et elle sera le
 * seul endroit à changer.
 *
 * ⚠⚠ RENDRE `false` VEUT DIRE « NE DÉPENSE PAS ». Comme partout ailleurs ici :
 * si on ne sait pas enregistrer ce qu'on s'apprête à dépenser, on ne le
 * dépense pas. L'appelant DOIT traiter le `false`, sinon le plafond redevient
 * un journal facultatif.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function debiterLaRequete(req: NextRequest, depense: Depense): Promise<boolean> {
  const droits = await resoudreDroits(req);
  return facturerEssai(droits, montantADebiter(depense, "maison", req.nextUrl.pathname));
}

// ── EMAIL : qui envoie, et depuis quelle boîte ─────────────────────────

/**
 * Les identifiants d'envoi, et qui les paie.
 *
 * ⚠ `from` est SÉPARÉ de `user` parce que ce n'est pas la même chose, et que
 * les confondre coûte cher : l'adresse d'expédition doit correspondre à la
 * boîte authentifiée, sinon le message est rejeté — ou pire, il part et se
 * fait classer en usurpation à l'arrivée, sans aucune erreur visible.
 * `docs/SMTP-SUPABASE-AMEN.md` le documente pour notre propre boîte ; un
 * locataire tombera dans le même piège avec la sienne.
 */
export interface Smtp {
  origine: Origine;
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export const AUCUN_SMTP = { origine: "aucune" as const };
export type ResolutionSmtp = Smtp | typeof AUCUN_SMTP;

/** Un SMTP résolu peut-il effectivement envoyer ? */
export function smtpUtilisable(s: ResolutionSmtp): s is Smtp {
  return s.origine !== "aucune";
}

function smtpDepuis(v: Record<string, string | undefined>, origine: Origine): ResolutionSmtp {
  const host = v.SMTP_HOST?.trim();
  const user = v.SMTP_USER?.trim();
  const pass = v.SMTP_PASS?.trim();
  // ⚠ Les trois ensemble, jamais moins. Un hôte sans mot de passe est l'état
  // où l'on croit avoir branché et où rien ne part — la raison pour laquelle
  // une capacité est une LIGNE et pas cinq.
  if (!host || !user || !pass) return AUCUN_SMTP;
  const port = Number(v.SMTP_PORT ?? 587);
  return {
    origine,
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    user,
    pass,
    from: v.SMTP_FROM?.trim() || user,
  };
}

/**
 * ⚠⚠ MÊME ORDRE QUE L'IA, ET POUR LA MÊME RAISON.
 *
 * 1. le locataire apporte son SMTP → il envoie de CHEZ LUI, sous SON domaine
 * 2. sinon, la brique `campagnes` lui est due → notre SMTP, notre réputation
 * 3. sinon → refus
 *
 * Écrit à l'envers, le point 2 fait partir de vrais emails depuis NOTRE
 * domaine pour le compte d'inconnus — et ça ne se voit que sur la réputation,
 * des semaines plus tard. C'est le scénario que `docs/A-FAIRE-ZAKARIA.md`
 * décrit déjà comme le plus cher du dépôt.
 */
export async function resoudreSmtp(
  tenantId: string | null,
  droits: Entitlement,
  opts: { depense?: boolean } = {}
): Promise<ResolutionSmtp> {
  const siens = await identifiantsDu(tenantId, "email");
  if (siens) {
    const s = smtpDepuis(siens, "locataire");
    // Une ligne présente mais incomplète ne fait PAS retomber sur la maison.
    return s;
  }
  if (!autorise(droits, "/campaigns")) return AUCUN_SMTP;
  const maison = smtpDepuis(process.env, "maison");
  /**
   * ⚠ Même sortie explicite que pour l'IA, et un seul appelant légitime :
   * `/api/deliverability/dns`, qui résout le SMTP pour savoir QUEL DOMAINE
   * interroger. Il n'envoie rien — le débiter ferait consommer l'essai à
   * chaque ouverture d'un écran de diagnostic DNS.
   *
   * ⚠ Le débit porte sur UN message, parce que `/api/send` n'accepte qu'un
   * destinataire par appel (`body.to`, une chaîne). Le jour où une route
   * enverrait un lot, elle devra débiter le lot — sans quoi mille envois
   * coûteraient un centime au compteur.
   */
  if (opts.depense === false) return maison;
  const ok = await facturerEssai(droits, montantADebiter("email", maison.origine, "/api/send"));
  return ok ? maison : AUCUN_SMTP;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * SMS — RÉSOLU, MAIS PAS ENCORE APPORTABLE.
 *
 * ⚠⚠ CETTE FONCTION EXISTE POUR FERMER UNE FUITE, PAS POUR OFFRIR UNE OPTION.
 *
 * `/api/send` sert deux canaux. Depuis que la capacité `email` ouvre le
 * chemin `/campaigns`, un locataire qui apporte son SMTP rend la branche SMS
 * ATTEIGNABLE — et sans ce contrôle, elle dépenserait NOS crédits Textbelt.
 *
 * Il n'y a donc pas de capacité `sms` à apporter aujourd'hui (elle viendra
 * avec le lot L3) : la seule question posée ici est « a-t-il DROIT à ce que
 * nous payions ? ». Non ⇒ refus, même si son email fonctionne.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface Sms {
  origine: Origine;
  url: string;
  key: string;
}

export function resoudreSms(droits: Entitlement): Sms | null {
  if (!autorise(droits, "/campaigns")) return null;
  const key = process.env.TEXTBELT_KEY?.trim();
  if (!key) return null;
  return {
    origine: "maison",
    url: process.env.TEXTBELT_URL?.trim() || "https://textbelt.com/text",
    key,
  };
}
