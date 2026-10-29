import type { MeetingChannel, Prospect } from "./types";
import type { TailleCible } from "./trouver-clients";
import { aRefuseTouteRelance } from "./voice-script";
import { isDemoProspect } from "./seed";
import { exclusionPublique, momentFrais } from "./signaux-publics";
import { fenetreOuverte } from "./conformite";
import { BUSINESS_TZ } from "./business-hours";
import { relanceDue, raisonRelance } from "./relance-mail";
import { aEnrichir, LOT_ENRICHISSEMENT } from "./enrichissement";
import { TAG_DEJA_ECRIT } from "./mail-autopilote";
import { lireZone } from "./trouver-clients";
import { codeNafValide } from "./naf";
import { emailBody, emailSubject } from "./mail-compose";
import { DIVULGATION_ECRITE } from "./signature-ia";
import type { ExpediteurInscrit } from "./approche-ecrite";
import { TAG_A_TRAITER } from "./reponses-inscrit";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AUTOPILOTE D'UN INSCRIT — ALPHA FAIT TOUTE LA CHAÎNE (29/10/2026).
 *
 * Décision de Zakaria : « ALPHA doit tout faire ». Trouver, obtenir les
 * coordonnées, écrire, lire les réponses, proposer des créneaux, poser le
 * rendez-vous, relancer — sans un clic de l'inscrit.
 *
 * La chaîne existait déjà, mais pour NOTRE compte : des tâches serveur sur
 * NOTRE pipe, NOTRE boîte et n8n (`/api/campaign/*-tick`). Un inscrit n'en
 * avait rien. Ce module la rebâtit pour lui, sur SES outils :
 *   chercher   → le registre de l'État (`lib/trouver-clients.ts`), navigateur
 *   joindre    → Dropcontact avec SA clé (`lib/enrichissement.ts`), navigateur
 *   écrire     → SA boîte, via `/api/send` (palier, mentions, divulgation IA)
 *   lire       → SA boîte en lecture seule (`/api/reponses`)
 *   répondre   → `lib/reponses-inscrit.ts` (créneaux numérotés, RDV + .ics)
 *   relancer   → seulement avec une raison NEUVE (`lib/relance-mail.ts`)
 *
 * ── ⚠⚠ CE QUI NE CHANGE PAS : L'ONGLET OUVERT ──
 * Le pipe d'un inscrit vit dans son navigateur (décision du 21/10/2026 : il
 * ne vit pas chez nous). L'autopilote tourne donc tant qu'un onglet d'ALPHA
 * est ouvert — à côté de son travail, pas pendant sa nuit. L'écran le dit.
 *
 * ── ⚠⚠ LES GARDES QUI NE SE NÉGOCIENT PAS ──
 * · Tout envoi est AUTONOME : divulgation IA dans le corps (art. 50).
 *   `/api/send` refuse un message qui l'a perdue, et un message sans moyen de
 *   refus. Les deux contrôles restent CÔTÉ SERVEUR ; ce module ne les recopie
 *   pas, il construit des messages qui les passent.
 * · Le palier quotidien de la boîte est celui du SERVEUR. Le plafond d'ici
 *   (`envoisParJour`) ne fait que ne pas le marteler ; quand le serveur dit
 *   non, l'autopilote suspend les envois jusqu'au lendemain.
 * · Hors fenêtre utile (`fenetreOuverte`), aucun envoi : la nuit et le
 *   week-end, il lit, il ne parle pas.
 * · On n'écrit pas à qui a refusé, à une société en liquidation, à qui a déjà
 *   reçu un premier message (par lui ou par un autre outil), ni à qui attend
 *   une réponse de l'humain.
 * · Une relance sans raison neuve n'existe pas.
 * · Le prix, la signature et le doute remontent TOUJOURS à l'humain.
 *
 * Ce fichier DÉCIDE ; il ne fait aucune I/O. Le moteur
 * (`components/autopilote/moteur-autopilote.tsx`) exécute et consigne.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ReglagesAutopilote {
  actif: boolean;
  /** Codes NAF que l'autopilote cherche tout seul quand la réserve baisse. */
  activites: string[];
  /** Codes de zone (département ou codes postaux). */
  zone: string;
  taille: TailleCible;
  /** Budget Dropcontact du jour, en fiches lancées. */
  enrichissementsParJour: number;
  /** Plafond d'ici (le serveur a le sien, plus bas la première semaine). */
  envoisParJour: number;
  /** Serveur IMAP saisi quand l'hébergeur n'est pas connu. */
  imapHost?: string;
  canalRdv: MeetingChannel;
  dureeRdvMin: number;
}

export const REGLAGES_AUTOPILOTE_DEFAUT: ReglagesAutopilote = {
  actif: false,
  activites: [],
  zone: "",
  taille: "toutes",
  enrichissementsParJour: 20,
  envoisParJour: 20,
  canalRdv: "visio",
  dureeRdvMin: 20,
};

export type TypeJournal = "cherche" | "enrichit" | "ecrit" | "relance" | "lit" | "repond" | "rdv" | "escalade" | "pause" | "erreur";

export interface EntreeJournal {
  le: string;
  type: TypeJournal;
  texte: string;
  prospectId?: string;
}

export interface EtatAutopilote {
  journal: EntreeJournal[];
  /** Identifiants des réponses déjà traitées (un message traité deux fois est un bug). */
  reponsesVues: string[];
  enrichissements: { requestId: string; prospectIds: string[]; lance: string }[];
  /** Dernière page de registre lue, par recherche (activités + zone + taille). */
  pagesRegistre: Record<string, number>;
  /**
   * Recherches ÉPUISÉES (toutes les pages lues), et le jour où elles l'ont été.
   * ⚠ Vu au rendu : sans cette mémoire, l'autopilote relisait la même et unique
   * page à chaque passage — six requêtes par jour pour « 0 ajoutée ».
   */
  ciblesEpuisees?: Record<string, string>;
  /** Combien de fiches lancées chez Dropcontact, et quel jour. */
  enrichisJour: { jour: string; n: number };
  recherchesJour: { jour: string; n: number };
  /** Le serveur a refusé un envoi (palier) : plus d'envoi avant cette heure. */
  envoisSuspendusJusqua?: string;
  derniereLecture?: string;
}

export const ETAT_AUTOPILOTE_VIDE: EtatAutopilote = {
  journal: [],
  reponsesVues: [],
  enrichissements: [],
  pagesRegistre: {},
  enrichisJour: { jour: "", n: 0 },
  recherchesJour: { jour: "", n: 0 },
};

export const JOURNAL_MAX = 80;
export const REPONSES_VUES_MAX = 600;
/** Sous ce nombre de fiches prêtes à recevoir un premier message, ALPHA va en chercher. Décision. */
export const RESERVE_MIN = 10;
export const RECHERCHES_PAR_JOUR = 6;
/** Un passage toutes les trois minutes : vingt envois par heure au plus, bien sous le plafond horaire. */
/**
 * « 3 créneaux proposés », jamais « 3 créneau(x) proposé(s) » : le journal se
 * lit à l'écran (et se filme). En français, 0 et 1 restent au singulier.
 */
export const nb = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

export const CYCLE_MS = 3 * 60_000;
const LECTURE_MIN_MS = 4 * 60_000;
const ATTENTE_DROPCONTACT_MS = 30_000;
const JOUR_MS = 86_400_000;

/** Les traces qu'ALPHA laisse sur la timeline — et ce par quoi il les reconnaît. */
export const MARQUE_PREMIER = "ALPHA a écrit (premier message)";
export const MARQUE_RELANCE = "ALPHA a relancé";
export const MARQUE_REPONSE = "Réponse reçue :";

const jourDe = (d: Date) => d.toISOString().slice(0, 10);

export function journaliser(etat: EtatAutopilote, e: Omit<EntreeJournal, "le">, maintenant: Date): EtatAutopilote {
  return { ...etat, journal: [{ ...e, le: maintenant.toISOString() }, ...etat.journal].slice(0, JOURNAL_MAX) };
}

const emailsAlpha = (p: Prospect) =>
  (p.events ?? []).filter((e) => e.kind === "email" && (e.summary.startsWith(MARQUE_PREMIER) || e.summary.startsWith(MARQUE_RELANCE)));

/** Les envois d'ALPHA sur les dernières 24 h (glissantes, comme le palier serveur). */
export function envoisAlpha24h(prospects: Prospect[], maintenant: Date): number {
  const depuis = maintenant.getTime() - JOUR_MS;
  return prospects.reduce((n, p) => n + emailsAlpha(p).filter((e) => Date.parse(e.date) >= depuis).length, 0);
}

export const aRepondu = (p: Prospect) => (p.events ?? []).some((e) => e.summary.startsWith(MARQUE_REPONSE));

/** Personne ne lui a jamais écrit — ni ALPHA, ni l'humain, ni un autre outil. */
function jamaisEcrit(p: Prospect): boolean {
  return !(p.events ?? []).some((e) => e.kind === "email") && !(p.tags ?? []).includes(TAG_DEJA_ECRIT);
}

const ouverte = (p: Prospect) => p.stage !== "signe" && p.stage !== "perdu";
/** Posé quand le serveur a refusé un message construit pour cette fiche : on ne le rejoue pas en boucle. */
export const TAG_ENVOI_REFUSE = "envoi-refuse";

/** Ce que `/api/send` a répondu, vu du moteur. */
export type Envoi =
  | { ok: true }
  | { ok: false; status: number; erreur: string; attendreMs?: number; dejaContacte?: boolean };

/**
 * ─────────────────────────────────────────────────────────────────────
 * QUE FAIRE D'UN ENVOI QUI N'EST PAS PARTI ? (29/10/2026)
 *
 * ⚠⚠ Trouvé en relisant le chemin réel d'une réponse : la réponse du prospect
 * était marquée « vue » AVANT l'envoi de la nôtre. Le palier du jour atteint
 * (429), une panne réseau — et son « oui » n'était plus jamais repris. Il
 * avait dit oui, personne ne lui répondait, et le journal disait « refus
 * passager ».
 *  · `reessayer` — passager (palier, quota, serveur, réseau) : on suspend les
 *    envois, et une RÉPONSE n'est pas marquée vue — elle repassera.
 *  · `humain` — définitif sur une RÉPONSE (texte refusé, suite refusée) : il
 *    attend quelqu'un, ça remonte. Jamais avalé en silence.
 *  · `abandon` — définitif sur un premier message ou une relance : on ne le
 *    rejoue pas en boucle (`TAG_ENVOI_REFUSE`), le journal le dit.
 *  · `deja-ecrit` — premier message vers une adresse déjà écrite ailleurs.
 * ─────────────────────────────────────────────────────────────────────
 */
/**
 * Les envois sont-ils en pause (palier, quota, panne) ? Rend l'heure de reprise,
 * sinon `null`. Une seule définition : le plan et la réponse à un prospect la
 * lisent tous deux — répondre pendant une pause relançait le serveur qui
 * venait de dire d'attendre, toutes les 3 minutes.
 */
export function envoisSuspendus(etat: Pick<EtatAutopilote, "envoisSuspendusJusqua">, maintenant: Date): Date | null {
  const fin = etat.envoisSuspendusJusqua ? Date.parse(etat.envoisSuspendusJusqua) : NaN;
  return Number.isFinite(fin) && fin > maintenant.getTime() ? new Date(fin) : null;
}

function heureParis(d: Date): string {
  return d.toLocaleString("fr-FR", { timeZone: BUSINESS_TZ, weekday: "long", hour: "2-digit", minute: "2-digit" });
}

export type IssueEnvoi = "fait" | "reessayer" | "humain" | "abandon" | "deja-ecrit";

export function issueEnvoi(r: Envoi, nature: "premier" | "reponse" | "relance"): IssueEnvoi {
  if (r.ok) return "fait";
  if (r.status === 0 || r.status === 402 || r.status === 429 || r.status >= 500) return "reessayer";
  if (nature === "reponse") return "humain";
  if (r.dejaContacte && nature === "premier") return "deja-ecrit";
  return "abandon";
}

/**
 * ⚠⚠ VU AU RENDU (29/10/2026) : le premier message de l'autopilote est parti
 * vers une fiche du JEU DE DÉMONSTRATION — celui qu'un navigateur neuf reçoit.
 * Une adresse fictive, un email réel depuis SA boîte : un rebond, un palier
 * brûlé, une réputation entamée. Une fiche de démo n'est jamais contactée,
 * jamais enrichie (`isDemoProspect`, la définition du jeu lui-même).
 */
const intouchable = (p: Prospect) =>
  isDemoProspect(p.id) ||
  aRefuseTouteRelance(p) ||
  Boolean(exclusionPublique(p)) ||
  (p.tags ?? []).some((t) => t === TAG_A_TRAITER || t === TAG_ENVOI_REFUSE);

/** Prêtes à recevoir un premier message : les moments frais d'abord, puis les plus anciennes. */
export function aContacter(prospects: Prospect[], maintenant: Date): Prospect[] {
  return prospects
    .filter((p) => ouverte(p) && p.stage === "prospect" && Boolean(p.email?.trim()) && jamaisEcrit(p) && !intouchable(p))
    .map((p, i) => ({ p, i, frais: momentFrais(p, maintenant) ? 0 : 1 }))
    .sort((a, b) => a.frais - b.frais || a.p.createdAt.localeCompare(b.p.createdAt) || a.i - b.i)
    .map((x) => x.p);
}

/** Dues pour une relance (raison neuve exigée) — la plus ancienne en tête. */
export function aRelancer(prospects: Prospect[], maintenant: Date): { prospect: Prospect; numero: number }[] {
  const t = maintenant.getTime();
  const out: { prospect: Prospect; numero: number }[] = [];
  for (const p of prospects) {
    if (!ouverte(p) || intouchable(p) || !p.email?.trim()) continue;
    const alpha = emailsAlpha(p);
    if (!alpha.length) continue;
    const trente = (p.events ?? []).filter((e) => e.kind === "email" && Date.parse(e.date) >= t - 30 * JOUR_MS);
    const dernier = alpha.map((e) => e.date).sort().pop() ?? null;
    const d = relanceDue({
      nbContacts30j: trente.length,
      dernierEnvoiISO: dernier,
      aRepondu: aRepondu(p),
      raisonDisponible: raisonRelance(p, t) !== null,
      maintenant: t,
    });
    if (d.du) out.push({ prospect: p, numero: d.numero });
  }
  return out.sort((a, b) => (emailsAlpha(a.prospect).at(-1)?.date ?? "").localeCompare(emailsAlpha(b.prospect).at(-1)?.date ?? ""));
}

/** Les adresses dont on attend une réponse : écrites par ALPHA il y a moins de 60 jours. */
export function adressesSuivies(prospects: Prospect[], maintenant: Date): string[] {
  const depuis = maintenant.getTime() - 60 * JOUR_MS;
  return [
    ...new Set(
      prospects
        .filter((p) => ouverte(p) && p.email?.trim() && emailsAlpha(p).some((e) => Date.parse(e.date) >= depuis))
        .map((p) => (p.email as string).trim().toLowerCase())
    ),
  ];
}

/** Depuis quand relire : la veille de la dernière lecture, 14 jours la première fois. */
export function depuisLecture(etat: EtatAutopilote, maintenant: Date): Date {
  const derniere = etat.derniereLecture ? Date.parse(etat.derniereLecture) : NaN;
  const base = Number.isFinite(derniere) ? derniere - JOUR_MS : maintenant.getTime() - 14 * JOUR_MS;
  return new Date(Math.max(base, maintenant.getTime() - 30 * JOUR_MS));
}

/** L'identifiant d'une réponse — l'en-tête Message-ID, sinon son expéditeur et sa date. */
export const idReponse = (m: { messageId: string | null; de: string; date: string | null; sujet: string }) =>
  m.messageId ?? `${m.de}|${m.date ?? ""}|${m.sujet}`.slice(0, 200);

export const cleRecherche = (r: Pick<ReglagesAutopilote, "activites" | "zone" | "taille">) =>
  `${[...r.activites].sort().join(",")}|${r.zone.replace(/\s+/g, "")}|${r.taille}`;

export interface Capacites {
  /** Une boîte d'envoi utilisable (la sienne, ou la nôtre pour le maître). */
  boite: boolean;
  /** Une clé Dropcontact dans ce navigateur. */
  cleDropcontact: boolean;
}

export interface Plan {
  lire: boolean;
  relireEnrichissements: string[];
  lancerEnrichissement: string[];
  ecrire: string | null;
  relancer: { prospectId: string; numero: number } | null;
  chercher: { activites: string[]; zone: string; taille: TailleCible; page: number } | null;
  /** Pourquoi une étape ne tourne pas — ce que l'écran montre au lieu d'un silence. */
  attentes: string[];
}

/**
 * Le plan d'un passage. Pur : mêmes fiches, même état, même heure ⇒ même plan.
 * Une étape qui ne tourne pas dit pourquoi : « rien ne part » et « on attend
 * ta boîte » demandent deux gestes opposés.
 */
export function planifier(
  prospects: Prospect[],
  reglages: ReglagesAutopilote,
  etat: EtatAutopilote,
  capacites: Capacites,
  maintenant: Date
): Plan {
  const attentes: string[] = [];
  const plan: Plan = { lire: false, relireEnrichissements: [], lancerEnrichissement: [], ecrire: null, relancer: null, chercher: null, attentes };
  if (!reglages.actif) {
    attentes.push("L'autopilote est arrêté.");
    return plan;
  }
  const t = maintenant.getTime();
  const auj = jourDe(maintenant);

  // ── LIRE ──
  const suivies = adressesSuivies(prospects, maintenant);
  if (!capacites.boite) attentes.push("Ta boîte email n'est pas branchée : ALPHA ne peut ni écrire ni lire les réponses.");
  else if (suivies.length) {
    const derniere = etat.derniereLecture ? Date.parse(etat.derniereLecture) : 0;
    plan.lire = t - derniere >= LECTURE_MIN_MS;
  }

  // ── JOINDRE (coordonnées) ──
  plan.relireEnrichissements = etat.enrichissements.filter((e) => t - Date.parse(e.lance) >= ATTENTE_DROPCONTACT_MS).map((e) => e.requestId);
  const enAttente = new Set(etat.enrichissements.flatMap((e) => e.prospectIds));
  const aJoindre = prospects.filter((p) => aEnrichir(p) && !enAttente.has(p.id) && !intouchable(p) && ouverte(p));
  const dejaLances = etat.enrichisJour.jour === auj ? etat.enrichisJour.n : 0;
  const budget = Math.max(0, reglages.enrichissementsParJour - dejaLances);
  if (aJoindre.length) {
    if (!capacites.cleDropcontact) attentes.push(`${nb(aJoindre.length, "entreprise", "entreprises")} sans email : branche ta clé Dropcontact pour qu'ALPHA trouve leurs coordonnées.`);
    else if (!budget) attentes.push(`Budget Dropcontact du jour atteint (${reglages.enrichissementsParJour}) : reprise demain.`);
    else if (!etat.enrichissements.length) plan.lancerEnrichissement = aJoindre.slice(0, Math.min(budget, LOT_ENRICHISSEMENT)).map((p) => p.id);
  }

  // ── ÉCRIRE / RELANCER ──
  const fenetre = fenetreOuverte(maintenant);
  const suspendu = envoisSuspendus(etat, maintenant);
  const envoyes = envoisAlpha24h(prospects, maintenant);
  const prets = aContacter(prospects, maintenant);
  if (capacites.boite) {
    if (!fenetre.open) attentes.push(`Hors des heures utiles (${fenetre.label}) : ALPHA lit, il n'écrit pas.`);
    else if (suspendu) attentes.push(`Le serveur d'envoi a demandé d'attendre : reprise à ${heureParis(suspendu)}.`);
    else if (envoyes >= reglages.envoisParJour) attentes.push(`Plafond du jour atteint (${reglages.envoisParJour} envois en 24 h).`);
    else {
      const rel = aRelancer(prospects, maintenant)[0];
      if (rel) plan.relancer = { prospectId: rel.prospect.id, numero: rel.numero };
      else if (prets[0]) plan.ecrire = prets[0].id;
    }
  }

  // ── CHERCHER ──
  const reserve = prets.length + aJoindre.length + enAttente.size;
  if (reserve < RESERVE_MIN) {
    const zone = lireZone(reglages.zone);
    const activites = reglages.activites.filter(codeNafValide);
    const cherchees = etat.recherchesJour.jour === auj ? etat.recherchesJour.n : 0;
    if (!activites.length || !zone.ok) attentes.push("Dis à ALPHA quel métier et quelle zone viser : il ira chercher tout seul quand la réserve baisse.");
    else if (etat.ciblesEpuisees?.[cleRecherche(reglages)] === auj)
      attentes.push("Toutes les entreprises de cette cible sont déjà dans ton CRM : élargis la zone ou ajoute une activité. ALPHA réessaie demain.");
    else if (cherchees >= RECHERCHES_PAR_JOUR) attentes.push("Assez cherché pour aujourd'hui : reprise demain.");
    else {
      const page = (etat.pagesRegistre[cleRecherche(reglages)] ?? 0) + 1;
      plan.chercher = { activites, zone: reglages.zone, taille: reglages.taille, page };
    }
  }

  if (!plan.lire && !plan.ecrire && !plan.relancer && !plan.chercher && !plan.lancerEnrichissement.length && !plan.relireEnrichissements.length && !attentes.length) {
    attentes.push("Rien à faire à ce passage : tout ce qui pouvait partir est parti.");
  }
  return plan;
}

/**
 * Le premier message — le MÊME que celui que l'écran prépare pour un envoi
 * relu (`emailBody`), plus la divulgation IA : ici personne ne relit, donc
 * l'assistant le dit (art. 50). Une seule rédaction du premier message dans
 * le produit, sinon l'autopilote finirait par dire autre chose que l'écran.
 */
/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI PARLE DANS LES MESSAGES DU PILOTE — sur « ce que tu vends », maître
 * compris (29/10/2026).
 *
 * ⚠⚠ Trouvé en voulant faire vendre Alpha par Alpha : l'écran du pilote exige
 * « Ce que tu vends » de TOUT LE MONDE (`preRequis`, ligne « offre »), mais sur
 * le compte MAÎTRE l'expéditeur restait `null` (`useExpediteurInscrit`), donc
 * le message suivait l'escalier de NOS offres. Mesuré : à une agence
 * immobilière, le pilote proposait « un audit de votre accueil téléphonique »
 * pendant que l'écran affichait « Alpha Sales OS » comme offre. L'écran disait
 * une chose, la boîte en envoyait une autre.
 *
 * Un inscrit garde son expéditeur tel quel. Le maître parle sur son profil dès
 * qu'il l'a rempli ; vide, rien ne change (l'escalier, comme avant).
 * ─────────────────────────────────────────────────────────────────────
 */
export function expediteurDuPilote(o: {
  inscrit: ExpediteurInscrit | null;
  profil: ExpediteurInscrit["profil"];
  agencyName: string;
  city: string;
}): ExpediteurInscrit | null {
  if (o.inscrit) return o.inscrit;
  return o.profil?.metier?.trim() ? { profil: o.profil, agencyName: o.agencyName, city: o.city } : null;
}

export function premierMessage(
  p: Prospect,
  s: { accountId?: string; closerName?: string; agencyName?: string; bookingUrl?: string },
  inscrit: ExpediteurInscrit | null
): { subject: string; body: string } {
  return {
    subject: emailSubject(p, s.accountId, inscrit),
    body: [
      // Il part par `/api/send`, dont le rendu signe et pose le pied « STOP ».
      emailBody(p, { accountId: s.accountId, inscrit, closerName: s.closerName, agencyName: s.agencyName, bookingUrl: s.bookingUrl, pied: "rendu" }),
      "",
      DIVULGATION_ECRITE,
    ].join("\n"),
  };
}

export interface PreRequis {
  id: "offre" | "cible" | "cle" | "boite" | "rdv";
  ok: boolean;
  libelle: string;
  /** Ce qui manque, et le geste qui le règle. */
  manque: string;
}

/**
 * Ce qu'il faut pour que la chaîne tourne en entier — et ce que chaque manque
 * coupe. Aucun n'empêche de LANCER : sans boîte, ALPHA cherche et trouve déjà
 * les coordonnées ; sans clé, il écrit à ceux qui en ont. Le dire vaut mieux
 * que bloquer, et `planifier` répète chaque manque à l'endroit où il coupe.
 */
export function preRequis(o: {
  metier: string;
  reglages: Pick<ReglagesAutopilote, "activites" | "zone">;
  boite: boolean;
  cleDropcontact: boolean;
  bookingUrl?: string;
}): PreRequis[] {
  const zone = lireZone(o.reglages.zone);
  const activites = o.reglages.activites.filter(codeNafValide);
  return [
    {
      id: "offre",
      ok: Boolean(o.metier.trim()),
      libelle: "Ce que tu vends",
      manque: "Sans elle, ALPHA ne sait pas répondre à une question : il te la renvoie. Réglages → À qui vends-tu ?",
    },
    {
      id: "cible",
      ok: activites.length > 0 && zone.ok,
      libelle: "Le métier et la zone de tes clients",
      manque: zone.ok || !o.reglages.zone.trim() ? "Choisis au moins une activité et une zone (département ou codes postaux)." : zone.raison,
    },
    {
      id: "cle",
      ok: o.cleDropcontact,
      libelle: "Ta clé Dropcontact",
      manque: "Le registre ne donne ni email ni téléphone. Sans clé, ALPHA trouve les entreprises mais ne peut pas les joindre.",
    },
    {
      id: "boite",
      ok: o.boite,
      libelle: "Ta boîte email",
      manque: "ALPHA écrit et lit les réponses depuis TA boîte. Connecte-toi, puis Réglages → Boîte d'envoi (adresse + mot de passe d'application).",
    },
    {
      id: "rdv",
      ok: true,
      libelle: "Tes rendez-vous",
      manque: o.bookingUrl?.trim() ? "" : "ALPHA propose trois créneaux dans tes heures ouvrées. Un lien de réservation (Réglages) servira de sortie.",
    },
  ];
}
