import { NextRequest, NextResponse } from "next/server";
import { resoudreDroits } from "@/lib/entitlements";
import { resoudreSmtp, smtpUtilisable } from "@/lib/credentials-secret";
import { imapPourSmtp, imapSaisiAcceptable, LECTURE_FERMEE_PAR_MOT_DE_PASSE } from "@/lib/identifiants-assistes";
import { EchecLecture, lireReponsesImap, type ConfigLecture } from "@/lib/imap-lecture";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ─────────────────────────────────────────────────────────────────────
 * POST /api/reponses — les réponses des prospects, lues dans SA boîte.
 *
 * Le navigateur (l'autopilote de l'inscrit, `lib/autopilote-inscrit.ts`)
 * envoie la liste des adresses qu'il a contactées ; la route lit sa boîte en
 * LECTURE SEULE avec SES identifiants d'envoi et ne rend que les messages de
 * ces adresses. Rien n'est stocké (`lib/imap-lecture.ts`).
 *
 * ⚠⚠ NOTRE BOÎTE NE SE LIT QUE POUR LE MAÎTRE. Un client `campagnes` sans
 * boîte à lui envoie depuis la nôtre ; lui ouvrir la lecture de NOTRE boîte,
 * filtrée sur des adresses qu'IL choisit, lui permettrait de lire ce que
 * n'importe qui nous écrit — il lui suffirait de lister l'adresse. Sans boîte
 * à lui : refus, et la phrase dit quoi faire.
 *
 * ⚠ Une panne est `non-lu` avec sa raison, jamais une liste vide : « personne
 * n'a répondu » et « on n'a pas pu lire » demandent deux gestes opposés.
 * ─────────────────────────────────────────────────────────────────────
 */

const ADRESSES_MAX = 500;
const JOURS_MAX = 60;

function nonLu(raison: string, status = 200) {
  return NextResponse.json({ etat: "non-lu", raison }, { status });
}

export async function POST(req: NextRequest) {
  const droits = await resoudreDroits(req);
  if (!droits.tenantId && !droits.solo) return nonLu("Connecte-toi : la lecture de ta boîte est réservée à ton compte.", 401);

  let body: { adresses?: unknown; depuis?: unknown; imapHost?: unknown };
  try {
    body = await req.json();
  } catch {
    return nonLu("JSON invalide", 400);
  }
  const adresses = (Array.isArray(body.adresses) ? body.adresses : [])
    .filter((a): a is string => typeof a === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.trim()))
    .slice(0, ADRESSES_MAX);
  if (!adresses.length) return NextResponse.json({ etat: "lu", messages: [] });

  const plancher = Date.now() - JOURS_MAX * 86_400_000;
  const demande = typeof body.depuis === "string" ? Date.parse(body.depuis) : NaN;
  const depuis = new Date(Number.isFinite(demande) ? Math.max(demande, plancher) : plancher);

  const smtp = await resoudreSmtp(droits.tenantId, droits, { depense: false });
  if (!smtpUtilisable(smtp)) return nonLu("Branche ta boîte email (Réglages) : ALPHA lit les réponses là où il envoie.");
  if (smtp.origine === "maison" && !droits.maitre) {
    return nonLu("Ta boîte n'est pas branchée : sans elle, ALPHA ne peut pas lire les réponses. Réglages → Boîte d'envoi.");
  }

  /**
   * Le serveur de lecture : celui que l'écran a saisi s'il est du MÊME domaine
   * que le serveur d'envoi (le mot de passe ne part que chez cet hébergeur),
   * sinon celui de l'environnement (boîte maison), sinon la table.
   *
   * ⚠ LA SAISIE ÉTAIT IGNORÉE POUR LA BOÎTE MAISON (vu le 29/10/2026 en écrivant
   * la configuration « ALPHA vend ALPHA ») : notre boîte est chez Amen
   * (`smtp-fr.securemail.pro`), absente de la table, et `IMAP_HOST` n'est pas
   * posé en production. Le champ « Serveur de lecture » de `/autopilote`
   * s'affichait au maître et ne servait à rien — ALPHA écrivait depuis
   * `contact@` sans jamais pouvoir y lire un « oui ». La même règle de domaine
   * vaut pour la boîte maison, et elle seule.
   */
  const saisi = typeof body.imapHost === "string" ? body.imapHost.trim() : "";
  const host =
    saisi && imapSaisiAcceptable(saisi, smtp.host)
      ? saisi
      : smtp.origine === "maison"
        ? process.env.IMAP_HOST?.trim() || imapPourSmtp(smtp.host)
        : imapPourSmtp(smtp.host);
  if (!host) {
    return nonLu(
      saisi
        ? `« ${saisi.slice(0, 60)} » n'est pas du même domaine que ton serveur d'envoi : refusé (ton mot de passe ne part que chez ton hébergeur).`
        : "On ne connaît pas le serveur de lecture (IMAP) de ton hébergeur : indique-le dans le pilote automatique."
    );
  }

  const cfg: ConfigLecture = { host, port: Number(process.env.IMAP_PORT ?? 993) || 993, user: smtp.user, pass: smtp.pass };
  try {
    const messages = await lireReponsesImap(cfg, adresses, depuis);
    return NextResponse.json({ etat: "lu", messages });
  } catch (e) {
    if (e instanceof EchecLecture && e.classe === "auth") {
      return nonLu(
        LECTURE_FERMEE_PAR_MOT_DE_PASSE.includes(host)
          ? "Microsoft refuse la lecture par mot de passe : ALPHA ne peut pas lire une boîte Outlook / 365 aujourd'hui."
          : "Ton hébergeur refuse la lecture avec ce mot de passe (IMAP). Vérifie que l'accès IMAP est activé chez lui."
      );
    }
    if (e instanceof EchecLecture && e.classe === "connexion") return nonLu(`Le serveur de lecture ${host} n'a pas répondu.`);
    return nonLu("La lecture de ta boîte a échoué en cours de route : on réessaie au prochain passage.");
  }
}
