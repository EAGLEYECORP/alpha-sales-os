/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ESSAI 30 JOURS — pleine capacité, et pourquoi la durée ne suffit PAS.
 *
 * Décidé le 13/09/2026. Le socle gratuit reste gratuit sans limite de durée
 * pour ce qui ne nous coûte rien ; l'essai, lui, ouvre EN PLUS les briques qui
 * dépensent chez nous — pour que quelqu'un puisse voir Alpha entier une fois,
 * dans sa vraie journée, avant de décider.
 *
 * ══ ⚠⚠ POURQUOI UNE LIMITE DE TEMPS SEULE SERAIT UNE FAUTE ══
 *
 * Les briques payantes ne sont pas payantes par arbitrage commercial : elles
 * DÉPENSENT. `/api/send` part de NOTRE SMTP, `/api/voice/call` brûle NOS
 * minutes LiveKit/Telnyx, `/api/ai` nos jetons. **Il n'existe aucun chemin
 * d'identifiants par locataire.** Un essai borné par la seule DURÉE, c'est
 * notre carte bancaire et notre nom de domaine confiés à un inconnu pendant
 * trente jours — et ça ne se voit que sur la facture, un mois plus tard.
 *
 * Un seul compte motivé peut consommer en deux jours ce qu'on comptait donner
 * en trente. La durée ne borne pas la dépense : elle borne le calendrier.
 *
 * D'où **DEUX limites indépendantes**, et la première atteinte ferme l'essai.
 *
 * ══ LE PLAFOND EST DÉRIVÉ, PAS INVENTÉ ══
 *
 * Ancrage : **ce que le palier d'entrée nous COÛTE pour un mois** — 500
 * minutes à 0,0563 €/min mesurées = 28,15 € (`lib/voice-costs.ts`). L'essai
 * donne donc autant de matière que le premier abonnement en consomme. C'est
 * défendable des deux côtés : assez pour une vraie démonstration, et
 * exactement ce qu'on facturerait ensuite.
 *
 * ⚠ Le nombre est DÉCLARÉ ici et un test le croise contre `voice-costs` —
 * lequel est SERVEUR (il porte nos marges) et ne doit pas descendre dans un
 * bundle. Même arbitrage que `offres-publiques` face à `bricks` : ce qui est
 * partageable est déclaré côté public, et un test refuse la divergence.
 *
 * ══ CE QUE L'ESSAI N'OUVRE JAMAIS ══
 *
 * `MAITRE_SEULEMENT` — `/payouts`, `/offre`, la console CEO. Ça parle de NOTRE
 * économie, pas de la sienne. « Pleine capacité » désigne le produit, pas nos
 * comptes.
 *
 * ══ ET À LA FIN : LE GRATUIT, JAMAIS LE NÉANT ══
 *
 * L'invariant du dépôt tient ici comme ailleurs — on ne descend jamais sous le
 * socle. Ses fiches lui appartiennent ; le mettre dehors à J+31 fabrique un
 * ancien prospect qui ne peut même pas exporter son CRM, et ça ne récupère
 * aucune vente.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { BrickId } from "./bricks-access";

/** La durée. Elle existe déjà en base (`entitlements.essai_jusqu_a`). */
export const DUREE_ESSAI_JOURS = 30;

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE L'ESSAI N'OUVRE PAS — la téléphonie, et elle seule.
 *
 * Décidé le 16/09/2026, en ouvrant l'alpha à trente jours.
 *
 * ══ POURQUOI CELLE-LÀ, ET AUCUNE AUTRE ══
 *
 * Le critère n'est pas « c'est cher » — sinon on grise au feeling. C'est le
 * croisement de DEUX propriétés qu'aucune autre brique ne réunit :
 *
 *  1. **Aucun chemin d'identifiants par locataire.** `Capacite` (lib/credentials)
 *     vaut `"ia" | "email"` : celui qui apporte sa clé paie son IA et son envoi
 *     lui-même, et l'essai ne nous coûte alors RIEN. La téléphonie n'a pas ce
 *     chemin — `telephonie` est nommée dans le chiffrage et n'est pas servie.
 *     Elle est donc la seule brique dont la dépense nous revient TOUJOURS.
 *  2. **Le coût est à la MINUTE et il n'a pas de plafond naturel.** Un jeton
 *     rendu coûte une fraction de centime et s'arrête avec la réponse ; une
 *     ligne ouverte facture tant que quelqu'un parle. `voice-costs` mesure
 *     0,0563 €/min : un seul compte motivé consomme en un après-midi ce que
 *     l'essai entier prévoit.
 *
 * ══ ⚠ ET IL Y A UN TROISIÈME MOTIF, QUI N'EST PAS UN COÛT ══
 *
 * `voice/agent.py` tourne EN LOCAL chez nous. Un appel composé sans agent
 * vivant sonne dans le vide — `lib/presence-agent.ts` referme ça côté cron,
 * mais donner la brique à trente inconnus revient à faire dépendre leur
 * première impression d'un processus lancé à la main sur une machine. Même à
 * coût nul, on ne l'ouvrirait pas.
 *
 * ══ ELLE SE GRISE, ELLE NE SE MASQUE PAS ══
 *
 * Doctrine du rail, inchangée : `maitreSeul` MASQUE (`/ceo` — notre économie),
 * `brique` GRISE (on ne peut pas vouloir ce qu'on ne voit pas). `/voice` reste
 * donc visible et fermé pendant l'essai, et le serveur refuse — voir la porte
 * fermée vaut mieux que ne pas savoir qu'elle existe.
 * ─────────────────────────────────────────────────────────────────────
 */
export const HORS_ESSAI: readonly BrickId[] = ["alpha-voice"];


/**
 * Ce qu'on accepte de DÉPENSER pour un essai, en euros de coût réel.
 *
 * 28,15 € = 500 minutes × 0,0563 €/min, le coût mesuré du palier Essentiel
 * pour un mois. Arrondi à 30 € : la marge couvre les jetons IA et les envois,
 * qui ne sont pas dans ce calcul et qu'on ne sait pas encore chiffrer à la
 * minute près.
 *
 * ⚠ C'est une DÉCISION, pas une mesure : aucune vente ne l'a validée. Ce qui
 * est mesuré, c'est le coût/minute. Le premier essai qui touche le plafond
 * avant J+30 nous apprendra plus que ce raisonnement.
 */
export const PLAFOND_ESSAI_COUT_EUR = 30;

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠⚠ LE PLAFOND PAR COMPTE NE BORNE PAS LA FACTURE — IL BORNE UN COMPTE.
 *
 * Trouvé le 16/09/2026 en cherchant comment ouvrir l'alpha « sans que ça nous
 * coûte ». C'est l'erreur de raisonnement qui rendait la phrase fausse, et
 * elle tient en une multiplication :
 *
 *     ce que ça nous coûte = (nombre d'essais) × PLAFOND_ESSAI_COUT_EUR
 *
 * Or le nombre d'essais est exactement ce qu'une ouverture cherche à faire
 * monter. **Le seul terme borné était celui qu'on ne veut pas borner.** Vingt
 * inscrits motivés = 600 €, sans qu'aucune garde ne se déclenche et sans
 * qu'aucune ligne de code ne soit fausse : les trente comptes sont chacun
 * parfaitement dans les clous.
 *
 * ══ CE QUE CE SECOND PLAFOND ACHÈTE, ET CE QU'IL COÛTE ══
 *
 * Il achète une phrase vraie : la dépense totale de l'ouverture est connue
 * D'AVANCE, quel que soit le succès. C'est la seule forme sous laquelle « ça
 * ne nous coûte pas » se dit sans mentir — ça nous coûte AU PLUS ce nombre.
 *
 * Il coûte ceci, et il faut le savoir avant de l'écrire : **le compte qui
 * arrive après l'épuisement reçoit un essai dégradé**, sans avoir rien fait de
 * mal. C'est injuste et c'est assumé — l'inverse (facture ouverte) ne se
 * découvre qu'un mois plus tard et ne se répare pas.
 * ⚠ Il retombe au SOCLE GRATUIT, jamais au néant : l'invariant du dépôt vaut
 * ici comme ailleurs, et un arrivant accueilli par un mur ne revient pas.
 *
 * ══ ⚠ ET LA SORTIE N'EST PAS D'AUGMENTER LE NOMBRE ══
 *
 * C'est le BYOK. Un locataire qui apporte sa clé ne consomme NI l'un NI
 * l'autre plafond (`origine: "locataire"` ⇒ zéro débit) : son essai est
 * illimité et nous coûte zéro, pour de vrai. Le plafond ne borne donc que les
 * comptes qui dépensent sur NOTRE clé — et c'est exactement la population
 * qu'on veut convertir au BYOK ou à l'abonnement.
 *
 * ⚠ **300 € est une DÉCISION, pas une mesure** — comme les 30 € par compte.
 * Ce qui est mesuré, c'est le coût/minute et le prix des jetons. Le premier
 * mois d'ouverture dira ce qu'un essai consomme VRAIMENT, et ce chiffre-là
 * vaudra plus que ce raisonnement.
 *
 * ⚠ **Ce nombre ne descend PAS dans la phrase servie au locataire**, et un
 * test l'exige. Le plafond personnel, si : c'est SA consommation, il a le
 * droit de la voir. L'enveloppe est le budget que NOTRE société consacre à
 * son acquisition — même famille que `/offre` et `voice-costs`, réservés au
 * maître. Le lui annoncer l'inviterait à calculer combien d'inscrits nous
 * avons, ce qui n'est ni son affaire ni flatteur à zéro vente.
 * ─────────────────────────────────────────────────────────────────────
 */
export const ENVELOPPE_OUVERTURE_EUR = 300;

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠⚠ L'ENVELOPPE FERME POUR LE LOCATAIRE, ET PERSONNE NE NOUS PRÉVIENT.
 *
 * Écrit le 17/09/2026, après avoir branché l'écran côté locataire.
 *
 * Le compte qui arrive après l'épuisement voit désormais « ce n'est pas toi »
 * sur `/compte`. **Nous, non.** L'enveloppe se referme en silence, et le seul
 * moyen de l'apprendre est une requête écrite à la main. C'est exactement
 * l'angle mort que le compteur avait avant d'exister : un mécanisme qui décide
 * et que personne ne lit.
 *
 * ══ POURQUOI ALERTER AVANT, ET PAS À 100 % ══
 *
 * Une alerte à l'épuisement n'a aucune valeur : quand elle se déclenche, les
 * essais suivants sont **déjà** dégradés, et les comptes concernés sont déjà
 * partis avec une mauvaise première impression. Le seul moment où l'alerte
 * sert à quelque chose est celui où l'on peut encore décider — relever
 * l'enveloppe, pousser le BYOK, ou assumer et fermer.
 *
 * ⚠ **80 % est une DÉCISION**, pas une mesure. Ce qui est mesuré n'existe pas
 * encore : personne n'a jamais vu un essai consommer quoi que ce soit. Le
 * premier mois d'ouverture dira à quelle vitesse l'enveloppe descend, et ce
 * rythme-là vaudra plus que ce seuil.
 *
 * ══ ⚠ `null` NE DÉCLENCHE RIEN, ET SE DIT ══
 *
 * Même discipline que les sondes d'Alpha CEO : `false` alerte, `null` est un
 * angle mort. Une base injoignable ou un service role absent rend `null` — et
 * une console qui crierait « enveloppe pleine » parce qu'elle n'a pas su lire
 * serait exactement le moniteur qui affiche du calme, à l'envers.
 * ─────────────────────────────────────────────────────────────────────
 */
export const ENVELOPPE_ALERTE_PART = 0.8;

/** Ce que l'ouverture a déjà coûté, et ce qu'il faut en penser. */
export interface EtatEnveloppe {
  /** Euros consommés par TOUS les essais en cours. `null` = pas su lire. */
  consommeEur: number | null;
  /** Ce qu'il reste. `null` quand la lecture a échoué. */
  resteEur: number | null;
  /** Part consommée, 0 à 1. `null` quand la lecture a échoué. */
  part: number | null;
  /**
   * `null` = angle mort, AUCUNE alerte. C'est la distinction qui fait toute
   * la valeur du diagnostic : ne pas savoir n'est pas une panne.
   */
  niveau: "ouverte" | "bientot-pleine" | "pleine" | null;
  phrase: string;
}

/**
 * L'état de l'enveloppe d'ouverture. Pur — il ne lit ni base ni requête, ce
 * qui permet de le vérifier sans monter quoi que ce soit.
 */
export function etatEnveloppe(consommeEur: number | null): EtatEnveloppe {
  if (consommeEur === null || !Number.isFinite(consommeEur)) {
    return {
      consommeEur: null,
      resteEur: null,
      part: null,
      niveau: null,
      phrase:
        "Enveloppe d'ouverture : non mesurée. La somme des essais n'a pas pu être lue — " +
        "ce n'est pas « zéro consommé », c'est « on ne sait pas ».",
    };
  }
  const consomme = Math.max(0, arrondi(consommeEur));
  const reste = arrondi(Math.max(0, ENVELOPPE_OUVERTURE_EUR - consomme));
  const part = ENVELOPPE_OUVERTURE_EUR > 0 ? Math.min(1, consomme / ENVELOPPE_OUVERTURE_EUR) : 1;

  if (consomme >= ENVELOPPE_OUVERTURE_EUR) {
    return {
      consommeEur: consomme,
      resteEur: 0,
      part: 1,
      niveau: "pleine",
      phrase:
        `Enveloppe d'ouverture ÉPUISÉE (${consomme} € sur ${ENVELOPPE_OUVERTURE_EUR} €). ` +
        "Les nouveaux essais retombent au socle gratuit — ils fonctionnent, mais sans ce qui dépense chez nous.",
    };
  }
  if (part >= ENVELOPPE_ALERTE_PART) {
    return {
      consommeEur: consomme,
      resteEur: reste,
      part,
      niveau: "bientot-pleine",
      phrase:
        `Enveloppe d'ouverture à ${Math.round(part * 100)} % (${reste} € restants). ` +
        "À décider maintenant, pas à l'épuisement : relever l'enveloppe, pousser le BYOK, ou assumer la fermeture.",
    };
  }
  return {
    consommeEur: consomme,
    resteEur: reste,
    part,
    niveau: "ouverte",
    phrase: `Enveloppe d'ouverture : ${consomme} € consommés, ${reste} € restants.`,
  };
}

/** Pourquoi un essai s'est arrêté. `null` tant qu'il tourne. */
export type FinEssai = "duree-atteinte" | "plafond-atteint" | "cout-inconnu" | "enveloppe-epuisee";

export interface EtatEssai {
  actif: boolean;
  /** Jours restants, `null` si aucune date de fin n'est posée. */
  joursRestants: number | null;
  /** Euros de coût restants avant plafond. */
  coutRestantEur: number;
  fin: FinEssai | null;
  /** Ce qu'on affiche. Jamais un booléen nu : il faut savoir POURQUOI. */
  phrase: string;
}

export interface EntreeEssai {
  /** Fin d'essai en ISO — `entitlements.essai_jusqu_a`. */
  jusquA: string | null;
  /**
   * Coût réel déjà consommé, en euros.
   *
   * ⚠ `null` = on n'a pas su le lire (base injoignable, colonne absente,
   * service role manquant). **L'inconnu FERME l'essai.** C'est le même
   * arbitrage que la présence de l'agent vocal, et l'inverse du réflexe des
   * écrans de mesure : ne pas ouvrir coûte une démonstration, ouvrir en
   * aveugle coûte une facture qu'on découvre trente jours plus tard.
   */
  coutConsommeEur: number | null;
  /**
   * Ce que TOUS les essais en cours nous ont déjà coûté, en euros.
   *
   * ⚠ **Ce champ est OBLIGATOIRE, et c'est délibéré.** L'optionnel aurait été
   * plus commode et aurait reproduit exactement le défaut qu'on répare : un
   * appelant distrait l'omet, l'enveloppe ne mord plus, et rien ne le dit. En
   * l'exigeant, `tsc` refuse de compiler tout appelant qui ne l'a pas lu —
   * c'est le compilateur qui tient la règle, pas la mémoire du relecteur.
   *
   * ⚠ `null` = on n'a pas su lire la somme ⇒ **l'essai ferme**, même dimension
   * que `coutConsommeEur`. Ne pas ouvrir coûte une démonstration ; ouvrir en
   * aveugle coûte une facture qu'on découvre trente jours plus tard.
   */
  coutGlobalEur: number | null;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * L'état d'un essai — les deux limites, et celle qui a mordu.
 *
 * ⚠ Les deux se calculent TOUJOURS, même quand l'une a déjà fermé l'essai.
 * Savoir qu'un compte a été coupé au plafond le jour 3 et non par la durée
 * change la conversation de vente : l'un est un prospect chaud qui a consommé,
 * l'autre est un compte qui n'a rien fait.
 */
export function etatEssai(e: EntreeEssai, now: Date = new Date()): EtatEssai {
  const coutRestantEur =
    e.coutConsommeEur === null ? 0 : Math.max(0, arrondi(PLAFOND_ESSAI_COUT_EUR - e.coutConsommeEur));

  const joursRestants =
    e.jusquA === null ? null : Math.max(0, Math.ceil((new Date(e.jusquA).getTime() - now.getTime()) / JOUR_MS));

  // ── L'inconnu ferme, et il se dit. Les DEUX inconnus. ──
  if (e.coutConsommeEur === null || e.coutGlobalEur === null) {
    return {
      actif: false,
      joursRestants,
      coutRestantEur: 0,
      fin: "cout-inconnu",
      phrase:
        "Essai en pause : la consommation n'a pas pu être lue. On ne laisse pas tourner ce qui dépense " +
        "quand on ne sait plus combien. Le socle gratuit reste ouvert.",
    };
  }

  if (e.coutConsommeEur >= PLAFOND_ESSAI_COUT_EUR) {
    return {
      actif: false,
      joursRestants,
      coutRestantEur: 0,
      fin: "plafond-atteint",
      phrase:
        `Essai terminé : le plafond de ${PLAFOND_ESSAI_COUT_EUR} € de consommation est atteint` +
        `${joursRestants !== null && joursRestants > 0 ? ` (il restait ${joursRestants} jour(s))` : ""}. ` +
        "Tout ce qui tourne chez toi reste ouvert — seules les briques qui passent par notre infrastructure s'arrêtent.",
    };
  }

  /**
   * ⚠ L'ORDRE : le plafond PERSONNEL d'abord, l'enveloppe ensuite.
   *
   * Les deux ferment, mais ils ne disent pas la même chose à celui qui les
   * lit. « Tu as consommé ton essai » est actionnable — il sait ce qu'il a
   * fait et il peut acheter. « L'ouverture est pleine » ne l'est pas, et
   * l'annoncer à quelqu'un qui a d'abord épuisé SON quota serait un demi-
   * mensonge poli. Celui qui a dépensé l'entend en premier.
   */
  if (e.coutGlobalEur >= ENVELOPPE_OUVERTURE_EUR) {
    return {
      actif: false,
      joursRestants,
      coutRestantEur,
      fin: "enveloppe-epuisee",
      phrase:
        "Essai en pause : l'ouverture a atteint l'enveloppe qu'on lui avait fixée — ce n'est pas toi, " +
        "c'est nous. Tout ce qui tourne chez toi reste ouvert, et apporter ta propre clé dans les " +
        "Réglages rouvre tout immédiatement, sans limite.",
    };
  }

  if (joursRestants !== null && joursRestants <= 0) {
    return {
      actif: false,
      joursRestants: 0,
      coutRestantEur,
      fin: "duree-atteinte",
      phrase:
        `Essai terminé : les ${DUREE_ESSAI_JOURS} jours sont écoulés. ` +
        "Ton CRM, tes fiches et tout ce qui tourne chez toi restent ouverts, sans limite de durée.",
    };
  }

  return {
    actif: true,
    joursRestants,
    coutRestantEur,
    fin: null,
    phrase:
      `Essai en cours${joursRestants !== null ? ` — ${joursRestants} jour(s)` : ""}` +
      `, ${coutRestantEur} € de consommation restants sur ${PLAFOND_ESSAI_COUT_EUR} €.`,
  };
}

/** Deux décimales — un coût affiché à quinze chiffres n'inspire rien. */
function arrondi(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * La date de fin d'un essai qui démarre maintenant.
 *
 * Rendue ici pour que personne ne recalcule « aujourd'hui + 30 » ailleurs :
 * c'est le genre de ligne qu'on récrit à un jour près sans s'en apercevoir.
 */
export function finDEssai(debut: Date = new Date()): string {
  return new Date(debut.getTime() + DUREE_ESSAI_JOURS * JOUR_MS).toISOString();
}
