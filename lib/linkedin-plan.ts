import { LINKEDIN_DAILY_SAFE } from "./linkedin";

/**
 * ─────────────────────────────────────────────────────────────────────
 * PLAN DE CAMPAGNE LINKEDIN — le plafond réel, et ce qu'il impose.
 *
 * ── LE TROU QUE CE MODULE BOUCHE ──
 *
 * `linkedin.ts` posait un quota JOURNALIER (`LINKEDIN_DAILY_SAFE = 25`) et
 * rien d'autre. Or LinkedIn ne compte pas à la journée : la limite d'envoi
 * d'invitations est HEBDOMADAIRE. 25 par jour tenus cinq jours font 125
 * invitations dans la semaine — au-dessus du plafond. Le compte se serait fait
 * arrêter le jeudi, avec un message « vous avez atteint la limite
 * hebdomadaire », et l'app aurait continué d'afficher « quota OK ».
 *
 * Un garde-fou qui autorise ce que la plateforme refuse n'est pas un
 * garde-fou : il donne juste la sensation d'en avoir un.
 *
 * ── D'OÙ VIENNENT CES CHIFFRES ──
 *
 * ⚠ Ils viennent de ce que LinkedIn publie et de ce que les praticiens
 * observent — PAS d'une mesure faite ici. Aucune campagne n'a encore tourné
 * sur ce compte. Ce sont donc des plafonds PRUDENTS, à corriger dès qu'on
 * aura une semaine réelle derrière soi. La limite exacte est d'ailleurs
 * variable : elle dépend de l'ancienneté du compte, de son activité, et
 * surtout du taux d'acceptation.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Plafond d'invitations par semaine glissante.
 *
 * LinkedIn applique cette limite depuis 2021. Certains comptes très actifs
 * montent plus haut, les comptes neufs sont plafonnés plus bas. 100 est la
 * valeur sur laquelle on ne se fait pas surprendre.
 */
export const LINKEDIN_WEEKLY_LIMIT = 100;

/**
 * La montée en charge d'un compte qui n'envoyait rien.
 *
 * Passer de 0 à 25 invitations par jour du jour au lendemain est le
 * déclencheur classique de la restriction : c'est le changement de rythme qui
 * se voit, pas le volume absolu. On monte par paliers hebdomadaires.
 *
 * Index = numéro de semaine de campagne (0 = première semaine).
 */
export const RAMPE_HEBDO = [40, 60, 80, LINKEDIN_WEEKLY_LIMIT] as const;

/** Plafond de la semaine `n` (0 = première), rampe comprise. */
export function plafondSemaine(n: number): number {
  if (n < 0) return RAMPE_HEBDO[0];
  return RAMPE_HEBDO[Math.min(n, RAMPE_HEBDO.length - 1)];
}

/**
 * Une invitation qui reste en attente n'est pas neutre.
 *
 * Le taux d'acceptation est le signal que LinkedIn regarde pour décider si un
 * compte se comporte normalement. Des centaines d'invitations en attente le
 * font baisser mécaniquement. On les retire au bout de trois semaines.
 *
 * ⚠ Une invitation retirée ne peut pas être renvoyée avant ~3 semaines : ce
 * n'est pas gratuit, c'est un arbitrage. On retire ce qui est vieux, pas ce
 * qui est récent.
 */
export const RETRAIT_APRES_JOURS = 21;

/** Au-delà, la file d'attente pèse sur le taux d'acceptation. */
export const EN_ATTENTE_MAX = 200;

const JOUR = 86_400_000;

export interface EtatSemaine {
  /** Invitations déjà envoyées dans les 7 derniers jours. */
  envoyeesSemaine: number;
  /** Invitations déjà envoyées aujourd'hui (tous canaux LinkedIn confondus). */
  envoyeesAujourdhui: number;
  /** Numéro de semaine de campagne (0 = la première). Pilote la rampe. */
  semaineCampagne?: number;
  /** Invitations en attente de réponse, toutes dates confondues. */
  enAttente?: number;
}

export interface QuotaJour {
  /** Ce qu'on peut encore envoyer maintenant. */
  reste: number;
  /** Le plafond effectif du jour, une fois toutes les contraintes appliquées. */
  plafond: number;
  /** Laquelle des contraintes mord — celle qu'il faut expliquer à l'écran. */
  contrainte: "jour" | "semaine" | "rampe" | "en-attente";
  /** La phrase à afficher. Dire QUOI, et dire POURQUOI. */
  message: string;
}

/**
 * Le quota réellement disponible, en croisant les trois plafonds.
 *
 * On prend le plus SERRÉ des trois, et on nomme celui qui mord : « quota
 * atteint » sans raison pousse à passer outre. « Il te reste 4 invitations
 * cette semaine » se comprend et se respecte.
 */
export function quotaDuJour(etat: EtatSemaine): QuotaJour {
  const semaine = etat.semaineCampagne ?? 0;
  const plafondHebdo = plafondSemaine(semaine);
  const resteSemaine = Math.max(0, plafondHebdo - Math.max(0, etat.envoyeesSemaine));

  /**
   * ⚠ Le plafond du JOUR se dérive du plafond de la SEMAINE, il n'est pas fixe.
   *
   * Sans ça, `planifierCampagne` annonçait 8 invitations par jour en première
   * semaine pendant que cet écran en autorisait 25 : le plan disait une chose,
   * le bouton en permettait une autre, et c'est le bouton qui gagne. Les deux
   * fonctions partagent maintenant la même division — cinq jours ouvrés.
   */
  const plafondJour = Math.min(LINKEDIN_DAILY_SAFE, Math.ceil(plafondHebdo / 5));
  const resteJour = Math.max(0, plafondJour - Math.max(0, etat.envoyeesAujourdhui));

  // La file d'attente saturée passe avant tout le reste : continuer à inviter
  // pendant que 200 invitations dorment fait baisser le taux d'acceptation,
  // c'est-à-dire le seul chiffre qui protège le compte.
  if ((etat.enAttente ?? 0) >= EN_ATTENTE_MAX) {
    return {
      reste: 0,
      plafond: 0,
      contrainte: "en-attente",
      message: `${etat.enAttente} invitations en attente. Retire les plus vieilles avant d'en envoyer d'autres — c'est le taux d'acceptation qui protège le compte, et il baisse à chaque invitation ignorée.`,
    };
  }

  if (resteSemaine <= resteJour) {
    const contrainte = semaine < RAMPE_HEBDO.length - 1 ? "rampe" : "semaine";
    return {
      reste: resteSemaine,
      plafond: plafondHebdo,
      contrainte,
      message:
        resteSemaine === 0
          ? `Plafond hebdomadaire atteint (${plafondHebdo}). LinkedIn compte à la SEMAINE, pas à la journée : au-delà, il bloque les invitations.`
          : contrainte === "rampe"
            ? `${resteSemaine} invitation(s) restantes cette semaine (semaine ${semaine + 1} de montée en charge, plafond ${plafondHebdo}). Le changement de rythme se voit plus que le volume.`
            : `${resteSemaine} invitation(s) restantes cette semaine (plafond ${plafondHebdo}).`,
    };
  }

  /**
   * Nommer la rampe UNIQUEMENT tant qu'elle mord.
   *
   * Le critère n'est pas « le plafond du jour est inférieur à
   * `LINKEDIN_DAILY_SAFE` » : en régime de croisière, 100 par semaine divisés
   * par cinq jours font 20, ce qui est aussi sous les 25 — et le message
   * aurait parlé de montée en charge à un compte qui n'y est plus depuis des
   * mois. Ce qui distingue les deux, c'est que la semaine soit encore
   * plafonnée en dessous de la limite de la plateforme.
   */
  const parRampe = plafondHebdo < LINKEDIN_WEEKLY_LIMIT;
  return {
    reste: resteJour,
    plafond: plafondJour,
    contrainte: parRampe ? "rampe" : "jour",
    message:
      resteJour === 0
        ? parRampe
          ? `Palier du jour atteint (${plafondJour}) — semaine ${semaine + 1} de montée en charge, plafond hebdomadaire ${plafondHebdo}. Le changement de rythme se voit plus que le volume.`
          : `Quota du jour atteint (${plafondJour}). Le profil est un actif, on ne le grille pas pour trois touches de plus.`
        : parRampe
          ? `${resteJour} invitation(s) aujourd'hui (semaine ${semaine + 1} de montée en charge, plafond hebdomadaire ${plafondHebdo}).`
          : `${resteJour} invitation(s) possibles aujourd'hui.`,
  };
}

export interface JourCampagne {
  /** Jour ISO (AAAA-MM-JJ). */
  date: string;
  /** Numéro de semaine de campagne. */
  semaine: number;
  /** Invitations prévues ce jour-là. */
  invitations: number;
}

export interface PlanCampagne {
  /** Cibles réellement planifiables. */
  cibles: number;
  jours: JourCampagne[];
  /** Nombre de jours ouvrés nécessaires. */
  joursOuvres: number;
  /** Nombre de semaines calendaires. */
  semaines: number;
  /** Dernier jour d'envoi (ISO), ou null si rien à envoyer. */
  finLe: string | null;
  /** Ce qu'il faut avoir lu avant de lancer. */
  alertes: string[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Étale N invitations sur le calendrier, en respectant la rampe et le plafond.
 *
 * Le week-end est sauté : une invitation le dimanche à 22 h est vue le lundi
 * au milieu de trente autres, et un rythme 7 j/7 ressemble à une machine.
 *
 * Ce que ça sert VRAIMENT : mettre une date sur « 200 personnes ». Tant que
 * le nombre est un vœu, il paraît faisable en une matinée. Vu comme un
 * calendrier, il se décide autrement.
 */
export function planifierCampagne(
  cibles: number,
  opts: { depart?: Date; semaineDepart?: number } = {}
): PlanCampagne {
  const n = Math.max(0, Math.floor(cibles));
  const depart = opts.depart ? new Date(opts.depart) : new Date();
  const jours: JourCampagne[] = [];
  const alertes: string[] = [];

  let restant = n;
  const curseur = new Date(Date.UTC(depart.getUTCFullYear(), depart.getUTCMonth(), depart.getUTCDate()));
  let semaineCampagne = Math.max(0, opts.semaineDepart ?? 0);
  let envoyeesCetteSemaine = 0;
  let joursOuvresEcoules = 0;

  // Borne dure : un plan qui dépasse un trimestre n'est plus un plan, c'est un
  // aveu que le lot est trop gros pour ce canal.
  const MAX_JOURS = 120;
  let garde = 0;

  while (restant > 0 && garde++ < MAX_JOURS) {
    const jourSemaine = curseur.getUTCDay(); // 0 = dimanche, 6 = samedi
    const ouvre = jourSemaine >= 1 && jourSemaine <= 5;

    if (ouvre) {
      // Cinq jours ouvrés par semaine : on répartit le plafond hebdo dessus
      // plutôt que de tout envoyer lundi et de rester bloqué jusqu'au lundi
      // suivant.
      const plafondHebdo = plafondSemaine(semaineCampagne);
      const resteSemaine = Math.max(0, plafondHebdo - envoyeesCetteSemaine);
      const parJour = Math.min(LINKEDIN_DAILY_SAFE, Math.ceil(plafondHebdo / 5));
      const envoi = Math.min(restant, parJour, resteSemaine);

      if (envoi > 0) {
        jours.push({ date: iso(curseur), semaine: semaineCampagne, invitations: envoi });
        restant -= envoi;
        envoyeesCetteSemaine += envoi;
        joursOuvresEcoules++;
      }
    }

    curseur.setUTCDate(curseur.getUTCDate() + 1);
    // Nouvelle semaine le lundi : le compteur hebdo repart et la rampe monte.
    if (curseur.getUTCDay() === 1) {
      semaineCampagne++;
      envoyeesCetteSemaine = 0;
    }
  }

  if (restant > 0) {
    alertes.push(
      `${restant} cible(s) ne tiennent pas dans ${MAX_JOURS} jours. Ce lot est trop gros pour LinkedIn seul — il faut un autre canal, pas plus de vitesse.`
    );
  }

  const semaines = jours.length ? jours[jours.length - 1].semaine - jours[0].semaine + 1 : 0;

  if (n > LINKEDIN_WEEKLY_LIMIT) {
    alertes.push(
      `${n} invitations, c'est ${Math.ceil(n / LINKEDIN_WEEKLY_LIMIT)} semaines au plafond — pas une matinée. LinkedIn compte à la semaine.`
    );
  }
  if (n >= EN_ATTENTE_MAX) {
    alertes.push(
      `À ce volume, la file d'invitations en attente dépassera ${EN_ATTENTE_MAX}. Prévois de retirer les plus vieilles au fil de l'eau (${RETRAIT_APRES_JOURS} jours).`
    );
  }

  return {
    cibles: n,
    jours,
    joursOuvres: joursOuvresEcoules,
    semaines,
    finLe: jours.length ? jours[jours.length - 1].date : null,
    alertes,
  };
}

export interface InvitationEnAttente {
  /** Identifiant de la fiche ou du profil. */
  id: string;
  /** Date d'envoi (ISO). */
  envoyeeLe: string;
}

export interface Hygiene {
  aRetirer: InvitationEnAttente[];
  enAttente: number;
  message: string;
}

/**
 * Quelles invitations retirer.
 *
 * Personne ne fait ce geste spontanément : il ne rapporte rien, il ne se voit
 * pas, et il coûte trois semaines de délai avant de pouvoir réinviter. C'est
 * pourtant lui qui tient le taux d'acceptation — donc le compte.
 */
export function hygieneInvitations(pending: InvitationEnAttente[], now: Date = new Date()): Hygiene {
  const limite = now.getTime() - RETRAIT_APRES_JOURS * JOUR;
  const aRetirer = pending.filter((p) => {
    const t = new Date(p.envoyeeLe).getTime();
    return Number.isFinite(t) && t < limite;
  });

  const message = aRetirer.length
    ? `${aRetirer.length} invitation(s) sans réponse depuis plus de ${RETRAIT_APRES_JOURS} jours. Les retirer remonte le taux d'acceptation — mais interdit de réinviter ces profils pendant ~3 semaines.`
    : pending.length >= EN_ATTENTE_MAX
      ? `${pending.length} invitations en attente, toutes récentes. Rien à retirer : il faut ralentir, pas nettoyer.`
      : "File d'invitations saine.";

  return { aRetirer, enAttente: pending.length, message };
}

export interface Entonnoir {
  invitations: number;
  acceptations: number;
  reponses: number;
  /** La source du taux. On ne présente jamais une hypothèse comme une mesure. */
  source: "mesure" | "aucune";
  note: string;
}

/**
 * L'entonnoir attendu — et le refus d'inventer quand il n'y a rien.
 *
 * La tentation est d'écrire « 30 % d'acceptation, 10 % de réponse » : ces
 * chiffres traînent partout et ont l'air sérieux. Ils ne viennent d'AUCUNE
 * campagne de cette maison, sur AUCUNE de ces verticales, avec CE message.
 * Affichés, ils deviennent la base d'une décision — et une prévision inventée
 * qui se révèle fausse coûte plus cher que pas de prévision du tout.
 *
 * Tant qu'aucune vague n'a tourné, ce module renvoie donc la question
 * inverse, qui est celle qui se décide vraiment : combien d'acceptations
 * faut-il pour que le temps passé vaille le coup.
 */
export function entonnoir(
  invitations: number,
  mesure?: { tauxAcceptation: number; tauxReponse: number }
): Entonnoir {
  const n = Math.max(0, Math.floor(invitations));
  if (!mesure) {
    return {
      invitations: n,
      acceptations: 0,
      reponses: 0,
      source: "aucune",
      note:
        `Aucune campagne mesurée : je ne mets pas de taux ici. La question qui se tranche avant de lancer, ` +
        `c'est combien de rendez-vous justifient ${n} invitations relues à la main — pas quel pourcentage un ` +
        `article promet. Le premier taux réel viendra de cette vague-ci.`,
    };
  }
  const acceptations = Math.round(n * clamp01(mesure.tauxAcceptation));
  return {
    invitations: n,
    acceptations,
    reponses: Math.round(acceptations * clamp01(mesure.tauxReponse)),
    source: "mesure",
    note: `Projection basée sur tes taux observés (${Math.round(clamp01(mesure.tauxAcceptation) * 100)} % d'acceptation, ${Math.round(clamp01(mesure.tauxReponse) * 100)} % de réponse).`,
  };
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
