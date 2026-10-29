import type { ProfilOperateur } from "./profil-operateur";
import type { ReglagesAutopilote } from "./autopilote-inscrit";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ALPHA VEND ALPHA — la configuration du compte MAÎTRE, servie par le serveur.
 *
 * Demande de Zakaria (29/10/2026) : « configure de ton côté ALPHA complètement
 * pour contact@eagleyecorp.fr ». La configuration d'ALPHA en ligne vit dans le
 * NAVIGATEUR : aucune session ne peut l'écrire chez lui. Ce qui peut se faire
 * d'ici, c'est qu'elle arrive toute faite : `/api/autopilote/configuration`
 * la sert au maître, `/autopilote` l'applique quand rien n'est encore réglé.
 *
 * ⚠ SERVEUR SEULEMENT : notre cible (le métier, la zone) n'a rien à faire dans
 * un chunk `_next/static` que n'importe qui télécharge — même règle que
 * `lib/accounts-commercial.ts`. Un test refuse qu'un fichier client l'importe.
 *
 * ⚠ CE QUI N'Y EST PAS, EXPRÈS : la clé Dropcontact, l'adresse de l'agenda et
 * le mot de passe de la boîte. Ce sont des SECRETS à lui ; les écrire ici les
 * publierait dans le dépôt. Ils se collent à l'écran, et ne quittent pas son
 * navigateur (clé, agenda) ni Vercel (mot de passe). Le nom du signataire n'y
 * est pas non plus : il se tape (voir `agencyName` plus bas).
 *
 * Les valeurs sont des DÉCISIONS, pas des mesures : la cible (agences
 * immobilières du Rhône) est celle du film du 29/10 ; aucun envoi réel ne l'a
 * encore validée. Détail et ordre des gestes : `docs/ALPHA-VEND-ALPHA.md`.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ConfigurationAlphaVendAlpha {
  agencyName: string;
  ville: string;
  profil: ProfilOperateur;
  /** Sans `actif` : lancer reste un geste humain, jamais une configuration. */
  autopilote: Omit<ReglagesAutopilote, "actif">;
}

export const CONFIGURATION_ALPHA_VEND_ALPHA: ConfigurationAlphaVendAlpha = {
  /**
   * ⚠ Pas de `closerName` : on ne pose jamais l'identité d'un HUMAIN par
   * configuration (`lib/signature.ts`, gardé par `tests/signature.test.ts`).
   * Sans nom saisi, la signature retombe sur la société — légale, et vraie.
   */
  agencyName: "EAGLEYE CORP",
  ville: "Lyon",
  profil: {
    poste: "dirigeant",
    metier: "un OS de vente qui trouve vos clients et pose vos rendez-vous",
    cibleSecteur: "agences immobilières",
    cibleRole: "dirigeants",
    cibleZone: "Rhône",
  },
  autopilote: {
    activites: ["68.31Z"],
    zone: "69",
    taille: "toutes",
    enrichissementsParJour: 10,
    // Le palier du SERVEUR est de 5 la première semaine : demander plus ne
    // ferait que produire des refus 429 dans le journal.
    envoisParJour: 5,
    /**
     * ⚠ NON VÉRIFIÉ avec la boîte : deux serveurs IMAPS d'Amen répondent sur
     * le port 993 (bannière lue le 29/10, sans authentification) —
     * `pop.securemail.pro` et `mail.securemail.pro`. Lequel porte `contact@`
     * ne se sait qu'en s'y connectant : si le journal dit « Réponses non
     * lues », c'est l'autre. Même domaine que le SMTP (`securemail.pro`),
     * seule condition pour que le mot de passe y parte.
     */
    imapHost: "pop.securemail.pro",
    canalRdv: "visio",
    dureeRdvMin: 20,
  },
};

