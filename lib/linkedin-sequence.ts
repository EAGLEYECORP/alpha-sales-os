import type { Prospect } from "./types";
import { LINKEDIN_INVITE_LIMIT } from "./linkedin";
import { verticalForProspect } from "./playbook";
// Une seule source pour « ce métier est-il réellement sur LinkedIn ? ».
import { PRESENCE_LINKEDIN } from "./linkedin-ciblage";
// Le critère, la question et le signal d'audit viennent de l'aimant routé —
// la même source que l'email, pour que les deux canaux ne se contredisent pas.
import { approcheEcrite } from "./approche-ecrite";
// ⚠ Une seule source pour « qui signe ». Ce fichier était la CINQUIÈME
// réponse : l'en-tête de `lib/signature.ts` en listait quatre, et le
// balayage ne l'avait pas atteint.
import { signataire, presentation } from "./signature";
import { getAccount } from "./accounts";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Séquence LinkedIn — l'approche « pull » (`docs/APPROCHE-PULL.md`).
 *
 * Positionnement : c'est l'OPÉRATEUR qui parle et qui offre l'audit ; la
 * solution vient après, quand la perte a été reconnue et chiffrée par le
 * prospect lui-même. L'audit n'est jamais envoyé d'office — il est PROPOSÉ,
 * et n'arrive qu'après un oui. C'est ce qui distingue une newsletter d'un spam.
 *
 * ⚠ Cet en-tête nommait une campagne datée (« ALPHA SALES TEST 1 ») et le
 * revendeur avec qui l'accord est mort le 02/09/2026. Le partage de rôles
 * qu'il décrivait — nous la voix, eux la solution — n'existe plus : Alpha
 * Voice est à nous. La séquence, elle, n'a jamais dépendu de ça.
 *
 * Cadence volontairement lente (invitation → J+2 message → J+4 relance)
 * et plafonnée par LINKEDIN_DAILY_SAFE : le profil est un actif, on ne
 * le grille pas pour trois touches de plus.
 * ─────────────────────────────────────────────────────────────────────
 */

export type LinkedinStep = "invitation" | "message" | "relance" | "termine";

export const STEP_LABEL: Record<LinkedinStep, string> = {
  invitation: "1 · Invitation",
  message: "2 · Message",
  relance: "3 · Relance",
  termine: "Séquence terminée",
};

/** Délai minimum avant la touche suivante (jours). */
const DELAY: Record<LinkedinStep, number> = { invitation: 0, message: 2, relance: 4, termine: 0 };

const firstName = (p: Prospect) => (p.name || "").trim().split(/\s+/)[0] || "";


/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI PARLE SUR CE CANAL — et sous quelle marque.
 *
 * ⚠⚠ LES TROIS MESSAGES SIGNAIENT « Zakaria — EAGLEYE CORP » EN DUR.
 *
 * Le produit est WHITE-LABEL. Un revendeur qui utilise la file LinkedIn
 * envoyait donc des invitations signées du prénom du propriétaire de l'outil,
 * sous NOTRE raison sociale, à SES prospects. `lib/signature.ts` existe
 * précisément pour ça, et son en-tête énumère les quatre fichiers qui
 * répondaient chacun autre chose — celui-ci était le cinquième, et il avait
 * échappé au balayage parce qu'il n'écrit pas d'email.
 *
 * L'ordre de repli ne change pas : nom saisi → RAISON SOCIALE (une identité
 * légale, et elle appartient à l'expéditeur) → libellé d'usine, rendu visible.
 *
 * ⚠ L'élision est calculée, pas écrite : « d'EAGLEYE CORP » mais « de
 * Nuwacom ». Le texte en dur portait l'apostrophe, donc tout compte dont le
 * nom commence par une consonne aurait produit « je suis X, d'Nuwacom ».
 * On n'élide PAS devant un h : « de Hxxx » est toujours correct, « d'Hxxx »
 * dépend du h aspiré, qu'aucune règle mécanique ne tranche.
 */
function identite(accountId?: string, closerName?: string) {
  const compte = getAccount(accountId);
  const nom = signataire(closerName, compte.name).nom;
  // ⚠ L'élision vivait ici ET allait être recopiée dans l'argumentaire.
  // Elle est remontée dans `lib/signature.ts` : deux copies de la même
  // règle divergent, et c'est celle qu'on ne relit pas qui dit « d'Nuwacom ».
  return {
    nom,
    agence: compte.name,
    presentation: presentation(closerName, compte.name),
    ville: compte.city?.trim() ?? "",
  };
}

/**
 * L'invitation : ≤ 300 caractères, un critère, zéro pitch, zéro chiffre.
 * On ne vend rien ici — on demande la connexion, c'est tout.
 *
 * ⚠ ELLE ANNONÇAIT ALPHA VOICE EN DUR — « les appels qui arrivent quand
 * personne ne peut les prendre » — QUEL QUE SOIT LE ROUTAGE DE LA FICHE.
 *
 * C'est le défaut qui avait déjà été corrigé dans `messageText`, une fonction
 * plus bas, avec le commentaire qui l'explique : le message servait un audit
 * téléphonique à un prospect routé « visibilité ». La correction n'était pas
 * remontée jusqu'ici. Or l'invitation est la touche la PLUS CHÈRE du canal :
 * elle est plafonnée à cent par semaine glissante, et une invitation dépensée
 * sur le mauvais sujet ne se rejoue pas avant trois semaines.
 *
 * Sur un maître d'ouvrage, la version en dur promettait de parler d'appels
 * manqués à quelqu'un qui n'en rate pas — c'est-à-dire se disqualifiait avant
 * même d'être accepté.
 *
 * ⚠⚠ La forme, elle, suit la règle des affirmations : le corps de
 * l'invitation est désormais UNE QUESTION. On ne lui donne rien à contester.
 */
export function inviteText(p: Prospect, accountId?: string, closerName?: string): string {
  const a = approcheEcrite(p, accountId);
  const moi = identite(accountId, closerName);
  const who = firstName(p) ? `Bonjour ${firstName(p)}, ` : "Bonjour, ";
  // Le secteur géographique vient de la FICHE, jamais d'un arrondissement
  // codé en dur : un message qui se trompe de quartier se grille seul.
  const zone = p.city?.trim() ? ` à ${p.city.trim()}` : " à Lyon";

  /**
   * La troncature dégrade dans un ORDRE choisi, elle ne coupe pas au hasard.
   * Un `slice` sec sur la chaîne entière tranchait la question en plein
   * milieu — c'est-à-dire supprimait la seule partie qui fait répondre. On
   * sacrifie donc la formule de politesse d'abord, la question en dernier.
   */
  const base = `${who}${moi.presentation}. Je travaille avec ${a.critere}${zone}.`;
  const question = ` La question qui m'intéresse : ${a.question}`;
  const fin = " Content d'échanger si le sujet vous parle.";

  if ((base + question + fin).length <= LINKEDIN_INVITE_LIMIT) return base + question + fin;
  if ((base + question).length <= LINKEDIN_INVITE_LIMIT) return base + question;
  return (base + question).slice(0, LINKEDIN_INVITE_LIMIT - 1) + "…";
}

/**
 * Le message post-connexion : le critère, UNE question de diagnostic,
 * et la proposition d'audit — proposée, jamais imposée.
 */
export function messageText(p: Prospect, bookingUrl?: string, accountId?: string, closerName?: string): string {
  const hi = firstName(p) ? `Bonjour ${firstName(p)},` : "Bonjour,";
  /**
   * ⚠ CES TROIS PHRASES ÉTAIENT ÉCRITES EN DUR, ET DUPLIQUÉES MOT POUR MOT
   * DANS `mail-compose.ts`. Elles annonçaient toutes l'angle Alpha Voice —
   * « le téléphone est le premier point de contact », « un audit de son
   * accueil téléphonique » — quel que soit le routage de la fiche.
   *
   * Sur un prospect classé « invisible en ligne », le message proposait donc
   * un audit téléphonique pendant que l'aimant réellement servi s'appelle
   * « Audit de votre visibilité locale ». Et corriger un des deux fichiers
   * laissait l'autre mentir.
   */
  const a = approcheEcrite(p, accountId);
  const moi = identite(accountId, closerName);
  const booking = bookingUrl?.trim()
    ? ["", `Mon agenda est ouvert si vous voulez en parler un jour : ${bookingUrl.trim()}`]
    : [];
  return [
    `${hi}`,
    ``,
    `Merci pour la connexion. Je vais être direct et court.`,
    ``,
    `Je n'écris pas au hasard : je travaille avec ${a.critere}. ${a.critereMetier ?? ""}`.trim(),
    ``,
    `Une seule question, celle qui m'intéresse vraiment : ${a.question}`,
    ...(a.signal ? [``, a.signal] : []),
    ...booking,
    ``,
    // La ville vient du COMPTE : elle était en dur, donc un partenaire
    // ailleurs qu'à Lyon signait depuis une ville où il n'est pas.
    `${moi.nom} — ${moi.agence}${moi.ville ? `, ${moi.ville}` : ""}`,
  ].join("\n");
}

/**
 * La relance : le coup du méta appliqué à l'écrit — on assume le
 * silence, on ne culpabilise pas, et on ferme sur un choix binaire.
 */
export function relanceText(p: Prospect, accountId?: string, closerName?: string): string {
  const moi = identite(accountId, closerName);
  const hi = firstName(p) ? `${firstName(p)},` : "Bonjour,";
  /**
   * ⚠ « Vous êtes sur le terrain, pas sur LinkedIn » était écrit en dur.
   *
   * C'est le coup du méta, et il est excellent — sur un couvreur. Servi à un
   * directeur de programmes, qui vit sur ce réseau, il est simplement FAUX, et
   * un peu condescendant : on lui explique son propre métier de travers au
   * moment exact où on lui dit au revoir.
   *
   * La réponse existait déjà et dormait dans un autre fichier :
   * `PRESENCE_LINKEDIN` sait, verticale par verticale, si ces gens-là sont
   * réellement ici. Une seule source pour « ce métier est-il sur LinkedIn ? » —
   * en réécrire une deuxième ici garantissait qu'elles divergent.
   */
  const v = verticalForProspect(p);
  const bienIci = v ? PRESENCE_LINKEDIN[v.id] === "forte" : false;
  const meta = bienIci
    ? `Pas de réponse, et c'est normal : ce genre de message tombe rarement au bon moment.`
    : `Pas de réponse et c'est très bien — vous êtes sur le terrain, pas sur LinkedIn. C'est exactement le problème dont je parlais.`;
  return [
    `${hi}`,
    ``,
    meta,
    ``,
    `Je ne relancerai pas : vous savez où me trouver si le sujet revient un jour. Bonne continuation à ${p.company}.`,
    ``,
    `${moi.nom} — ${moi.agence}`,
  ].join("\n");
}

/**
 * ⚠ `accountId` ÉTAIT REÇU ICI ET JETÉ À LA LIGNE SUIVANTE.
 *
 * `buildLinkedinQueue` le lit dans son filtre, le passe à `textForStep`… qui
 * appelait `messageText(p, bookingUrl)` sans le transmettre. Le paramètre
 * traversait donc toute la chaîne pour mourir au dernier saut, et
 * `approcheEcrite` retombait sur « eagleye » par défaut — pour TOUS les
 * messages construits par la file, c'est-à-dire tous.
 *
 * Rien ne le signalait : sur le compte maître, le défaut EST le bon compte.
 * Le jour où un partenaire utilise la file, ses messages annoncent nos aimants
 * sous sa marque — exactement ce que la validation partenaire existe pour
 * empêcher.
 */
export function textForStep(
  p: Prospect,
  step: LinkedinStep,
  bookingUrl?: string,
  accountId?: string,
  closerName?: string
): string {
  if (step === "invitation") return inviteText(p, accountId, closerName);
  if (step === "message") return messageText(p, bookingUrl, accountId, closerName);
  // ⚠ `relanceText(p)` NE RECEVAIT NI COMPTE NI SIGNATAIRE. C'est exactement
  // le défaut décrit au-dessus — le paramètre qui meurt au dernier saut —
  // toujours présent sur cette étape-ci quand l'autre a été corrigée.
  if (step === "relance") return relanceText(p, accountId, closerName);
  return "";
}

export interface LinkedinTarget {
  prospect: Prospect;
  step: LinkedinStep;
  /** Touches LinkedIn déjà consignées sur la fiche. */
  touches: number;
  lastTouchDays: number | null;
  text: string;
  /** Le délai de cadence est respecté : on peut envoyer maintenant. */
  ready: boolean;
  /** Jours restants avant que la touche soit permise. */
  waitDays: number;
}

const DAY = 86_400_000;

function linkedinEvents(p: Prospect) {
  return p.events
    .filter((e) => e.kind === "linkedin")
    .map((e) => new Date(e.date).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);
}

/**
 * Construit la file du jour : qui en est où dans la séquence, et qui
 * est réellement « mûr » (cadence respectée).
 */
export function buildLinkedinQueue(
  prospects: Prospect[],
  // Le compte décide des aimants disponibles, donc de ce que le message a le
  // droit d'annoncer. Absent, on retombe sur EAGLEYE.
  // ⚠ `closerName` traverse jusqu'au texte. Sans lui, la file signe du
  // libellé d'usine (« Le Closer ») ou de la raison sociale — ce qui est
  // le repli VOULU, mais il faut pouvoir donner le vrai nom.
  filter?: { city?: string; bookingUrl?: string; accountId?: string; closerName?: string }
): LinkedinTarget[] {
  const city = filter?.city?.trim().toLowerCase();

  return prospects
    .filter((p) => p.stage !== "signe" && p.stage !== "perdu")
    .filter((p) => (city ? p.city.toLowerCase().includes(city) : true))
    .map((p) => {
      const evts = linkedinEvents(p);
      const touches = evts.length;
      const step: LinkedinStep = touches === 0 ? "invitation" : touches === 1 ? "message" : touches === 2 ? "relance" : "termine";
      const lastTouchDays = evts.length ? Math.floor((Date.now() - evts[0]) / DAY) : null;
      const needed = DELAY[step];
      const ready = step !== "termine" && (lastTouchDays === null || lastTouchDays >= needed);
      const waitDays = ready || step === "termine" ? 0 : Math.max(0, needed - (lastTouchDays ?? 0));
      return {
        prospect: p,
        step,
        touches,
        lastTouchDays,
        text: textForStep(p, step, filter?.bookingUrl, filter?.accountId, filter?.closerName),
        ready,
        waitDays,
      };
    })
    .sort((a, b) => {
      // Les mûrs d'abord, puis l'étape la plus avancée (on finit ce qu'on a commencé).
      if (a.ready !== b.ready) return Number(b.ready) - Number(a.ready);
      return b.touches - a.touches;
    });
}
