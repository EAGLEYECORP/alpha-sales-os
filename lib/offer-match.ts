/**
 * ─────────────────────────────────────────────────────────────────────
 * Routeur d'offre — après l'audit, QUELLE offre EAGLEYE proposer.
 *
 * La consigne terrain : on audite un prospect, puis on voit si on l'aide
 * avec…
 *   • ALPHA SALES OS   — l'OS de vente intelligent (leads à gérer, closing
 *                        à structurer, pipeline à outiller) ;
 *   • ALPHA VOICE      — l'accueil/relance IA au téléphone (appels manqués,
 *                        métiers dépendants du téléphone) ;
 *   • VISIBILITÉ / GROWTH — offre personnalisée quand le trou est d'être vu
 *                        (pas de site, faible présence, peu d'avis).
 *
 * On score chaque offre sur les VRAIS signaux de la fiche (DeepAudit), on
 * classe, et on renvoie l'offre primaire + le pourquoi + l'accroche.
 * Déterministe, sans clé, sans réseau.
 * ─────────────────────────────────────────────────────────────────────
 */

import { estMesure } from "./mesure-champ";

export type EagleyeOffer = "alpha-sales-os" | "alpha-voice" | "visibilite-growth";

export interface OfferSignals {
  sector?: string;
  missedCallsPerWeek?: number;
  googleRating?: number;
  googleReviews?: number;
  websiteState?: string;
  socialState?: string;
  /** € one-shot / récurrent — proxy « il y a du deal à outiller ». */
  monthlyValue?: number;
  avgTicket?: number;
}

export interface OfferMatch {
  primary: EagleyeOffer;
  label: string;
  scores: Record<EagleyeOffer, number>;
  reasons: Record<EagleyeOffer, string[]>;
  /** Accroche d'ouverture pour l'offre primaire. */
  pitch: string;
  /**
   * ⚠ VRAI QUAND AUCUN SIGNAL N'A ÉTÉ MESURÉ — le routage vient alors d'un
   * défaut, pas d'une observation.
   *
   * Sans ce drapeau, l'appelant ne distingue pas « on a constaté un site
   * absent » de « on n'a rien regardé et il a fallu choisir ». C'est la même
   * discipline que partout ici : un angle mort se DIT, il ne se déguise pas en
   * résultat. Il sert aussi de garde — on ne laisse un défaut contredire la
   * verticale d'un prospect qu'en le sachant.
   */
  sansSignal: boolean;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'UNE OFFRE EST, EN UN SEUL ENDROIT.
 *
 * Le libellé, l'accroche écrite et ce qui se DIT au téléphone vivent
 * ensemble. Les trois se lisent au même moment sur la même fiche : séparés,
 * ils divergent, et le prospect entend une offre pendant qu'il lit l'autre.
 *
 * ⚠ LA RAISON D'ÊTRE DES DEUX DERNIERS CHAMPS. Le script d'appel sortant
 * annonçait « proposer un audit de leur accueil téléphonique » — l'angle
 * Alpha Voice — QUEL QUE SOIT le routage. Un prospect routé vers la visibilité
 * s'entendait donc proposer autre chose que ce qu'on avait décidé de lui
 * vendre. Pire : quand le brief du deep-dive accompagnait l'appel, il portait
 * « Offre pertinente : Visibilité / Growth » pendant que le rôle disait
 * Alpha Voice. Deux offres contradictoires dans le même prompt.
 *
 * `benefice` est ce que l'agent annonce APRÈS la divulgation, et `question`
 * est la seule question — FERMÉE — qu'il pose avant de se taire. Elles sont
 * écrites pour être PRONONCÉES : courtes, sans jargon, sans chiffre — la
 * règle « jamais de prix au téléphone » ne se négocie pas.
 *
 * ⚠ `raisonAppel` a été SUPPRIMÉ le 28/08/2026, pas mis de côté. Il portait
 * l'ouverture en diagnostic (« comprendre comment vous suivez vos demandes »)
 * que `benefice` remplace. Le garder « au cas où » aurait laissé un champ que
 * plus rien ne lit, avec un commentaire affirmant qu'il sert — et ce dépôt
 * paie déjà assez cher les mécanismes câblés nulle part.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface OffreCommerciale {
  label: string;
  /** Accroche écrite (fiche, email, deck). */
  pitch: string;
  /**
   * ── LE BÉNÉFICE, ET RIEN D'AUTRE (doctrine du 28/08/2026) ──
   *
   * ⚠ CE QUI A CHANGÉ, ET POURQUOI. L'appel ouvrait en DIAGNOSTIC :
   * « je voudrais comprendre comment vous suivez vos demandes aujourd'hui ».
   * C'est une bonne question de découverte — dans un rendez-vous. À froid,
   * elle demande au prospect de faire un effort d'introspection sur son
   * propre désordre, avant même de savoir ce qu'il a à y gagner. Il n'a
   * aucune raison de le fournir à un inconnu qui vient de se présenter comme
   * une IA.
   *
   * On dit donc d'abord le RÉSULTAT qu'il veut, et on lui demande s'il le
   * veut. C'est une question FERMÉE : oui ou non. Un oui ouvre le rendez-vous,
   * un non raccroche. Aucun des deux ne demande à l'agent d'improviser — et
   * c'est exactement la contrainte que s'impose une IA qui démarche.
   *
   * Le bénéfice se dit dans les mots du client, jamais dans les nôtres :
   * `auditBenefice` refuse le jargon (voir plus bas). « Ton calendrier se
   * remplit tout seul » est un bénéfice ; « automatisation de la prise de
   * rendez-vous » est une fiche produit.
   */
  benefice: string;
  /** La question FERMÉE qui suit le bénéfice. Oui → RDV. Non → on raccroche. */
  question: string;
  /**
   * Ce qu'on répond au OUI, avant de proposer le créneau. Une phrase.
   * Jamais un COMMENT : le comment est le sujet du rendez-vous.
   */
  miseEnPlace: string;
  /**
   * Ce qui SE PERD sur ce canal — la question qui fait chiffrer la fuite.
   * Elle suit toujours l'ouverture : d'abord ce qui se passe, ensuite combien.
   */
  perte: string;
  /** Ce que deviennent ceux qu'on perd. La question qui fait constater le coût. */
  consequence: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE JARGON QUI TUE UN APPEL À FROID.
 *
 * Un bénéfice se dit dans les mots du client. Dès qu'on prononce un mot de
 * NOTRE métier, on demande au prospect de traduire — et un artisan qui doit
 * traduire raccroche. « Automatisation de la relance » n'est pas un bénéfice,
 * c'est la description de notre travail.
 *
 * ⚠ CE QUI SE VÉRIFIE ICI, ET CE QUI NE SE VÉRIFIE PAS. Cette garde porte sur
 * les CHAMPS du catalogue (`benefice`, `question`), jamais sur le script
 * assemblé. La raison est dure : l'article 50 EXIGE que la première phrase
 * dise « intelligence artificielle ». Passer le script entier ici ferait
 * refuser tout appel conforme — la garde du bénéfice et l'obligation légale
 * se contrediraient, et c'est la légale qui perdrait, parce que c'est celle
 * qu'on serait tenté d'assouplir.
 *
 * On interdit le NOM abstrait, pas l'effet. « Votre agenda se remplit tout
 * seul » est autorisé et recherché ; « automatisation » ne l'est pas.
 * ─────────────────────────────────────────────────────────────────────
 */
export const JARGON_INTERDIT: { mot: string; pattern: RegExp; pourquoi: string }[] = [
  // ⚠ Pas de `\b` en fin de motif après une lettre accentuée : « é » n'est pas
  // un caractère de mot ASCII et la limite ne matche jamais. Ce dépôt a déjà
  // payé ce bug une fois (`intéressé\b`, mort-né).
  { mot: "IA / intelligence artificielle", pattern: /\b(?:i\.?a\.?|intelligence artificielle)\b/i, pourquoi: "La divulgation légale l'a déjà dit une fois. Le répéter dans l'argumentaire vend la technique, pas le résultat." },
  { mot: "agent vocal", pattern: /agents? vocal/i, pourquoi: "Le client n'achète pas un agent, il achète un agenda plein." },
  { mot: "automatisation", pattern: /automatisation|automatis[ée]/i, pourquoi: "C'est le nom de NOTRE travail. Le sien, c'est « je n'ai plus à y penser »." },
  { mot: "workflow / process", pattern: /workflow|process(?:us)?\b/i, pourquoi: "Vocabulaire de consultant. Il fait reculer un artisan." },
  { mot: "CRM / pipeline", pattern: /\bcrm\b|\bpipelines?\b/i, pourquoi: "Un outil, pas un bénéfice. Il n'a jamais voulu de CRM." },
  { mot: "solution / plateforme / SaaS", pattern: /\bsolutions?\b|plateformes?|\bsaas\b/i, pourquoi: "Mots vides. Ils ne décrivent aucun résultat et sonnent comme tous les autres appels de la journée." },
  { mot: "intégration / API", pattern: /int[ée]gration|\bapi\b/i, pourquoi: "Le comment. Il est le sujet du rendez-vous, jamais de l'appel." },
  { mot: "digitalisation / transformation", pattern: /digitalisation|transformation digitale/i, pourquoi: "Le mot que tout le monde lui a déjà servi. Il ne veut rien dire pour lui." },
  { mot: "optimiser / booster", pattern: /optimis|boost/i, pourquoi: "Verbes de brochure. Ils promettent « mieux » sans dire quoi." },
  { mot: "innovant / révolutionnaire", pattern: /innovant|r[ée]volutionnaire|disrupti/i, pourquoi: "Invérifiable, et zéro vente à ce jour ne permet de l'affirmer." },
];

export interface VerdictBenefice {
  ok: boolean;
  /** Les mots trouvés, avec la raison de leur interdiction. */
  trouves: { mot: string; pourquoi: string }[];
}

/**
 * Le texte est-il un BÉNÉFICE, ou une fiche produit ?
 *
 * Rend le verdict et les mots fautifs. Pur : aucune correction automatique —
 * réécrire à la place de l'opérateur produirait une phrase que personne
 * n'assume, et c'est lui qui la fera prononcer à de vraies personnes.
 */
export function auditBenefice(texte: string): VerdictBenefice {
  const trouves = JARGON_INTERDIT.filter((j) => j.pattern.test(texte)).map((j) => ({
    mot: j.mot,
    pourquoi: j.pourquoi,
  }));
  return { ok: trouves.length === 0, trouves };
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ CES QUINZE CHAMPS SONT PASSÉS DU REGISTRE ARTISAN AU REGISTRE MAÎTRISE
 * D'OUVRAGE — décidé et validé le 10/09/2026.
 *
 * ── POURQUOI ──
 *
 * Ils ont été écrits pour le marché d'origine : « votre agenda se remplit
 * tout seul pendant que vous vous occupez de votre métier », « combien
 * d'appels vous n'arrivez pas à prendre ». C'est juste pour un plombier sous
 * un évier. Dit à un directeur de programmes, ça décrit un problème qu'il
 * n'a pas — et il raccroche, non pas parce qu'il n'est pas intéressé, mais
 * parce qu'on vient de prouver qu'on ne connaît pas son métier.
 *
 * ⚠⚠ ET IL Y AVAIT PIRE QU'UN DÉCALAGE DE TON : UNE CONTRADICTION DANS LE
 * CODE. La verticale `maitrise-ouvrage` (`lib/playbook.ts`) interdit
 * explicitement « vous ratez des appels » — « faux ici, et ça prouve qu'on
 * n'a pas compris le métier ». Or `OFFRES["alpha-voice"].perte` demandait mot
 * pour mot « combien d'appels vous n'arrivez pas à prendre », et
 * `buildVoiceScript` injecte les DEUX dans le même prompt : l'interdit de la
 * verticale et la phrase qui le viole, à trois lignes d'écart.
 *
 * Personne ne l'avait vu parce que rien ne le vérifiait. C'est fait :
 * `tests/playbook-interdits.test.ts` assemble le script de chaque verticale
 * et refuse qu'il contienne un interdit de cette verticale.
 *
 * ── CE QUE ÇA COÛTE, ET C'EST ASSUMÉ ──
 *
 * ⚠ CES CHAMPS SONT GLOBAUX : ils se prononcent sur TOUS les comptes, Nuwacom
 * compris, dont l'ICP est l'assurance. « aucun acquéreur ne se perd entre sa
 * visite et sa réservation » ne veut rien dire pour un assureur. Aujourd'hui
 * le pipe est entièrement maîtrise d'ouvrage, donc c'est cohérent — mais
 * c'est une DETTE, pas une solution : le bon design est un registre par
 * verticale, et il n'existe pas. Le jour où un deuxième marché entre, ces
 * champs doivent bouger avec lui, ou mentir.
 *
 * ── CE QUI A ÉTÉ VÉRIFIÉ AVANT D'ÉCRIRE ──
 *
 * Les quinze passent `auditBenefice` (zéro jargon interdit), et le script
 * assemblé passe `auditScript` — art. 50 compris.
 * ─────────────────────────────────────────────────────────────────────
 */
export const OFFRES: Record<EagleyeOffer, OffreCommerciale> = {
  "alpha-sales-os": {
    label: "Alpha Sales OS — l'OS de vente intelligent",
    pitch:
      "« Ce ne sont pas les acquéreurs que vous n'avez jamais vus qui coûtent cher. " +
      "Ce sont ceux qui sont venus, et que personne n'a rappelés. »",
    benefice:
      "aucun acquéreur ne se perd entre sa visite et sa réservation : chacun est suivi, rappelé au bon " +
      "moment, et vous voyez chaque lundi matin qui attend encore une réponse",
    question: "Vous aimeriez voir, chaque lundi matin, quels acquéreurs intéressés n'ont pas été rappelés ?",
    miseEnPlace: "C'est exactement ce qu'on met en place.",
    /**
      * ⚠ Cette question est celle du `diagnostic` de la verticale
      * `maitrise-ouvrage`, mot pour mot. Ce n'est PAS un doublon : le
      * diagnostic est ce que l'HUMAIN pose en rendez-vous, `perte` est ce que
      * l'agent pose au téléphone. Les faire coïncider est un choix — le même
      * constat, aux deux bouts de la chaîne — et si l'un des deux change,
      * l'autre doit suivre à la main.
      */
    perte: "Un acquéreur qui a visité il y a trois semaines et que personne n'a rappelé — vous le sauriez comment, aujourd'hui ?",
    consequence: "Et ceux-là, ils achètent où, à votre avis ?",
  },
  "alpha-voice": {
    label: "Alpha Voice — l'accueil & relance IA au téléphone",
    /**
      * ⚠ L'ANCIENNE ACCROCHE ÉTAIT « chaque appel manqué est un client qui
      * appelle le concurrent ». C'est l'affirmation que la verticale
      * `maitrise-ouvrage` interdit en toutes lettres.
      *
      * Ce qui la remplace ne l'affirme plus : elle nomme un MOMENT vérifiable
      * — l'équipe est en visite, le bureau sonne — et la `perte` ci-dessous
      * pose la question au lieu de conclure à sa place. C'est la même
      * discipline que l'opener du playbook : l'observation en question,
      * jamais en affirmation.
      */
    pitch: "« Quand l'équipe est en visite, votre bureau de vente continue de sonner. On le prend à votre place. »",
    benefice:
      "les gens qui appellent votre bureau de vente quand l'équipe est en visite ou fermée sont pris quand " +
      "même : on note qui ils sont et ce qu'ils cherchent, et vous les rappelez avec leur nom devant vous",
    question: "Vous aimeriez savoir qui a appelé votre bureau de vente pendant que l'équipe était en visite ?",
    miseEnPlace: "C'est exactement ce qu'on met en place.",
    // Ces deux-là existaient déjà, mot pour mot, dans `buildArgumentaire` :
    // elles sont remontées ici pour que les trois offres se lisent au même
    // endroit — rien n'a été réécrit.
    perte: "Quand l'équipe est en visite ou que le bureau est fermé, les appels arrivent où ?",
    consequence: "Et ceux qui tombent sur la messagerie — ils rappellent, ou ils vont voir le programme d'à côté ?",
  },
  "visibilite-growth": {
    label: "Visibilité / Growth — offre personnalisée",
    pitch:
      "« Quelqu'un qui cherche du neuf dans le quartier doit tomber sur votre programme, " +
      "pas sur celui d'en face. »",
    benefice:
      "quelqu'un qui cherche un logement neuf dans le secteur tombe sur votre programme et pas sur celui " +
      "d'en face, et vous arrêtez de dépendre du panneau et des portails",
    question: "Vous aimeriez que les gens qui cherchent du neuf dans le secteur tombent sur votre programme ?",
    miseEnPlace: "C'est exactement ce qu'on met en place.",
    perte: "Quelqu'un qui cherche du neuf dans le quartier, sans connaître votre programme : il le trouve ?",
    consequence: "Et ceux qui ne le trouvent pas — ils visitent quoi, à votre avis ?",
  },
};

/**
 * ⚠ CES DEUX TABLES SONT DÉRIVÉES, PAS RECOPIÉES. Elles gardent leur nom
 * parce que des écrans les importent déjà ; ce qui change, c'est qu'il n'existe
 * plus qu'une seule saisie derrière.
 */
export const OFFER_LABELS: Record<EagleyeOffer, string> = {
  "alpha-sales-os": OFFRES["alpha-sales-os"].label,
  "alpha-voice": OFFRES["alpha-voice"].label,
  "visibilite-growth": OFFRES["visibilite-growth"].label,
};

const OFFER_PITCH: Record<EagleyeOffer, string> = {
  "alpha-sales-os": OFFRES["alpha-sales-os"].pitch,
  "alpha-voice": OFFRES["alpha-voice"].pitch,
  "visibilite-growth": OFFRES["visibilite-growth"].pitch,
};

// Métiers très dépendants du téléphone (accueil, prise de RDV, urgence).
const PHONE_HEAVY = ["garage", "carrosserie", "auto", "conduite", "école", "ambulance", "santé", "médical", "chirurgie", "dentaire", "immobilier", "agence", "taxi", "vtc", "restaurant", "coiffure", "beauté", "spa", "plomb", "artisan", "serrur", "bâtiment", "maître", "oeuvre", "œuvre"];
// Métiers avec une vraie fonction commerciale / cycle de vente B2B.
const SALES_HEAVY = ["agence", "conseil", "avocat", "juri", "b2b", "service", "saas", "logiciel", "marketing", "immobilier", "courtier", "assur", "compt", "maître", "oeuvre", "œuvre", "promoteur", "construction"];

const hit = (s: string | undefined, needles: string[]) => {
  const t = (s ?? "").toLowerCase();
  return needles.some((n) => t.includes(n));
};

/**
 * Site absent / obsolète → trou de visibilité.
 *
 * ⚠⚠ CES DEUX FONCTIONS RENDAIENT `true` SUR UNE CHAÎNE VIDE, ET C'EST CE QUI
 * ROUTAIT TOUT LE MONDE VERS LA VISIBILITÉ — 17/09/2026.
 *
 * `!t` était en tête de chaque test : « pas de valeur » y valait « pas de
 * site ». Or `prospectDefaults.deepAudit` — le socle de TOUS les imports —
 * écrit `websiteState: ""`, parce que le type `DeepAudit` déclare ce champ
 * `string` OBLIGATOIRE. Chaque fiche importée arrivait donc avec un « site
 * absent » que personne n'avait jamais constaté.
 *
 * Mesuré sur le chemin ICP réel : **8 fiches sur 8** partaient sur l'offre
 * Visibilité / Growth, dont la verticale `maitrise-ouvrage` n'est pas
 * porteuse — un arrêté de permis ne dit rien d'un site ni de réseaux.
 *
 * « aucun » RESTE un signal, et c'est même le plus fort : quelqu'un est allé
 * voir. Ce qui disparaît, c'est le vide — voir `lib/mesure-champ.ts`.
 */
function weakWebsite(state?: string): boolean {
  if (!estMesure(state)) return false;
  const t = (state ?? "").toLowerCase().trim();
  if (t === "aucun" || t === "aucune" || t === "non") return true;
  return t.includes("obsol") || t.includes("2014") || t.includes("vieux") || t.includes("datant");
}

function weakSocial(state?: string): boolean {
  if (!estMesure(state)) return false;
  const t = (state ?? "").toLowerCase().trim();
  return t === "aucun" || t === "aucune" || t.includes("faible") || t.includes("inactif") || t.includes("abandon");
}

/**
 * @param allowed  Offres autorisées pour le compte courant (lib/accounts.ts).
 *   Un compte mono-offre ne doit JAMAIS se voir
 *   proposer autre chose, même si l'audit pointe ailleurs. Absent/vide = les
 *   trois (compte maître). Un `allowed` d'une seule offre force cette offre.
 * @param defautSansSignal  L'offre à retenir quand RIEN n'est mesuré — en
 *   pratique celle que sert la verticale du prospect. Voir le commentaire du
 *   repli, plus bas : ce paramètre ne peut jamais renverser un signal.
 */
export function matchOffer(
  sig: OfferSignals,
  allowed?: EagleyeOffer[],
  defautSansSignal?: EagleyeOffer
): OfferMatch {
  const scores: Record<EagleyeOffer, number> = { "alpha-sales-os": 0, "alpha-voice": 0, "visibilite-growth": 0 };
  const reasons: Record<EagleyeOffer, string[]> = { "alpha-sales-os": [], "alpha-voice": [], "visibilite-growth": [] };

  // ── Alpha Voice : appels manqués + métier téléphone ──
  const missed = sig.missedCallsPerWeek ?? 0;
  if (missed >= 5) { scores["alpha-voice"] += 3; reasons["alpha-voice"].push(`${missed} appels manqués/semaine — autant de clients perdus`); }
  else if (missed >= 2) { scores["alpha-voice"] += 2; reasons["alpha-voice"].push(`${missed} appels manqués/semaine`); }
  if (hit(sig.sector, PHONE_HEAVY)) { scores["alpha-voice"] += 2; reasons["alpha-voice"].push("métier très dépendant du téléphone"); }

  // ── Alpha Sales OS : fonction commerciale + deals à outiller ──
  if (hit(sig.sector, SALES_HEAVY)) { scores["alpha-sales-os"] += 2; reasons["alpha-sales-os"].push("cycle de vente / leads à structurer"); }
  const value = Math.max(sig.monthlyValue ?? 0, sig.avgTicket ?? 0);
  if (value >= 3000) { scores["alpha-sales-os"] += 2; reasons["alpha-sales-os"].push("panier/valeur élevé — le closing mérite un OS"); }
  else if (value >= 800) { scores["alpha-sales-os"] += 1; reasons["alpha-sales-os"].push("valeur de deal significative"); }

  // ── Visibilité / Growth : invisible en ligne ──
  /**
   * ⚠ LE GARDE ÉTAIT ÉCRIT SUR UN ÉTAT QUE LE TYPE REND IMPOSSIBLE. Il disait
   * « Donnée ABSENTE (undefined) ≠ signal : on ne score que ce qui est
   * mesuré » — l'intention exacte — et testait `!== undefined` sur un champ
   * que `DeepAudit` déclare `string` obligatoire. Il ne s'est jamais
   * déclenché. La question se pose désormais là où elle se pose pour de vrai,
   * dans `weakWebsite` / `weakSocial`, sur « est-ce mesuré ? ».
   */
  if (weakWebsite(sig.websiteState)) { scores["visibilite-growth"] += 3; reasons["visibilite-growth"].push("site absent ou obsolète"); }
  if (sig.googleRating !== undefined && sig.googleRating < 4) { scores["visibilite-growth"] += 1; reasons["visibilite-growth"].push(`note Google faible (${sig.googleRating}/5)`); }
  if (sig.googleReviews !== undefined && sig.googleReviews < 10) { scores["visibilite-growth"] += 1; reasons["visibilite-growth"].push("peu d'avis Google — faible preuve sociale"); }
  if (weakSocial(sig.socialState)) { scores["visibilite-growth"] += 1; reasons["visibilite-growth"].push("réseaux sociaux inexistants ou inactifs"); }

  // Classement. Départage stable : alpha-voice > visibilité > alpha (le plus
  // « proximité » d'abord, cohérent avec le pipe terrain), à score égal.
  // On ne classe QUE parmi les offres autorisées du compte.
  const fullOrder: EagleyeOffer[] = ["alpha-voice", "visibilite-growth", "alpha-sales-os"];
  const permitted = allowed && allowed.length ? allowed : fullOrder;
  const order = fullOrder.filter((o) => permitted.includes(o));
  // Repli défensif : un `allowed` vide après filtre → on garde tout.
  const ranking = order.length ? order : fullOrder;

  let primary: EagleyeOffer = ranking[0];
  let best = -1;
  for (const o of ranking) {
    if (scores[o] > best) { best = scores[o]; primary = o; }
  }
  /**
   * ══ AUCUN SIGNAL MESURÉ : C'EST LA VERTICALE QUI TRANCHE, PAS UN ORDRE ══
   *
   * ⚠⚠ LA RÈGLE, ET ELLE EST DISSYMÉTRIQUE EXPRÈS : **un signal MESURÉ a le
   * droit de contredire la verticale ; un départage à score nul ne l'a pas.**
   *
   * Un maître d'ouvrage dont on a CONSTATÉ qu'il n'a pas de site part sur la
   * visibilité, et c'est juste — c'est la première marche de l'escalier, et
   * elle revient au même compte. Mais un maître d'ouvrage sur lequel on n'a
   * RIEN relevé partait, lui aussi, sur une offre choisie par un ordre écrit
   * en dur ici. Deux définitions de « qu'est-ce qu'on lui vend ? » dans le
   * même produit, dont une qui ne repose sur rien.
   *
   * Le défaut codé en dur (`alpha-sales-os`) tombait juste pour la maîtrise
   * d'ouvrage par COÏNCIDENCE — c'est bien l'offre que sa verticale sert. Sur
   * les neuf verticales qui servent Alpha Voice, il tombe faux, et personne ne
   * l'aurait vu : rien n'échoue quand un routage se trompe, on s'en aperçoit
   * en lisant le message qu'on s'apprête à envoyer.
   *
   * ⚠ Le défaut ne s'applique QUE s'il est autorisé sur le compte : un compte
   * partenaire mono-offre ne se voit jamais proposer autre chose, quelle que
   * soit la verticale de la fiche.
   */
  const sansSignal = best <= 0;
  if (sansSignal) {
    primary =
      defautSansSignal && ranking.includes(defautSansSignal)
        ? defautSansSignal
        : ranking.includes("alpha-sales-os")
          ? "alpha-sales-os"
          : ranking[0];
  }

  return { primary, label: OFFER_LABELS[primary], scores, reasons, pitch: OFFER_PITCH[primary], sansSignal };
}
