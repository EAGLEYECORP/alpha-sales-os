import type { Campaign, CampaignDraft, Meeting, Prospect } from "./types";
import { triageImport } from "./import-triage";
import { buildCallSession } from "./call-session";
import { computeRoutines } from "./routines";
import { presenceAlpha } from "./presence-alpha";
import { isDemoProspect } from "./seed";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA MISSION — « Lancer ALPHA » : un bouton, et le travail s'enchaîne.
 *
 * Décidé le 20/10/2026 : ALPHA doit se vivre comme Cowork ou Manus — on
 * appuie, il travaille devant l'utilisateur, il s'arrête et dit ce qu'il lui
 * faut d'un humain. Avant, la même chaîne demandait de passer par six écrans :
 * l'import, le tri, les décisions, les campagnes, les brouillons, les appels.
 *
 * ⚠⚠ CE QUI EST UNE MISSION, ET CE QUI NE L'EST PAS.
 *
 * Chaque étape fait un TRAVAIL RÉEL avec les modules qui existent déjà — le
 * tri d'import, les routines, la préparation des brouillons, la file d'appels —
 * et rapporte ce qu'elle a effectivement trouvé ou produit. Aucun délai n'est
 * inventé, aucune barre de progression : une étape instantanée est instantanée.
 *
 * ⚠⚠ ELLE NE FAIT QU'UNE CHOSE QUI ÉCRIT : préparer des brouillons, qui
 * attendent une relecture. **Elle n'envoie rien et n'appelle personne**, et ce
 * n'est pas une consigne : `ActionsMission` ne contient pas de geste d'envoi,
 * donc il n'existe rien à appeler. Un test le tient. C'est la règle des
 * propositions (`lib/propositions.ts`) appliquée au bouton : un agent qui agit
 * sur un pipe réel doit pouvoir se tromper sans que ça coûte un client.
 *
 * ⚠ ELLE TOURNE DANS LE NAVIGATEUR, onglet ouvert. Le CRM d'un compte gratuit
 * vit dans son `localStorage` : le serveur ne le voit pas, donc il ne peut pas
 * lancer cette mission à sa place pendant qu'il dort. Un ALPHA qui travaille
 * app fermée exige que le pipe vive sur un serveur (`pipeServeur`, opt-in) et
 * un déclencheur par locataire — un chantier à part, qui est une décision de
 * souveraineté. Voir `lib/presence-alpha.ts`.
 *
 * ⚠ LES ÉTAPES NE SE DÉDOUBLENT PAS : « ce qui attend un humain » vient de
 * `computeRoutines`, comme la bande de présence — une définition de plus aurait
 * fait dire « 4 choses t'attendent » ici et « 6 » dans la bande.
 * ─────────────────────────────────────────────────────────────────────
 */

export type IdEtape = "lire" | "trier" | "decider" | "brouillons" | "appels" | "bilan";

/**
 * `a-toi` : l'étape a fini ET il reste quelque chose qu'un humain doit faire.
 * `vide`  : il n'y avait rien à traiter — ce n'est pas un échec.
 * `saute` : une étape qui n'avait pas de matière, ou qu'une précédente a rendue sans objet.
 */
export type StatutEtape = "fait" | "a-toi" | "vide" | "saute";

export interface DetailEtape {
  texte: string;
  href?: string;
}

export interface EtapeMission {
  id: IdEtape;
  titre: string;
  statut: StatutEtape;
  resume: string;
  chiffres: { label: string; valeur: number }[];
  /** Les premiers éléments concernés — jamais la liste entière (on plafonne l'AFFICHAGE, pas le compte). */
  details: DetailEtape[];
  lien: { href: string; libelle: string } | null;
  /** Ce qui manque pour aller plus loin, quand c'est un compte à brancher. */
  besoin?: "email";
}

export interface ContexteMission {
  prospects: Prospect[];
  meetings: Meeting[];
  campaigns: Campaign[];
  drafts: CampaignDraft[];
  /** Absent = compte maître (comme partout : `settings.accountId`). */
  accountId?: string;
  /** La boîte d'envoi du locataire est-elle branchée ? `null` = ne s'applique pas / inconnu. */
  email: boolean | null;
}

export interface ResultatBrouillons {
  aRelire: number;
  ecartes: number;
}

/**
 * ⚠ CE QUE LA MISSION A LE DROIT DE FAIRE — la liste ENTIÈRE.
 *
 * Un seul geste qui écrit, et il ne fait que préparer. Y ajouter un envoi,
 * un appel ou une suppression serait donner la gâchette à l'agent : ça se
 * décide dans un commit, et ça se voit ici.
 */
export interface ActionsMission {
  preparerBrouillons(campagneId: string): ResultatBrouillons;
}

export interface BilanMission {
  etapes: EtapeMission[];
  /** Ce qui attend un humain APRÈS la mission (haute + moyenne). */
  aToi: number;
  brouillonsPrepares: number;
  /** Vrai quand tout le pipe est de la démonstration. */
  demo: boolean;
  /** Toujours 0 : la mission n'a aucun moyen d'envoyer. Écrit pour que ça se LISE. */
  envoyes: 0;
}

const TITRES: Record<IdEtape, string> = {
  lire: "Je lis ton pipe",
  trier: "Je trie selon ta cible",
  decider: "Je cherche ce qui attend une décision",
  brouillons: "Je prépare les messages",
  appels: "Je constitue ta liste d'appels",
  bilan: "Ce qui t'attend",
};

const PLURIEL = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);
const OUVERTES = (ps: Prospect[]) => ps.filter((p) => p.stage !== "signe" && p.stage !== "perdu");

type Corps = Omit<EtapeMission, "id" | "titre">;

const etape = (id: IdEtape, c: Partial<Corps> & Pick<Corps, "statut" | "resume">): EtapeMission => ({
  id,
  titre: TITRES[id],
  chiffres: [],
  details: [],
  lien: null,
  ...c,
});

function lire(ctx: ContexteMission): EtapeMission {
  const { prospects } = ctx;
  if (prospects.length === 0) {
    return etape("lire", {
      statut: "vide",
      resume: "Ton pipe est vide. Importe tes fiches, ou donne l'adresse de ton site et je configure le reste.",
      lien: { href: "/settings", libelle: "Importer des fiches" },
    });
  }
  const ouvertes = OUVERTES(prospects).length;
  const demo = prospects.every((p) => isDemoProspect(p.id));
  return etape("lire", {
    statut: "fait",
    resume: demo
      ? `${prospects.length} fiches — ce sont des fiches de DÉMONSTRATION : rien de ce que je prépare ne part vers un vrai prospect.`
      : `${prospects.length} ${PLURIEL(prospects.length, "fiche", "fiches")}, dont ${ouvertes} ${PLURIEL(ouvertes, "ouverte", "ouvertes")}.`,
    chiffres: [
      { label: "fiches", valeur: prospects.length },
      { label: "ouvertes", valeur: ouvertes },
    ],
  });
}

function trier(ctx: ContexteMission): EtapeMission {
  const t = triageImport(OUVERTES(ctx.prospects), ctx.accountId);
  const nom = new Map(ctx.prospects.map((p) => [p.id, p.company]));
  return etape("trier", {
    statut: "fait",
    // Le verdict est celui de l'import, mot pour mot : une seule phrase, un seul module.
    resume: t.verdict,
    chiffres: [
      { label: "chaudes", valeur: t.byFit.chaud },
      { label: "tièdes", valeur: t.byFit.tiede },
      { label: "froides", valeur: t.byFit.froid },
      { label: "hors cible", valeur: t.byFit["hors-icp"] },
    ],
    details: t.callFirst.slice(0, 3).map((d) => ({ texte: `À appeler en premier : ${nom.get(d.prospectId) ?? "fiche"}`, href: `/prospects/${d.prospectId}` })),
  });
}

function decider(ctx: ContexteMission): EtapeMission {
  const routines = computeRoutines({ prospects: ctx.prospects, meetings: ctx.meetings, campaigns: ctx.campaigns, drafts: ctx.drafts });
  const p = presenceAlpha(routines);
  if (p.aToi === 0) {
    return etape("decider", { statut: "vide", resume: "Rien n'attend de décision : chaque fiche ouverte a sa suite." });
  }
  return etape("decider", {
    statut: "a-toi",
    resume: p.phrase,
    chiffres: [
      { label: "urgentes", valeur: p.urgentes },
      { label: "à traiter", valeur: p.aToi },
    ],
    details: routines
      .filter((r) => r.priority !== "basse")
      .slice(0, 3)
      .map((r) => ({ texte: r.title, href: r.href })),
    lien: { href: "/pilote", libelle: "Voir tout ce qui attend" },
  });
}

function brouillons(ctx: ContexteMission, actions: ActionsMission): { etape: EtapeMission; prepares: number } {
  const actives = ctx.campaigns.filter((c) => c.status === "active");
  if (actives.length === 0) {
    return {
      prepares: 0,
      etape: etape("brouillons", {
        statut: "saute",
        resume: "Aucune campagne active : je n'ai rien à préparer. Active une campagne et je rédige les messages.",
        lien: { href: "/campaigns", libelle: "Ouvrir les campagnes" },
      }),
    };
  }

  let aRelire = 0;
  let ecartes = 0;
  let prepares = 0;
  const noms: string[] = [];
  for (const c of actives) {
    const existants = ctx.drafts.filter((d) => d.campaignId === c.id);
    if (existants.length > 0) {
      // ⚠ On ne re-prépare JAMAIS une campagne qui a déjà des brouillons :
      // `prepareCampaignDrafts` les REMPLACE, et ceux qu'on a relus, approuvés ou
      // envoyés disparaîtraient. Une mission relancée deux fois ne doit rien perdre.
      const attente = existants.filter((d) => d.status === "pending").length;
      aRelire += attente;
      ecartes += existants.filter((d) => d.status === "skipped").length;
      if (attente > 0) noms.push(c.name);
      continue;
    }
    const r = actions.preparerBrouillons(c.id);
    prepares += r.aRelire;
    aRelire += r.aRelire;
    ecartes += r.ecartes;
    if (r.aRelire > 0) noms.push(c.name);
  }

  const aRelireTxt = `${aRelire} ${PLURIEL(aRelire, "message", "messages")} ${PLURIEL(aRelire, "attend", "attendent")} ta relecture`;
  const nouveaux = prepares > 0 ? ` (${prepares} préparé${prepares > 1 ? "s" : ""} à l'instant)` : "";
  const mur: DetailEtape[] = [];
  if (aRelire > 0 && ctx.email === false) {
    mur.push({ texte: "Pour envoyer ce que j'ai préparé, il me faut ta boîte d'envoi — deux champs." });
  }
  const demoSeul = ctx.prospects.length > 0 && ctx.prospects.every((p) => isDemoProspect(p.id));
  return {
    prepares,
    etape: etape("brouillons", {
      statut: aRelire > 0 ? "a-toi" : "vide",
      resume:
        aRelire > 0
          ? `${aRelireTxt}${nouveaux}. Rien n'est parti.`
          : demoSeul
            ? "Les fiches de démonstration n'ont pas d'adresse réelle : je n'ai rien écrit pour elles."
            : "Aucun message à relire : aucune fiche active ne correspond à tes campagnes, ou elles n'ont pas d'adresse.",
      chiffres: [
        { label: "à relire", valeur: aRelire },
        { label: "écartés", valeur: ecartes },
      ],
      details: [...noms.slice(0, 2).map((n) => ({ texte: `Campagne « ${n} »`, href: "/campaigns" })), ...mur],
      lien: aRelire > 0 ? { href: "/campaigns", libelle: "Relire et envoyer" } : null,
      besoin: aRelire > 0 && ctx.email === false ? "email" : undefined,
    }),
  };
}

function appels(ctx: ContexteMission): EtapeMission {
  const { targets } = buildCallSession(OUVERTES(ctx.prospects), "");
  const joignables = targets.filter((t) => Boolean(t.prospect.phone?.trim()));
  const chauds = joignables.filter((t) => t.hot).length;
  if (joignables.length === 0) {
    return etape("appels", {
      statut: "vide",
      resume: "Aucune fiche ouverte n'a de numéro : pas de liste d'appels aujourd'hui.",
    });
  }
  return etape("appels", {
    statut: "fait",
    resume: `${joignables.length} ${PLURIEL(joignables.length, "fiche appelable", "fiches appelables")}${chauds > 0 ? `, dont ${chauds} ${PLURIEL(chauds, "à signal fort", "à signal fort")}` : ""}. C'est toi qui composes.`,
    chiffres: [
      { label: "appelables", valeur: joignables.length },
      { label: "signal fort", valeur: chauds },
    ],
    lien: { href: "/appels", libelle: "Ouvrir la liste du jour" },
  });
}

function bilan(ctx: ContexteMission, prepares: number): { etape: EtapeMission; aToi: number } {
  const routines = computeRoutines({ prospects: ctx.prospects, meetings: ctx.meetings, campaigns: ctx.campaigns, drafts: ctx.drafts });
  const p = presenceAlpha(routines);
  return {
    aToi: p.aToi,
    etape: etape("bilan", {
      statut: p.aToi > 0 ? "a-toi" : "fait",
      resume:
        (p.aToi > 0 ? `${p.phrase} ` : "Rien n'attend de décision. ") +
        // ⚠ Dit en toutes lettres : c'est la garantie que le bouton ne peut pas se retourner contre l'opérateur.
        "Rien n'est parti : je n'ai envoyé aucun message ni passé aucun appel.",
      chiffres: [
        { label: "à toi", valeur: p.aToi },
        { label: "brouillons préparés", valeur: prepares },
      ],
      lien: p.aToi > 0 ? { href: "/pilote", libelle: "Traiter ce qui attend" } : null,
    }),
  };
}

/**
 * Lance la mission, étape par étape.
 *
 * `lireEtat` est rappelé à CHAQUE étape : les brouillons créés par l'étape 4 doivent
 * être visibles du bilan, et un état figé au départ compterait le travail à
 * rebours. `rendre` reçoit la liste COMPLÈTE après chaque étape ; `pause` rend
 * la main au navigateur entre deux étapes (0 ms par défaut — ce n'est pas un
 * délai d'ambiance, c'est ce qui laisse l'écran se repeindre).
 */
export async function executerMission(
  lireEtat: () => ContexteMission,
  actions: ActionsMission,
  rendre: (etapes: readonly EtapeMission[]) => void,
  pause: () => Promise<void> = () => new Promise<void>((r) => setTimeout(r, 0))
): Promise<BilanMission> {
  const etapes: EtapeMission[] = [];
  const pousser = async (e: EtapeMission) => {
    etapes.push(e);
    rendre([...etapes]);
    await pause();
  };

  const ctx0 = lireEtat();
  const premiere = lire(ctx0);
  await pousser(premiere);

  const demo = ctx0.prospects.length > 0 && ctx0.prospects.every((p) => isDemoProspect(p.id));

  if (premiere.statut === "vide") {
    // Rien à traiter : les étapes suivantes n'ont pas de matière, et on le DIT
    // plutôt que de les faire défiler à vide.
    for (const id of ["trier", "decider", "brouillons", "appels"] as const) {
      await pousser(etape(id, { statut: "saute", resume: "Rien à traiter tant que le pipe est vide." }));
    }
    const b = bilan(lireEtat(), 0);
    await pousser(b.etape);
    return { etapes, aToi: b.aToi, brouillonsPrepares: 0, demo, envoyes: 0 };
  }

  await pousser(trier(lireEtat()));
  await pousser(decider(lireEtat()));
  const b4 = brouillons(lireEtat(), actions);
  await pousser(b4.etape);
  await pousser(appels(lireEtat()));
  const b6 = bilan(lireEtat(), b4.prepares);
  await pousser(b6.etape);

  return { etapes, aToi: b6.aToi, brouillonsPrepares: b4.prepares, demo, envoyes: 0 };
}
