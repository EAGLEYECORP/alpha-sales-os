import type { RegleAlpha } from "./circuit-alpha";
import { PLAFOND_SOLLICITATIONS_B2C } from "./call-cadence";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « CE QU'ALPHA FAIT ICI » — le détail de chaque écran, au même endroit.
 *
 * Décidé le 21/10/2026 : « toutes les pages d'ALPHA donnent l'info détaillée de
 * chaque étape ». Plutôt que d'écrire un encart dans trente-cinq fichiers (la
 * dérive que `PageHeader` a déjà payée), UN registre : route → ce qu'ALPHA y
 * fait. La coquille le monte une seule fois sous la bande de présence.
 *
 * ⚠⚠ **UNE PAGE ABSENTE DU REGISTRE N'AFFICHE RIEN.** On n'écrit pas « ALPHA
 * fait des choses ici » sur un écran dont on n'a pas lu le code : une
 * description inventée est pire que pas de description. Chaque entrée est
 * écrite après lecture de ce que l'écran appelle, et `tests/alpha-ici.test.ts`
 * ouvre chaque fichier cité et y cherche le symbole.
 *
 * ⚠ **Tranche 1 : sept écrans.** Les autres s'ajoutent ici, un par un, avec la
 * même preuve. Le test refuse une route qui n'existe pas dans `app/`.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface PageAlpha {
  /** Préfixe de route (`/appels` couvre aussi `/appels/…`). */
  route: string;
  titre: string;
  etapes: RegleAlpha[];
  nePasFaire: string;
}

export const ALPHA_ICI: readonly PageAlpha[] = [
  {
    route: "/aujourdhui",
    titre: "Ta journée",
    etapes: [
      { quoi: "Lit ton pipe et le trie d'après ta cible.", fichier: "lib/import-triage.ts", symbole: "triageImport" },
      { quoi: "Cherche ce qui attend une décision.", fichier: "lib/routines.ts", symbole: "computeRoutines" },
      {
        quoi: "Prépare un brouillon par fiche — sans jamais écraser ceux que tu as déjà relus.",
        fichier: "lib/mission-alpha.ts",
        symbole: "executerMission",
      },
      { quoi: "Constitue ta liste d'appels.", fichier: "lib/call-session.ts", symbole: "buildCallSession" },
    ],
    nePasFaire: "Il ne peut ni envoyer ni appeler : la mission n'a aucune fonction pour ça.",
  },
  {
    route: "/pipeline",
    titre: "Ton pipeline",
    etapes: [
      { quoi: "Range chaque fiche dans son étape, avec ce qu'elle attend.", fichier: "lib/hormozi.ts", symbole: "STAGES" },
      {
        quoi: "Lit l'état de chaque fiche : prête, fatiguée, ou à laisser tranquille.",
        fichier: "lib/master-rappel.ts",
        symbole: "masterRappel",
      },
      {
        quoi: "Signale un prix annoncé sur une ancienne grille — sans le corriger.",
        fichier: "lib/grille-perimee.ts",
        symbole: "prixPerime",
      },
    ],
    nePasFaire: "Il classe et il signale ; ce qui engage (envoi, signature, encaissement) ne part jamais seul.",
  },
  {
    route: "/decisions",
    titre: "Ce qui t'attend",
    etapes: [
      {
        quoi: "Rassemble en une seule liste tout ce qui attend un humain, la plus urgente d'abord.",
        fichier: "lib/presence-alpha.ts",
        symbole: "attendentUnHumain",
      },
      {
        quoi: "Repère les relances en retard, les prochaines étapes manquantes, les rendez-vous à débriefer.",
        fichier: "lib/routines.ts",
        symbole: "computeRoutines",
      },
    ],
    nePasFaire: "Il ne décide pas : il te dit quoi décider.",
  },
  {
    route: "/appels",
    titre: "Ta file d'appels",
    etapes: [
      {
        quoi: "Compose la file du jour, la plus chaude d'abord, sans les fiches qui ont dit non.",
        fichier: "lib/call-session.ts",
        symbole: "buildCallSession",
      },
      {
        quoi: "Sort de la file une société en liquidation, radiée ou dissoute — lue au BODACC par son SIREN, comptée et nommée.",
        fichier: "lib/call-session.ts",
        symbole: "dansLaFile",
      },
      {
        quoi: "Remonte en tête celle qui vient de changer de dirigeant, d'adresse ou de propriétaire — sans que tu le lui dises.",
        fichier: "lib/signaux-publics.ts",
        symbole: "momentFrais",
      },
      { quoi: "N'indique un moment pour appeler que dans une fenêtre ouverte.", fichier: "lib/conformite.ts", symbole: "fenetreOuverte" },
      {
        quoi: `Compte tes sollicitations : jamais plus de ${PLAFOND_SOLLICITATIONS_B2C} en 30 jours.`,
        fichier: "lib/call-cadence.ts",
        symbole: "PLAFOND_SOLLICITATIONS_B2C",
      },
    ],
    nePasFaire: "Il n'appelle pas à ta place : tu composes depuis ton propre téléphone.",
  },
  {
    route: "/campaigns",
    titre: "Tes campagnes",
    etapes: [
      { quoi: "Prépare un brouillon par fiche, à relire avant tout envoi.", fichier: "lib/store.ts", symbole: "prepareCampaignDrafts" },
      {
        quoi: "Refuse un message sans les mentions obligatoires : qui écrit, et comment refuser.",
        fichier: "lib/conformite.ts",
        symbole: "verifieMentions",
      },
      {
        quoi: "Plafonne les envois du jour pour ne pas griller ton domaine.",
        fichier: "lib/email-ramp.ts",
        symbole: "rampDepuisPremierEnvoi",
      },
    ],
    nePasFaire: "Il n'envoie rien sans ta validation.",
  },
  {
    route: "/linkedin",
    titre: "Ton approche LinkedIn",
    etapes: [
      { quoi: "Écrit l'invitation et le message de chaque fiche.", fichier: "lib/approche-ecrite.ts", symbole: "approcheEcrite" },
    ],
    nePasFaire: "Il n'envoie rien sur LinkedIn : tu copies, tu envoies toi-même.",
  },
  {
    route: "/cerveau",
    titre: "Ton cerveau",
    etapes: [
      {
        quoi: "Met à jour ses notes d'usine sans écraser celles que tu as modifiées ni ressusciter celles que tu as supprimées.",
        fichier: "lib/knowledge.ts",
        symbole: "reviserSocle",
      },
      {
        quoi: "Étiquette « source externe, non vérifiée chez nous » toute note qui vient d'un livre ou d'une vidéo.",
        fichier: "lib/knowledge.ts",
        symbole: "contextFromNotes",
      },
    ],
    nePasFaire: "Une phrase de livre ne vaut jamais un chiffre mesuré : il ne les met pas au même rang.",
  },
];

/** La page qui couvre ce chemin — la route la plus LONGUE qui le préfixe, `null` sinon. */
export function pageAlphaPour(pathname: string): PageAlpha | null {
  let meilleure: PageAlpha | null = null;
  for (const p of ALPHA_ICI) {
    const couvre = pathname === p.route || pathname.startsWith(`${p.route}/`);
    if (couvre && (!meilleure || p.route.length > meilleure.route.length)) meilleure = p;
  }
  return meilleure;
}
