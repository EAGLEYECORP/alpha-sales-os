import type { NextRequest } from "next/server";
import { safeEqual } from "./access";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'APPEL DU PILOTE SERVEUR — comment `/api/send` reconnaît qu'il est appelé
 * par le pilote qui tourne onglet fermé (`app/api/autopilote/tick`).
 *
 * Décision de Zakaria (30/10/2026) : « ALPHA vend ALPHA » doit tourner dans le
 * cloud, sans navigateur ouvert et sans n8n. Le pilote serveur envoie donc par
 * `/api/send` lui-même — mêmes gardes, une seule définition (palier du jour,
 * mentions, divulgation IA, recontact, démo) — en appelant son gestionnaire
 * DANS LE MÊME PROCESSUS, avec cet en-tête.
 *
 * ⚠ CE QUI REND ÇA SÛR :
 *  · la valeur est le `CRON_SECRET`, comparée en temps constant — le même
 *    secret qui arme déjà les ticks qui envoient (`/api/campaign/mail-tick`) :
 *    on n'ouvre pas une porte de plus, on réutilise la clé qui l'ouvrait ;
 *  · une requête qui vient du RÉSEAU passe d'abord par le middleware, qui
 *    exige une session sur `/api/send` : l'en-tête seul n'y suffit pas. Seul
 *    un appel EN PROCESSUS (le gestionnaire importé) le court-circuite ;
 *  · pas de `CRON_SECRET` posé ⇒ jamais reconnu.
 *
 * Ce qu'il donne : les droits du MAÎTRE (`DROIT_SOLO`, comme `mail-tick`) et
 * aucun locataire — le palier se compte donc sur la boîte maison, comme pour
 * les autres ticks. ⚠ Le pilote du navigateur, lui, compte sous le compte
 * connecté : ne pas faire tourner les deux en même temps.
 * ─────────────────────────────────────────────────────────────────────
 */
export const ENTETE_PILOTE_SERVEUR = "x-alpha-pilote-serveur";

export function estAppelPiloteServeur(req: Pick<NextRequest, "headers">): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const fourni = (req.headers.get(ENTETE_PILOTE_SERVEUR) ?? "").trim();
  return fourni.length > 0 && safeEqual(fourni, secret);
}

/** L'adresse maître qui signe le palier « owner » — la première de `OWNER_EMAILS`. */
export function emailMaitrePrincipal(): string | null {
  const e = (process.env.OWNER_EMAILS ?? "").split(",").map((x) => x.trim().toLowerCase()).find((x) => x && !x.startsWith("@"));
  return e ?? null;
}
