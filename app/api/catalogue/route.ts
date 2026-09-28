import { NextResponse, type NextRequest } from "next/server";
import { BRICKS, OUTBOUND_TIERS, PACK_SETUP_HT, PACK_MONTHLY_HT, quoteBricks, quoteText, outboundPrice } from "@/lib/bricks";
import { ACCOUNTS_COMMERCIAL, baremesPourCalculateur } from "@/lib/accounts-commercial";
import { getAccount } from "@/lib/accounts";
import { resoudreDroits } from "@/lib/entitlements";
import { lireCadrage, peutEmettreDevis } from "@/lib/cadrage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CATALOGUE ET SES PRIX — servis, jamais embarqués.
 *
 * ── LE PROBLÈME QUE CETTE ROUTE RÉSOUT ──
 *
 * `lib/bricks.ts` était importé par des composants CLIENT. Or tout ce
 * qu'un composant client importe est compilé dans un fichier JavaScript
 * que le navigateur télécharge — et `_next/static/**` est explicitement
 * exclu du middleware, donc ces fichiers sont récupérables par n'importe
 * qui, sur n'importe quel déploiement, mot de passe ou pas.
 *
 * Autrement dit : la grille tarifaire complète, le palier remisé et la
 * mention « le 4e millier est offert » étaient publics. Les retirer de
 * l'affichage n'y changeait rien — c'est la mesure du build qui l'a
 * montré, pas une intuition.
 *
 * Depuis cette route, les prix ne quittent le serveur que pour une
 * session authentifiée. `lib/bricks.ts` n'est plus importé par aucun
 * composant client : c'est vérifié par un test, parce qu'un seul import
 * distrait suffirait à tout remettre dans le navigateur.
 *
 * Route INTERNE : porte d'accès + même origine (voir middleware).
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * ⚠ CE RAISONNEMENT S'ÉTAIT ARRÊTÉ À MI-CHEMIN, ET ÇA SE VOYAIT EN LIGNE.
 *
 * Tout ce qui précède oppose « navigateur » à « serveur ». C'est la bonne
 * distinction pour la grille des briques, et c'est la MAUVAISE pour le volet
 * commercial : une session authentifiée n'est pas nous. Un locataire, c'est
 * un CLIENT de l'opérateur — et dans le portefeuille white-label, ça peut
 * être Nuwacom eux-mêmes.
 *
 * Mesuré sur serveur réel : avec un jeton d'un email non-maître, cette route
 * répondait 200 et rendait `commissionPct`, `recurringPct`, le seuil des
 * 40 k et les notes internes (« faisable par nous »). Autrement dit : les
 * les 15 % de Nuwacom, lisibles par
 * Nuwacom, avant le cadrage qui est justement notre levier.
 *
 * `tests/vitrine-fuite.test.ts` interdit déjà ces chiffres — sur une PAGE.
 * La deuxième sortie n'avait jamais été reliée à la doctrine.
 *
 * Les briques, les paliers et le pack restent servis à tout locataire : ce
 * sont ses prix, il a le droit de les lire, et le sélecteur de briques en
 * dépend. Le portefeuille, non.
 */
export async function GET(req: NextRequest) {
  // En mode solo (aucun système de comptes configuré), `resoudreDroits` rend
  // le droit SOLO, qui est maître : l'usage d'aujourd'hui ne bouge pas.
  const droits = await resoudreDroits(req);

  return NextResponse.json({
    bricks: BRICKS,
    outboundTiers: OUTBOUND_TIERS,
    pack: { setupHT: PACK_SETUP_HT, monthlyHT: PACK_MONTHLY_HT },
    /**
     * Le portefeuille ET son barème dérivé, au seul compte maître. Le barème
     * est calculé ICI plutôt que dans le navigateur pour la même raison que
     * les prix : le dériver côté client suppose d'y avoir les taux.
     */
    ...(droits.maitre
      ? {
          accounts: ACCOUNTS_COMMERCIAL,
          baremes: baremesPourCalculateur((id) => getAccount(id).name),
        }
      : {}),
  });
}

interface DevisRequete {
  /** Ids de briques à chiffrer. */
  bricks?: string[];
  /** Nom du client, pour le texte du devis. */
  client?: string;
  /** Émetteur (white-label) — jamais figé côté serveur. */
  issuer?: string;
  /** Volume d'appels sortants à chiffrer, indépendamment des briques. */
  calls?: number;
  /**
   * L'état du cadrage sur CE dossier. Transmis par la fiche, arbitré ici.
   *
   * ⚠ Le client ne tranche rien : il TRANSMET, le serveur ARBITRE. C'est
   * l'idiome de `/api/send` (`identiteEnvoi`), pour la même raison — le CRM vit
   * dans le `localStorage`, le serveur ne peut pas aller le lire. Ce n'est donc
   * pas une frontière de sécurité, et ça n'a pas à l'être : ce qu'on empêche,
   * c'est un opérateur qui s'envoie un devis à lui-même sans avoir cadré, pas
   * un attaquant. Ce qui compte est qu'il n'existe qu'UN endroit qui fabrique,
   * donc qu'un seul endroit qui pose la question.
   */
  cadrage?: unknown;
}

/**
 * Le chiffrage. Il se fait ICI plutôt que dans le navigateur pour la même
 * raison : calculer côté client suppose d'y avoir la grille.
 *
 * ══ ⚠⚠ LA PORTE DU CADRAGE EST ICI, ET ELLE NE L'ÉTAIT NULLE PART ══
 *
 * « Cadrage OBLIGATOIRE avant devis » est dans la doctrine depuis des semaines.
 * `peutEmettreDevis` l'exécute. Et le seul appelant de cette règle était
 * `renderDevis`, que **personne n'importait** (depuis supprimé, doublon mort).
 * Le devis qui PART réellement,
 * c'est `quoteText` — titré `DEVIS — <client>`, daté, avec quinze jours de
 * validité — servi par cette route et copié depuis la fiche. Il ne posait la
 * question à personne.
 *
 * La règle était donc branchée à un endroit sur deux, et l'endroit branché
 * était le mort. Le défaut récurrent du dépôt, sur la porte d'où part un
 * engagement.
 *
 * ⚠ CE QU'ON REFUSE, ET CE QU'ON NE REFUSE PAS. Le `texte` est refusé : c'est
 * le document qui part. Le `quote` est rendu quand même : ce sont SES prix,
 * appliqués à SON dossier, et chiffrer pour soi n'est pas émettre. Couper les
 * nombres aussi transformerait une discipline commerciale en panne d'outil,
 * et la première chose qu'on fait devant un outil en panne est de le
 * contourner — ici, en recopiant la grille à la main, c'est-à-dire en se
 * trompant de montant au dernier mètre.
 */
export async function POST(req: Request) {
  let body: DevisRequete;
  try {
    body = (await req.json()) as DevisRequete;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const ids = Array.isArray(body.bricks) ? body.bricks : [];
  const quote = quoteBricks(ids);
  const verdict = peutEmettreDevis(lireCadrage(body.cadrage));
  const texte =
    ids.length && verdict.autorise ? quoteText(quote, body.client?.trim() || "(client)", { issuer: body.issuer }) : "";

  return NextResponse.json({
    quote,
    texte,
    /**
     * Le verdict voyage AVEC le chiffrage, toujours — pas seulement sur refus.
     * Un appelant qui ne reçoit rien quand c'est bon n'a aucun moyen de
     * distinguer « autorisé » de « cette route ne connaît pas la règle », et
     * c'est comme ça qu'on réintroduit un second chemin sans garde.
     */
    cadrage: verdict,
    // Le pack sert d'ANCRE en face du chiffrage : il voyage avec, pour que
    // l'appelant n'ait pas à faire un second aller-retour.
    pack: { setupHT: PACK_SETUP_HT, monthlyHT: PACK_MONTHLY_HT },
    ...(typeof body.calls === "number" ? { sortant: outboundPrice(body.calls) } : {}),
  });
}
