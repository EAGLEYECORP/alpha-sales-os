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

/** La durée. Elle existe déjà en base (`entitlements.essai_jusqu_a`). */
export const DUREE_ESSAI_JOURS = 30;

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

/** Pourquoi un essai s'est arrêté. `null` tant qu'il tourne. */
export type FinEssai = "duree-atteinte" | "plafond-atteint" | "cout-inconnu";

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

  // ── L'inconnu ferme, et il se dit. ──
  if (e.coutConsommeEur === null) {
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
