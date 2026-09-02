/**
 * ─────────────────────────────────────────────────────────────────────
 * Cadence de rappel — 5 rappels sur 2 jours après le premier appel sans
 * réponse. Dès qu'il répond, Alpha Voice ARRÊTE d'appeler, met à jour le
 * pipeline, et passe la main à l'humain (closer).
 *
 * ⚠⚠ QUI DÉCIDE DE CE CHIFFRE — LA RÉPONSE A CHANGÉ, LIS-LA.
 *
 * Ces 5 rappels étaient EXIGÉS par un partenaire, pour son produit. L'accord
 * est mort. Personne ne les exige donc plus : ce n'est plus une contrainte
 * subie, c'est un CHOIX, et il t'appartient.
 *
 * Ça mérite d'être redit parce que le chiffre est agressif : 6 contacts en
 * 2 jours (voir le conflit avec le décret plus bas). On le tenait parce qu'il
 * fallait tenir un compte. Ce compte n'existe plus. Si tu le gardes, garde-le
 * en le sachant — et il n'y a plus de raison commerciale de ne pas le baisser.
 *
 * Deux points non négociables, et c'est le cœur du module :
 *  1. Le compteur s'arrête à la RÉPONSE, pas au nombre d'essais. Un agent qui
 *     continue d'appeler quelqu'un qui a décroché détruit la relation — et
 *     maintenant c'est NOTRE marque qui le fait, plus celle d'un tiers.
 *  2. Une opposition (« ne me rappelez plus ») coupe TOUT, définitivement,
 *     immédiatement. Elle prime sur la cadence, sur le quota, sur tout.
 *
 * Module pur : il calcule QUAND rappeler et QUAND s'arrêter. Il ne passe
 * aucun appel — c'est l'orchestrateur qui exécute.
 * ─────────────────────────────────────────────────────────────────────
 */

import { fenetreOuverte } from "./conformite";

/** 5 rappels après le 1er appel, étalés sur 2 jours (heures depuis le 1er appel). */
export const RAPPELS_OFFSETS_H = [3, 8, 24, 32, 48];
export const RAPPELS_MAX = RAPPELS_OFFSETS_H.length;

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ LE CONFLIT ENTRE CETTE CADENCE ET LE DROIT FRANÇAIS.
 *
 * La cadence fait **6 contacts en 2 jours** (le premier
 * appel plus cinq rappels). Le décret n° 2022-1313 plafonne le démarchage
 * téléphonique à **4 sollicitations par consommateur sur 30 jours glissants**.
 *
 * Il vise le B2C. Or une liste de prospection terrain est MÊLÉE : un artisan
 * en nom propre sur sa ligne mobile est exactement la zone grise, et c'est
 * nous qui portons le risque.
 *
 * ── CE QUE CE CODE FAIT, ET CE QU'IL NE FAIT PAS ──
 *
 * Il ne tranche PAS le choix commercial : sur une cible clairement
 * professionnelle, la cadence complète s'applique. Il empêche seulement la
 * cadence longue de partir en silence sur une cible à risque.
 *
 * Le discriminant est le SIREN. Une fiche croisée avec le registre des
 * entreprises est une entreprise inscrite — donc B2B. Une fiche sans SIREN,
 * sur un mobile, ne prouve rien : elle est plafonnée jusqu'à ce que quelqu'un
 * la qualifie.
 *
 * Avant, l'app AVERTISSAIT à l'import (`planifierAppels` alerte au-delà de 4)
 * et EXÉCUTAIT six contacts ici. Un avertissement qui ne pilote rien est un
 * avertissement qu'on apprend à ignorer.
 * ─────────────────────────────────────────────────────────────────────
 */
export const PLAFOND_SOLLICITATIONS_B2C = 4;

export interface RisqueCible {
  /** SIREN connu = entreprise inscrite au registre = B2B établi. */
  siren?: string;
  /** Numéro appelé, en E.164 ou en national. */
  telephone?: string;
}

/** Un mobile français : 06 / 07, ou +336 / +337. */
const MOBILE_FR = /^(?:\+33|0)\s*[67]/;

/**
 * Le SIREN, tel que l'import terrain l'écrit dans les notes après croisement
 * au registre. Un seul motif, partagé — deux relectures différentes du même
 * champ finissent par donner deux plafonds différents pour la même fiche.
 */
const SIREN_DANS_NOTES = /\bSIREN\s*:?\s*(\d{9})\b/i;

/**
 * La cible de risque d'un prospect — LE point d'entrée unique.
 *
 * ⚠ Appeler `cadenceFor` sans cible retombe sur la cadence complète
 * (5 rappels), c'est-à-dire au-dessus du plafond légal quand la fiche n'a pas
 * de SIREN. C'était le cas de `masterRappel` : le plan affiché à l'humain
 * annonçait « rappel 3/5 » pendant que l'autopilote, lui, s'arrêtait à 4.
 * Deux réponses pour la même fiche, et celle montrée était la mauvaise.
 */
export function cibleDepuisProspect(p: { phone?: string; notes?: string }): RisqueCible {
  return {
    telephone: p.phone,
    siren: (p.notes ?? "").match(SIREN_DANS_NOTES)?.[1],
  };
}

/**
 * Le nombre de rappels réellement autorisés sur cette cible.
 *
 * Rend AUSSI la raison : un plafond appliqué sans motif se contourne au
 * premier agacement, et celui-ci a une justification juridique qu'il faut
 * pouvoir relire.
 */
export function plafondRappels(cible: RisqueCible = {}): { max: number; plafonne: boolean; pourquoi: string } {
  const siren = (cible.siren ?? "").replace(/\D/g, "");
  if (siren.length >= 9) {
    return {
      max: RAPPELS_MAX,
      plafonne: false,
      pourquoi: `SIREN ${siren} — entreprise inscrite au registre, la cadence complète s'applique.`,
    };
  }

  const mobile = MOBILE_FR.test((cible.telephone ?? "").replace(/[\s.-]/g, ""));
  // Le premier appel compte dans les sollicitations : 4 au total = 3 rappels.
  const max = PLAFOND_SOLLICITATIONS_B2C - 1;
  return {
    max: Math.min(max, RAPPELS_MAX),
    plafonne: true,
    pourquoi: mobile
      ? "Mobile sans SIREN : la cible peut être un particulier ou un artisan en nom propre. Plafonné à 4 sollicitations sur 30 jours (décret n° 2022-1313) — croise la fiche avec le registre pour lever le plafond."
      : "Aucun SIREN : rien ne prouve que la cible est une entreprise inscrite. Plafonné à 4 sollicitations sur 30 jours (décret n° 2022-1313) — croise la fiche avec le registre pour lever le plafond.",
  };
}

export type CallOutcome =
  /** Personne n'a décroché (sonnerie, répondeur). */
  | "sans-reponse"
  /**
   * Il a décroché et parlé, sans intérêt qualifié — la cadence s'arrête, mais
   * AUCUN humain n'est appelé.
   *
   * ⚠ CE CAS RENVOYAIT `handoffToHuman: true`. NOUVELLE DOCTRINE (28/08/2026).
   *
   * Avant, Alpha Voice ne faisait que composer : dès qu'on décrochait, il se
   * retirait et un closer prenait la conversation. Un « pas intéressé pour
   * l'instant » consommait donc autant de temps humain qu'un rendez-vous
   * obtenu — et c'est ce qui rendait le volume impossible (500 appels à 30 %
   * de décroché = 150 conversations = cinq closers).
   *
   * Alpha Voice mène désormais l'appel à froid entier. Un refus ou un
   * « rappelez-moi » se traite et se consigne sans personne.
   */
  | "repondu"
  /**
   * INTÉRÊT QUALIFIÉ — il a dit oui à la suite (rendez-vous, audit).
   *
   * C'est le SEUL cas qui réveille un humain, et c'est tout le sens de la
   * nouvelle doctrine : la machine dépense les appels, l'humain dépense son
   * temps uniquement là où il y a quelque chose à closer.
   */
  | "interesse"
  /** Il a demandé à ne plus être appelé — arrêt définitif. */
  | "opposition"
  /** Numéro invalide / injoignable — inutile d'insister. */
  | "invalide";

export interface CallAttempt {
  /** ISO. */
  at: string;
  outcome: CallOutcome;
}

export type CadenceState =
  | "a-appeler"
  | "en-cadence"
  | "attente"
  | "epuisee"
  | "repondu-passer-humain"
  | "stop-definitif";

export interface CadenceDecision {
  state: CadenceState;
  /** Faut-il appeler MAINTENANT ? */
  callNow: boolean;
  /** Prochain rappel prévu (ISO), si la cadence continue. */
  nextCallAt: string | null;
  /** Rappels déjà consommés (hors 1er appel). */
  recallsUsed: number;
  recallsLeft: number;
  /** L'humain doit-il reprendre la main ? */
  handoffToHuman: boolean;
  /** Explication lisible — s'affiche dans la salle de contrôle. */
  reason: string;
}

const H = 3600_000;

/**
 * L'état de la cadence pour UN prospect, d'après ses tentatives.
 * `now` injectable pour les tests (et pour rejouer un historique).
 */
export function cadenceFor(
  attempts: CallAttempt[],
  now: Date = new Date(),
  cible: RisqueCible = {}
): CadenceDecision {
  const sorted = [...attempts].sort((a, b) => a.at.localeCompare(b.at));
  const plafond = plafondRappels(cible);

  // ── Arrêts définitifs : ils priment sur tout le reste ──
  const opposed = sorted.find((a) => a.outcome === "opposition");
  if (opposed) {
    return {
      state: "stop-definitif",
      callNow: false,
      nextCallAt: null,
      recallsUsed: Math.max(0, sorted.length - 1),
      recallsLeft: 0,
      handoffToHuman: false,
      reason: "Opposition exprimée — plus aucun appel, définitivement.",
    };
  }
  const invalid = sorted.find((a) => a.outcome === "invalide");
  if (invalid) {
    return {
      state: "stop-definitif",
      callNow: false,
      nextCallAt: null,
      recallsUsed: Math.max(0, sorted.length - 1),
      recallsLeft: 0,
      handoffToHuman: false,
      reason: "Numéro invalide ou injoignable — on arrête d'appeler.",
    };
  }

  /**
   * ── INTÉRÊT QUALIFIÉ : c'est ICI, et seulement ici, qu'on réveille un humain ──
   *
   * Testé AVANT « répondu » : une fiche qui porte les deux (il a parlé lors
   * d'un appel, il a dit oui lors d'un autre) doit passer la main.
   */
  const interested = sorted.find((a) => a.outcome === "interesse");
  if (interested) {
    return {
      state: "repondu-passer-humain",
      callNow: false,
      nextCallAt: null,
      recallsUsed: Math.max(0, sorted.length - 1),
      recallsLeft: 0,
      handoffToHuman: true,
      reason: "Intérêt qualifié — Alpha Voice arrête, pipeline mis à jour, la main passe au closer.",
    };
  }

  /**
   * ── Il a parlé, sans dire oui : la cadence s'arrête, l'humain n'est PAS appelé ──
   *
   * ⚠ Ce cas rendait `handoffToHuman: true`. Voir la note sur `CallOutcome` :
   * un « pas intéressé » coûtait autant de temps humain qu'un rendez-vous.
   */
  const answered = sorted.find((a) => a.outcome === "repondu");
  if (answered) {
    return {
      state: "repondu-passer-humain",
      callNow: false,
      nextCallAt: null,
      recallsUsed: Math.max(0, sorted.length - 1),
      recallsLeft: 0,
      handoffToHuman: false,
      reason:
        "Il a parlé à Alpha Voice sans donner suite — la cadence s'arrête, mais aucun humain n'est mobilisé. " +
        "La fiche repart en réactivation.",
    };
  }

  // ── Aucun appel encore passé ──
  const first = sorted[0];
  if (!first) {
    return {
      state: "a-appeler",
      callNow: true,
      nextCallAt: now.toISOString(),
      recallsUsed: 0,
      recallsLeft: RAPPELS_MAX,
      handoffToHuman: false,
      reason: "Premier appel à passer.",
    };
  }

  // ── En cadence : 5 rappels calés sur le PREMIER appel ──
  const t0 = new Date(first.at).getTime();
  const recallsUsed = sorted.length - 1;
  const recallsLeft = plafond.max - recallsUsed;

  if (recallsLeft <= 0) {
    return {
      state: "epuisee",
      callNow: false,
      nextCallAt: null,
      recallsUsed,
      recallsLeft: 0,
      handoffToHuman: true,
      reason: plafond.plafonne
        ? `Plafond atteint (${plafond.max} rappels). ${plafond.pourquoi}`
        : `${plafond.max} rappels sur 2 jours sans réponse — on arrête d'appeler et on repasse à l'humain (autre canal).`,
    };
  }

  // ⚠ La MÊME liste que la prévisualisation, calée sur les fenêtres ouvertes.
  // Recalculer l'offset ici ferait annoncer une heure à l'écran et en composer
  // une autre — deux sources pour la même question.
  const nextAt = rappelsCales(first.at)[recallsUsed];
  const due = nextAt.getTime() <= now.getTime();
  return {
    state: due ? "en-cadence" : "attente",
    callNow: due,
    nextCallAt: nextAt.toISOString(),
    recallsUsed,
    recallsLeft,
    handoffToHuman: false,
    reason: due
      ? `Rappel ${recallsUsed + 1}/${plafond.max} dû.`
      : `Rappel ${recallsUsed + 1}/${plafond.max} prévu à ${nextAt.toLocaleString("fr-FR")}.`,
  };
}


/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ LA CADENCE NE REGARDAIT PAS L'HEURE QU'ELLE PROPOSAIT.
 *
 * Les offsets [3, 8, 24, 32, 48] se calculent depuis le premier appel, en
 * heures sèches. `fenetreOuverte` (lib/conformite.ts) sait depuis toujours
 * quelles heures valent quelque chose — 9h-12h et 14h-18h, jamais le
 * déjeuner, jamais le week-end. Les deux modules ne se parlaient pas.
 *
 * MESURÉ, pas supposé :
 *  · premier appel lundi 9h30 → le rappel n°1 tombe à 12h30, l'heure que
 *    notre propre module décrit comme « taux de décroché au plancher, et
 *    l'agacement au plafond » ;
 *  · premier appel JEUDI 16h → 4 rappels sur 5 hors fenêtre, dont un à
 *    MINUIT ;
 *  · premier appel VENDREDI 10h → **5 sur 5 brûlés**, trois le week-end.
 *
 * Ce n'est pas un détail d'affichage. Sur une cible sans SIREN le plafond
 * légal est de 4 sollicitations : en gaspiller une au déjeuner, c'est perdre
 * un quart de tout ce à quoi on a droit sur ce prospect. Et un lot sourcé un
 * vendredi ne serait jamais rappelé du tout.
 *
 * ── LA RÈGLE, QUI EST CELLE DU MASTER RAPPEL ──
 *
 * « Toujours au bon moment » : l'offset dit QUAND ON VOUDRAIT rappeler, la
 * fenêtre dit QUAND ÇA SERT. On garde l'intention et on la fait glisser
 * jusqu'à la prochaine heure ouverte. Deux rappels ne peuvent pas tomber au
 * même instant : le second glisse encore.
 *
 * On avance par pas de 15 minutes plutôt qu'en calculant des heures locales.
 * C'est plus lent et c'est voulu : l'arithmétique de fuseau autour d'un
 * changement d'heure est exactement le genre de calcul qui se trompe une fois
 * par an, en silence, et ce module décide quand un vrai numéro sonne.
 */
const PAS_MS = 15 * 60_000;
/** Sept jours de recherche : au-delà, il n'y a plus de cadence à sauver. */
const RECHERCHE_MAX_MS = 7 * 24 * 3_600_000;

/**
 * ⚠ ESPACEMENT MINIMUM ENTRE DEUX RAPPELS — et il a été ajouté APRÈS COUP,
 * parce que la première version du calage créait un défaut PIRE que celui
 * qu'elle corrigeait.
 *
 * En glissant chaque rappel « à la prochaine fenêtre ouverte », un premier
 * appel le VENDREDI 17h renvoyait les cinq rappels au lundi matin — 9h00,
 * 9h15, 9h30, 9h45, 10h00. Cinq appels à la même personne en une heure. Zéro
 * tentative « hors fenêtre » au compteur, et un harcèlement caractérisé.
 *
 * Le décalage de 15 minutes brisait les COLLISIONS ; il n'espaçait rien.
 * L'espacement est une règle distincte, et c'est elle qui porte « de la bonne
 * manière ». Trois heures = le plus petit offset d'origine : on ne resserre
 * jamais en dessous de ce que la cadence prévoyait elle-même.
 */
const ESPACEMENT_MIN_MS = 3 * 3_600_000;

export function prochaineFenetreOuverte(depuis: Date): Date {
  let t = depuis.getTime();
  const fin = t + RECHERCHE_MAX_MS;
  while (t <= fin) {
    const d = new Date(t);
    if (fenetreOuverte(d).open) return d;
    t += PAS_MS;
  }
  // Inatteignable en pratique (il y a forcément une fenêtre dans 7 jours).
  // On rend la date d'origine plutôt que `null` : l'appelant a un plan, et
  // `callAllowedNow` refusera de composer si l'heure ne va pas.
  return depuis;
}

/**
 * Les rappels, calés sur des heures qui servent.
 *
 * Rendu séparément de `plannedRecalls` pour que `cadenceFor` et la
 * prévisualisation lisent EXACTEMENT la même liste. Deux calculs auraient
 * divergé — l'écran annonçant une heure, l'agent en composant une autre.
 */
export function rappelsCales(premierAppelIso: string): Date[] {
  const t0 = new Date(premierAppelIso).getTime();
  const out: Date[] = [];
  for (const h of RAPPELS_OFFSETS_H) {
    // L'intention (l'offset) OU l'espacement minimum depuis le rappel
    // précédent — le plus tard des deux gagne. Puis on cale sur une fenêtre.
    const precedent = out[out.length - 1];
    const voulu = Math.max(
      t0 + h * H,
      precedent ? precedent.getTime() + ESPACEMENT_MIN_MS : 0
    );
    out.push(prochaineFenetreOuverte(new Date(voulu)));
  }
  return out;
}

/** Le planning complet des rappels à partir d'un premier appel (prévisualisation). */
export function plannedRecalls(firstCallAt: string): string[] {
  // ⚠ Passe par `rappelsCales` : la prévisualisation doit montrer les heures
  // QUI SERONT COMPOSÉES. Recalculer les offsets bruts ici afficherait un
  // planning que l'agent ne suivrait pas — et c'est exactement l'écart qui
  // rendait le déjeuner et le week-end invisibles.
  return rappelsCales(firstCallAt).map((d) => d.toISOString());
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN HUMAIN A-T-IL DÉJÀ EU UN ÉCHANGE AVEC LUI ?
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT, PAS EN LE TESTANT.
 *
 * Sur `/controle`, le bloc « Alpha exécute » proposait
 * « Passer le rappel 1/3 » sur LES HUIT fiches — dont
 * Plomberie Fabre, affichée deux blocs plus haut comme « PRÊT À SIGNER —
 * Envoyer le DEVIS », et Paddy's Corner, qui est perdue et en nurture.
 *
 * ── POURQUOI ──
 *
 * La règle est écrite en haut de ce module : « dès qu'il répond,
 * Alpha Voice ARRÊTE et passe la main au closer ». `cadenceFor` l'applique
 * correctement — mais sur le seul journal d'APPELS. Or `attemptsFromEvents`
 * ne retient que `kind === "appel"` : une fiche qui a avancé par visite,
 * rendez-vous, démo et remise d'offre n'a AUCUNE tentative enregistrée. Pour
 * la cadence, elle est donc froide, et le plan annonce un premier contact
 * téléphonique à quelqu'un qu'on a vu quatre fois.
 *
 * Ce n'est pas une erreur de `cadenceFor` : c'est la question posée à un seul
 * canal. Le passage de main ne se produit pas « au téléphone », il se produit
 * quand un humain est entré dans la conversation — par n'importe quelle
 * porte. Même structure que `aRefuseTouteRelance` : une seule fonction pour
 * une question qui se posait à plusieurs endroits et recevait des réponses
 * différentes.
 *
 * ── CE QUI COMPTE COMME ÉCHANGE, ET CE QUI NE COMPTE PAS ──
 *
 * Un échange à DEUX SENS : visite, rendez-vous, démo, remise d'offre, ou un
 * appel auquel il a répondu. Un email envoyé, un message LinkedIn, un
 * WhatsApp, une note interne ne comptent pas : ce sont des touches sortantes,
 * elles ne prouvent aucune réponse. C'est exactement la prudence de
 * `attemptsFromEvents` (« en cas de doute, sans-reponse ») appliquée ici :
 * se tromper dans ce sens fait dormir un dossier, se tromper dans l'autre
 * fait rappeler quelqu'un qui nous a déjà reçus.
 * ─────────────────────────────────────────────────────────────────────
 */
/**
 * « Il a décroché / répondu », lu dans le résumé écrit à la main.
 *
 * ⚠ Ce motif vivait dans `lib/master-rappel.ts`. Il descend ici parce que
 * « a-t-il répondu ? » est une question de CADENCE — c'est elle qui s'arrête
 * dessus. Deux définitions du même test finissent toujours par diverger, et
 * ici diverger veut dire : rappeler quelqu'un qui a déjà décroché.
 */
/**
 * ─────────────────────────────────────────────────────────────────────
 * A-T-IL DÉCROCHÉ ? — une seule réponse.
 *
 * ⚠ `interesse` est un SOUS-ENSEMBLE de « il a décroché » : on ne peut pas
 * dire oui sans avoir répondu. Tout ce qui compte les décrochés doit donc
 * accepter les deux — taux de décroché, calibration, statistiques.
 *
 * En ajoutant `interesse`, `lib/calibration.ts` a immédiatement perdu les
 * rendez-vous obtenus de son dénominateur : l'axe « RDV » se calculait sur
 * ceux qui avaient décroché, et les meilleurs venaient d'en sortir. Le taux
 * aurait monté tout seul, sans que rien ne change sur le terrain.
 *
 * C'est le motif habituel du dépôt : une question posée à deux endroits qui
 * finissent par répondre différemment. Elle se pose ici, une fois.
 * ─────────────────────────────────────────────────────────────────────
 */
export const aDecroche = (o: CallOutcome): boolean => o === "repondu" || o === "interesse";

/**
 * « Il a dit OUI », lu dans le résumé écrit à la main.
 *
 * ⚠ Testé AVANT `REPONSE_DANS_LE_RESUME`, qui matche déjà « rdv obtenu » : le
 * même texte se lirait sinon comme un simple décroché, et l'intérêt qualifié
 * disparaîtrait — donc plus aucun humain ne serait réveillé.
 *
 * ⚠⚠ « pas intéressé » ne doit PAS matcher. C'est le résultat le plus fréquent
 * d'un appel à froid, et le confondre avec un oui enverrait un closer sur
 * chaque refus — exactement le gaspillage que la nouvelle doctrine supprime.
 *
 * ⚠⚠⚠ PAS DE `\b` APRÈS UNE LETTRE ACCENTUÉE. En JavaScript, `\b` se définit
 * sur les caractères de mot ASCII : « é » n'en est pas un, donc `intéress[ée]\b`
 * ne matche JAMAIS « intéressé ». Ma première version portait ce `\b` et le
 * motif était mort — le test de bout en bout l'a attrapé, pas la relecture.
 * Dans un dépôt entièrement en français, c'est un piège qui reviendra : on
 * borne avec `(?![a-zà-ÿ])`, qui, lui, connaît les accents.
 */
export const INTERET_DANS_LE_RESUME =
  /\bRDV obtenu\b|\brendez-vous obtenu\b|(?<!pas )intéress[ée](?![a-zà-ÿ])|accord pour (?:un |l')(?:RDV|rendez-vous|audit)/i;

export const REPONSE_DANS_LE_RESUME =
  /r[ée]pond|a rappel[ée]|rappelle|d[ée]croch|[ée]chang|discut|vu (?:à|a) \d|visite|rdv obtenu|accord/i;

const ECHANGE_DEUX_SENS = new Set(["visite", "meeting", "demo", "offre"]);

export function humainDejaEnLigne(p: {
  events?: { kind: string; summary?: string }[];
}): boolean {
  return (p.events ?? []).some(
    (e) => ECHANGE_DEUX_SENS.has(e.kind) || (e.kind === "appel" && REPONSE_DANS_LE_RESUME.test(e.summary ?? ""))
  );
}
