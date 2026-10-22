import type { Prospect } from "./types";
import { PRIX_HONORE_JUSQU_AU, prixPerime } from "./grille-perimee";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA RAISON NEUVE — énoncée CINQ FOIS, produite ZÉRO FOIS.
 *
 * ══ CE QUI A ÉTÉ MESURÉ LE 17/09/2026 ══
 *
 * « Revenir avec une raison NEUVE, jamais “je me permets de relancer” » est
 * la règle la plus répétée du dépôt après le cadrage. Elle est écrite dans
 * `master-rappel`, `priorites`, `reactivite`, `vital-signs` et
 * `business-rules` — **cinq modules**.
 *
 * Aucun des cinq n'en FABRIQUE une. `master-rappel` va jusqu'à en lister les
 * formes en prose (« un résultat obtenu ailleurs, une preuve, une actualité de
 * son métier ») et s'arrête là. L'écran du matin affiche donc « Revenir avec
 * une raison NEUVE — <société> » à quelqu'un qui n'en a aucune, et qui va
 * écrire « je me permets de relancer » parce que c'est tout ce qui reste.
 *
 * C'est le défaut de signature du dépôt sur la phrase la plus chère du cycle :
 * celle qui décide si un dossier endormi se rouvre ou se brûle.
 *
 * ══ ⚠⚠ CE MODULE N'INVENTE RIEN, ET C'EST TOUTE SA VALEUR ══
 *
 * Une raison neuve FABRIQUÉE est pire que pas de raison : le prospect entend
 * un prétexte, et un prétexte ne se rejoue pas une deuxième fois. La règle est
 * celle de la boucle de mesure, appliquée à une phrase : **zéro fait → zéro
 * raison**. On rend `null` et on DIT qu'il n'y en a pas.
 *
 * Il n'existe aujourd'hui que DEUX faits datés capables de porter un retour,
 * et ils viennent tous les deux de modules qui les mesurent déjà :
 *
 * · **le prix honoré** — la grille a changé le 12/09, le prix annoncé tient
 *   jusqu'à une date. Daté, vrai, vérifiable, et il ne parle pas du prospect ;
 * · **une ouverture ou un clic** — un fait horodaté chez lui, que
 *   `lib/reactivite.ts` sait déjà lire.
 *
 * ⚠ Un troisième (« une actualité de son métier ») serait une INVENTION tant
 * qu'aucune source ne l'alimente. Il n'est pas écrit ici.
 *
 * ⚠⚠ AJOUTÉ LE 22/10/2026 : **la date qu'IL a donnée** (« rappelez-moi en
 * janvier »), consignée comme telle à l'écran d'appels (`etapeASaDate`,
 * `NextStep.demandePar`). Le prix honoré a expiré le 17/10 et n'a jamais valu
 * que pour NOTRE grille : depuis, aucune fiche d'aucun inscrit ne pouvait plus
 * produire de raison. Sa date vaut pour n'importe quel métier, et elle passe
 * devant les deux autres.
 *
 * ══ POURQUOI LE PRIX EST LA MEILLEURE DES DEUX ══
 *
 * Il ne demande rien et n'accuse personne. « Je me permets de relancer » met
 * la dette sur le prospect ; « notre grille a changé, la vôtre tient jusqu'au
 * X » met l'information de notre côté et pose une échéance qui n'est pas
 * inventée — c'est une décision datée, pas un compteur de places.
 * ─────────────────────────────────────────────────────────────────────
 */

export type SourceRaison =
  /** Il a DONNÉ une date (« rappelez-moi en janvier ») et elle arrive. */
  | "sa-date"
  /** La grille a bougé, le prix annoncé est honoré jusqu'à une date. */
  | "prix-honore"
  /** Il a ouvert ou cliqué : le rappel se raccroche à ce qu'il a lu. */
  | "il-a-ouvert";

export interface RaisonNeuve {
  source: SourceRaison;
  /** Le FAIT, daté. C'est lui qui rend la raison défendable. */
  fait: string;
  /** Ce qui se dit, tel quel. Court : une relance longue s'excuse. */
  phrase: string;
  /**
   * Le module qui PORTE le fait. Une raison sans provenance se recopie et
   * se périme — même discipline que `lib/references.ts`.
   */
  provenance: string;
}

/**
 * Ce qu'on affiche quand il n'y en a AUCUNE — et ce n'est pas un détail.
 *
 * ⚠ « Pas de raison neuve » et « je n'ai pas cherché » ne se lisent pas
 * pareil. Sans cette phrase, l'écran du matin dirait « Revenir avec une raison
 * NEUVE » et se tairait, ce qui revient à demander d'en inventer une.
 */
export const AUCUNE_RAISON =
  "Aucune raison neuve disponible sur cette fiche. Ne relance pas pour relancer : " +
  "attends un fait daté (il te donne une date, il ouvre, il clique, un prix bouge) ou passe à une autre fiche.";

export interface ContexteRaison {
  /** Dernière ouverture ou clic connu, en ISO. `null` = aucun. */
  derniereOuverture?: string | null;
}

/** Au-delà, « vous avez ouvert mon message » sonne comme de la surveillance. */
export const OUVERTURE_FRAICHE_JOURS = 7;

/**
 * La fenêtre autour de SA date : la veille (on prépare) jusqu'à deux semaines
 * après (il a pu être pris). Au-delà, « vous m'aviez dit de revenir vers le … »
 * se lit comme un oubli de notre part, pas comme une parole tenue.
 * Une DÉCISION, aucune vente ne l'a mesurée.
 */
export const FENETRE_SA_DATE_JOURS = { avant: 1, apres: 14 } as const;

/**
 * La raison neuve disponible sur cette fiche, ou `null`.
 *
 * `maintenant` est injecté, jamais lu de l'horloge : une raison qui dépend du
 * jour rendrait un test vert tout seul — la leçon de `creneauPasse`.
 */
export function raisonNeuve(
  p: Prospect,
  maintenant: number,
  ctx: ContexteRaison = {},
): RaisonNeuve | null {
  /**
   * ⚠ L'ORDRE N'EST PAS ARBITRAIRE. Le prix passe devant l'ouverture parce
   * qu'il APPORTE quelque chose au prospect, alors que « vous avez ouvert mon
   * message » ne lui apprend rien et le met en position de devoir se
   * justifier. On ouvre sur ce qu'on donne, pas sur ce qu'on a observé.
   */
  /**
   * ⚠⚠ SA DATE PASSE DEVANT TOUT (22/10/2026). C'est la seule source qui vaille
   * pour n'importe quel métier — le prix honoré n'existe que pour notre grille,
   * et il a expiré le 17/10, laissant le cycle de relance à l'arrêt. Elle ne
   * demande rien et n'accuse personne : c'est LUI qui a fixé le moment. Elle
   * n'existe que si l'écran l'a consignée comme telle (`demandePar`), jamais
   * déduite de notre délai par défaut.
   */
  const sa = p.nextStep?.demandePar === "prospect" ? Date.parse(p.nextStep.date) : NaN;
  if (!Number.isNaN(sa)) {
    const jours = (maintenant - sa) / 86_400_000;
    if (jours >= -FENETRE_SA_DATE_JOURS.avant && jours <= FENETRE_SA_DATE_JOURS.apres) {
      const quand = new Date(sa).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
      return {
        source: "sa-date",
        fait: `Date donnée par le prospect : ${new Date(sa).toLocaleDateString("fr-FR")}.`,
        phrase:
          `Vous m'aviez dit de revenir vers vous vers le ${quand} : c'est ce que je fais. ` +
          `Une seule question : est-ce que c'est toujours un sujet chez vous, oui ou non ? Un non me va très bien.`,
        provenance: "lib/call-outcome.ts",
      };
    }
  }

  const derniere = p.events?.length ? p.events[p.events.length - 1].date : null;
  const perime = prixPerime(p, derniere);
  if (perime && perime.certitude === "datee" && Date.parse(PRIX_HONORE_JUSQU_AU) >= maintenant) {
    const limite = new Date(PRIX_HONORE_JUSQU_AU).toLocaleDateString("fr-FR");
    const jour = new Date(perime.grille.remplaceeLe).toLocaleDateString("fr-FR");
    return {
      source: "prix-honore",
      fait: `Grille remplacée le ${jour} ; le prix annoncé à ${p.company} est honoré jusqu'au ${limite}.`,
      /**
       * ⚠ AUCUN MONTANT DANS LA PHRASE. Le prix se redit de vive voix, pas
       * dans un message qui se transfère : un chiffre écrit se retrouve cité
       * hors de son périmètre, et c'est exactement ce que le pré-devis porte
       * ses réserves pour éviter.
       */
      phrase:
        `Nos tarifs ont changé depuis notre dernier échange. Celui que je vous ai annoncé reste valable ` +
        `jusqu'au ${limite} — je préfère vous le dire plutôt que vous laisser le découvrir. ` +
        `Si le sujet est toujours d'actualité, on en reparle avant ; sinon, aucun souci.`,
      provenance: "lib/grille-perimee.ts",
    };
  }

  const ouverture = ctx.derniereOuverture ? Date.parse(ctx.derniereOuverture) : NaN;
  if (!Number.isNaN(ouverture)) {
    const jours = (maintenant - ouverture) / 86_400_000;
    if (jours >= 0 && jours <= OUVERTURE_FRAICHE_JOURS) {
      return {
        source: "il-a-ouvert",
        fait: `Ouverture ou clic il y a ${Math.round(jours)} j.`,
        /**
         * ⚠ ON NE DIT PAS « j'ai vu que vous aviez ouvert ». C'est vrai, et
         * ça sonne fliqué — le même interdit que citer son permis à froid.
         * Le fait sert à CHOISIR le moment, pas à ouvrir la conversation.
         */
        phrase:
          `Je reviens vers vous pendant que le sujet est frais. Une seule question : ` +
          `est-ce que c'est toujours un sujet chez vous, oui ou non ? Un non me va très bien.`,
        provenance: "lib/reactivite.ts",
      };
    }
  }

  return null;
}
