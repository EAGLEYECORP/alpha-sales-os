import type { Activity, Prospect, Stage } from "./types";
import { STAGES } from "./hormozi";
import type { Routine } from "./routines";
import { attendentUnHumain, presenceAlpha } from "./presence-alpha";
import { fenetreOuverte } from "./conformite";
import { BUSINESS_TZ } from "./business-hours";
import { PLAFOND_SOLLICITATIONS_B2C, prochaineFenetreOuverte } from "./call-cadence";
import { aRefuseTouteRelance } from "./voice-script";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « ALPHA AU TRAVAIL » — ce que la machine fait, étape par étape, et ce
 * qu'elle refuse de faire.
 *
 * Décidé le 21/10/2026 (Zakaria) : un tableau de bord pour l'UTILISATEUR qui
 * montre ce qu'ALPHA fait, avec le détail de chaque étape, en mouvement
 * comme la lecture du site à l'inscription. Ce module porte tout ce qui se
 * DÉCIDE ; les composants (`components/alpha/`) ne font que le mettre en
 * scène.
 *
 * ── CE QUI EST INTERDIT ICI, ET POURQUOI ──
 *
 * 1. **Aucune activité inventée.** Une barre qui avance, un compteur qui
 *    tourne en boucle, un « ALPHA analyse… » sans analyse : chacun est une
 *    petite preuve fabriquée — la même règle que la mission et la lecture du
 *    site. Le mouvement n'accompagne que des FAITS : une carte qui apparaît,
 *    un nombre qui CHANGE, une ligne qui s'ajoute au journal.
 * 2. **Chaque ligne « ce qu'ALPHA fait » NOMME ce qui l'applique** (`fichier`
 *    + `symbole`), et un test ouvre le fichier et cherche le symbole. C'est
 *    ce qui sépare une description d'un argument de vente : une prose qui
 *    dérive du code ne casse rien, elle ment — à l'endroit précis où
 *    quelqu'un vient lire ce que fait le produit (`lib/promesse.ts` applique
 *    la même règle aux preuves de la vitrine).
 * 3. **Aucune définition de plus.** « Ce qui attend un humain » vient de
 *    `attendentUnHumain` ; les étapes et leur sens viennent de `STAGES` ; la
 *    fenêtre d'appel, le plafond et le refus viennent des modules qui les
 *    posent. Ce fichier assemble, il ne tranche rien de neuf.
 * 4. **Un chiffre n'est jamais recopié dans une phrase** : le plafond de
 *    sollicitations s'écrit depuis sa constante.
 *
 * ⚠ Tout ceci lit le CRM DU NAVIGATEUR, onglet ouvert. Ce n'est pas un
 * manque à combler : c'est la frontière décidée le 21/10/2026 (le pipe d'un
 * inscrit en ligne ne vit pas chez nous). L'écran le dit.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Une règle qu'ALPHA applique — avec de quoi la retrouver dans le code. */
export interface RegleAlpha {
  quoi: string;
  /** Chemin depuis la racine du dépôt. Un test l'ouvre. */
  fichier: string;
  /** Le nom qui porte la règle dans ce fichier (export, ou propriété du store). Un test le cherche. */
  symbole: string;
}

export interface EtapeCircuit {
  stage: Stage;
  fait: RegleAlpha[];
  /** Ce qu'ALPHA ne fait PAS à cette étape — dit plutôt que tu. */
  nePasFaire: string;
  lien: { href: string; libelle: string };
}

const VOIR_LES_FICHES = { href: "/pipeline", libelle: "Voir les fiches" };

/**
 * Les huit étapes sont celles de `STAGES` (`lib/hormozi.ts`) — leur nom et leur
 * sens ne sont pas redéfinis ici. Ce tableau n'ajoute que ce qu'ALPHA y fait.
 */
export const CIRCUIT: readonly EtapeCircuit[] = [
  {
    stage: "prospect",
    fait: [
      { quoi: "Trie ta liste d'après ta cible et nomme qui appeler en premier.", fichier: "lib/import-triage.ts", symbole: "triageImport" },
      { quoi: "Compose la file d'appels du jour, sans les fiches qui ont dit non.", fichier: "lib/call-session.ts", symbole: "buildCallSession" },
      { quoi: "Écrit l'invitation et le message d'approche de chaque fiche.", fichier: "lib/approche-ecrite.ts", symbole: "approcheEcrite" },
    ],
    nePasFaire: "Il ne trouve pas tes prospects : la collecte reste à toi (feuille, import). C'est ce qui la garde sous ta responsabilité.",
    lien: { href: "/linkedin", libelle: "Écrire l'approche" },
  },
  {
    stage: "contact",
    fait: [
      { quoi: "Réclame une suite datée : une fiche sans prochaine étape remonte dans « À décider ».", fichier: "lib/routines.ts", symbole: "computeRoutines" },
      { quoi: "Choisit le moment : il n'appelle que dans une fenêtre d'appel ouverte.", fichier: "lib/conformite.ts", symbole: "fenetreOuverte" },
      {
        quoi: `Plafonne les sollicitations : jamais plus de ${PLAFOND_SOLLICITATIONS_B2C} contacts en 30 jours.`,
        fichier: "lib/call-cadence.ts",
        symbole: "PLAFOND_SOLLICITATIONS_B2C",
      },
      { quoi: "Écarte quiconque a dit « ne plus m'appeler ».", fichier: "lib/voice-script.ts", symbole: "aRefuseTouteRelance" },
    ],
    nePasFaire: "Il n'envoie et n'appelle pas à ta place : il prépare, tu valides.",
    lien: { href: "/appels", libelle: "Voir la file d'appels" },
  },
  {
    stage: "audit",
    fait: [
      {
        quoi: "Lit l'état de chaque fiche : prête à signer, fatiguée ou à laisser tranquille — et quand revenir.",
        fichier: "lib/master-rappel.ts",
        symbole: "masterRappel",
      },
    ],
    nePasFaire: "Il ne fait pas le diagnostic sur place : la visite et la mesure restent à toi.",
    lien: VOIR_LES_FICHES,
  },
  {
    stage: "demo",
    fait: [
      {
        quoi: "Garde la règle « la démo avant le prix » dans les consignes qu'il donne à l'IA.",
        fichier: "lib/business-rules.ts",
        symbole: "DEFAULT_BUSINESS_RULES",
      },
    ],
    nePasFaire: "Il ne tient pas le rendez-vous : la présence et la poignée de main restent à toi.",
    lien: VOIR_LES_FICHES,
  },
  {
    stage: "offre",
    fait: [
      { quoi: "Refuse de fabriquer un devis tant que le cadrage n'est pas validé.", fichier: "lib/cadrage.ts", symbole: "peutEmettreDevis" },
      { quoi: "Signale un prix annoncé sur une ancienne grille — sans jamais le corriger en douce.", fichier: "lib/grille-perimee.ts", symbole: "prixPerime" },
    ],
    nePasFaire: "Il n'annonce aucun prix à ta place : il le chiffre pour toi, tu l'annonces.",
    lien: VOIR_LES_FICHES,
  },
  {
    stage: "redzone",
    fait: [
      {
        quoi: "Range l'objection dans sa couche (circonstances, les autres…) et propose comment la peler.",
        fichier: "lib/hormozi.ts",
        symbole: "BLAME_LAYERS",
      },
      { quoi: "Cherche une raison de revenir qui soit vraie — ou te dit de ne pas relancer.", fichier: "lib/raison-neuve.ts", symbole: "raisonNeuve" },
    ],
    nePasFaire: "Il ne négocie pas : une objection se traite de vive voix.",
    lien: VOIR_LES_FICHES,
  },
  {
    stage: "signe",
    fait: [
      {
        quoi: "Fait remonter encaissement, livraison, satisfaction et témoignage à leur échéance.",
        fichier: "lib/routines.ts",
        symbole: "computeRoutines",
      },
    ],
    nePasFaire: "Il ne livre pas ta prestation : la livraison reste à toi.",
    lien: VOIR_LES_FICHES,
  },
  {
    stage: "perdu",
    fait: [
      { quoi: "Sort la fiche des files d'appels.", fichier: "lib/call-session.ts", symbole: "buildCallSession" },
      { quoi: "Cesse de la relancer.", fichier: "lib/routines.ts", symbole: "computeRoutines" },
    ],
    nePasFaire: "Il n'efface rien : la fiche reste dans ton pipe, marquée perdue.",
    lien: VOIR_LES_FICHES,
  },
];

/* ───────────── le circuit chiffré ───────────── */

export interface LigneCircuit extends EtapeCircuit {
  label: string;
  hint: string;
  fiches: number;
  /** Fiches de cette étape qui ont quelque chose qui attend un humain. */
  attendent: number;
}

export interface Circuit {
  lignes: LigneCircuit[];
  /** Ce qui attend un humain sans être rattaché à une fiche (relire une campagne, confirmer un RDV). */
  attendentHorsFiche: number;
}

const HREF_FICHE = /^\/prospects\/([^/?#]+)/;

/**
 * Le circuit avec ses nombres. « Attendent » se lit sur `attendentUnHumain`
 * (la seule définition) et se range par l'ÉTAPE DE LA FICHE visée par la
 * routine — aucune table « catégorie → étape » de plus à tenir à jour.
 */
export function lireCircuit(prospects: Prospect[], routines: Routine[]): Circuit {
  const etapeDe = new Map(prospects.map((p) => [p.id, p.stage]));
  const parEtape = new Map<Stage, number>();
  let horsFiche = 0;

  // Une fiche compte UNE fois même si trois choses l'attendent : on compte des
  // fiches, pas des routines, sinon « 3 attendent » sur une seule fiche ment.
  const fichesQuiAttendent = new Set<string>();
  for (const r of attendentUnHumain(routines)) {
    const id = HREF_FICHE.exec(r.href)?.[1];
    const stage = id ? etapeDe.get(id) : undefined;
    if (!id || !stage) {
      horsFiche++;
      continue;
    }
    if (fichesQuiAttendent.has(id)) continue;
    fichesQuiAttendent.add(id);
    parEtape.set(stage, (parEtape.get(stage) ?? 0) + 1);
  }

  return {
    attendentHorsFiche: horsFiche,
    lignes: CIRCUIT.map((e) => {
      const meta = STAGES.find((s) => s.id === e.stage);
      return {
        ...e,
        label: meta?.label ?? e.stage,
        hint: meta?.hint ?? "",
        fiches: prospects.filter((p) => p.stage === e.stage).length,
        attendent: parEtape.get(e.stage) ?? 0,
      };
    }),
  };
}

/* ───────────── le pouls ───────────── */

export interface Pouls {
  ouvertes: number;
  aToi: number;
  urgentes: number;
  /** Fiches ouvertes écartées des files parce qu'elles ont dit non. */
  refuses: number;
  fenetre: { ouverte: boolean; libelle: string; prochaine: Date | null };
  phrase: string;
}

const OUVERT = (p: Prospect) => p.stage !== "signe" && p.stage !== "perdu";

/** Horloge INJECTÉE : « la fenêtre est-elle ouverte ? » dépend de l'heure, et un test ne la devine pas. */
export function pouls(prospects: Prospect[], routines: Routine[], maintenant: Date): Pouls {
  const ouvertes = prospects.filter(OUVERT);
  const presence = presenceAlpha(routines);
  const f = fenetreOuverte(maintenant);
  const refuses = ouvertes.filter((p) => aRefuseTouteRelance(p)).length;

  return {
    ouvertes: ouvertes.length,
    aToi: presence.aToi,
    urgentes: presence.urgentes,
    refuses,
    fenetre: { ouverte: f.open, libelle: f.label, prochaine: f.open ? null : prochaineFenetreOuverte(maintenant) },
    phrase:
      prospects.length === 0
        ? "Ton pipe est vide : je n'ai rien à veiller. Importe tes fiches, ou donne l'adresse de ton site."
        : `Je veille ${ouvertes.length} ${ouvertes.length > 1 ? "fiches ouvertes" : "fiche ouverte"}. ${presence.phrase}`,
  };
}

/** « mardi 14:00 » — l'heure de PARIS, jamais celle de la machine (c'est l'heure à laquelle les gens décrochent). */
export function libelleOuverture(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BUSINESS_TZ,
  }).format(d);
}

/* ───────────── les garde-fous armés ───────────── */

export interface GardeArmee {
  id: "fenetre" | "plafond" | "refus" | "preparer";
  titre: string;
  etat: string;
  regle: RegleAlpha;
}

/** Ce qu'ALPHA surveille EN CE MOMENT, avec la valeur du moment — pas une liste de principes. */
export function gardesArmes(prospects: Prospect[], maintenant: Date): GardeArmee[] {
  const p = pouls(prospects, [], maintenant);
  return [
    {
      id: "fenetre",
      titre: "Fenêtre d'appel",
      etat: p.fenetre.ouverte
        ? `ouverte (${p.fenetre.libelle})`
        : `fermée (${p.fenetre.libelle})${p.fenetre.prochaine ? ` — prochaine ouverture : ${libelleOuverture(p.fenetre.prochaine)}` : ""}`,
      regle: { quoi: "Aucun appel hors fenêtre.", fichier: "lib/conformite.ts", symbole: "fenetreOuverte" },
    },
    {
      id: "plafond",
      titre: "Plafond de sollicitations",
      etat: `${PLAFOND_SOLLICITATIONS_B2C} contacts au plus, sur 30 jours glissants`,
      regle: { quoi: "Jamais au-dessus du plafond légal.", fichier: "lib/call-cadence.ts", symbole: "PLAFOND_SOLLICITATIONS_B2C" },
    },
    {
      id: "refus",
      titre: "Refus respectés",
      etat:
        p.refuses === 0
          ? "personne n'a dit non pour l'instant"
          : `${p.refuses} ${p.refuses > 1 ? "fiches écartées" : "fiche écartée"} des files : elles ont dit non`,
      regle: { quoi: "Un « non » écarte la fiche pour de bon.", fichier: "lib/voice-script.ts", symbole: "aRefuseTouteRelance" },
    },
    {
      id: "preparer",
      titre: "Rien ne part sans toi",
      etat: "dans ton navigateur, ALPHA prépare des brouillons — il n'a aucune fonction d'envoi ni d'appel",
      regle: { quoi: "Le seul geste qui écrit : préparer des brouillons.", fichier: "lib/mission-alpha.ts", symbole: "ActionsMission" },
    },
  ];
}

/* ───────────── le journal ───────────── */

export const LIBELLE_KIND: Record<Activity["kind"], string> = {
  prospect: "Fiche",
  stage: "Étape",
  meeting: "Rendez-vous",
  campagne: "Campagne",
  ia: "IA",
  systeme: "ALPHA",
  signe: "Signé",
  perdu: "Perdu",
};

export interface LigneJournal {
  id: string;
  date: string;
  kind: Activity["kind"];
  libelleKind: string;
  message: string;
  prospectId?: string;
}

/** Les dernières traces, la plus récente d'abord. On plafonne l'AFFICHAGE ; le journal, lui, garde tout. */
export function journalRecent(activities: Activity[], limite = 12): LigneJournal[] {
  return [...activities]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limite)
    .map((a) => ({
      id: a.id,
      date: a.date,
      kind: a.kind,
      libelleKind: LIBELLE_KIND[a.kind],
      message: a.message,
      prospectId: a.prospectId,
    }));
}

/**
 * « à l'instant », « il y a 5 min », « il y a 3 h », « hier »… Horloge injectée.
 * `relativeFr` (`lib/utils`) compte en JOURS : sur un journal qui vit à la
 * minute, tout ce qui date d'aujourd'hui se lirait « aujourd'hui ».
 */
export function ilYa(iso: string, maintenant: Date): string {
  const s = Math.max(0, Math.round((maintenant.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "à l'instant";
  const min = Math.round(s / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? "hier" : `il y a ${j} j`;
}
