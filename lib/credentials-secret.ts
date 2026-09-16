import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { autorise, resoudreDroits, type Entitlement } from "./entitlements";
import { AUCUN_MOTEUR, type Capacite, type MoteurIA } from "./credentials";
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
export async function moteurIADeLaRequete(req: NextRequest): Promise<MoteurIA> {
  const droits = await resoudreDroits(req);
  return resoudreMoteurIA(droits.tenantId, droits);
}
