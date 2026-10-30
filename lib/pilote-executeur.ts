import type { Meeting, Prospect, TimelineEvent } from "./types";
import type { ProfilOperateur } from "./profil-operateur";
import type { ExpediteurInscrit } from "./approche-ecrite";
import { plageQuiGene, type EtatAgenda } from "./agenda-occupe";
import { lireLot } from "./signaux-publics";
import { fenetreOuverte } from "./conformite";
import { prochainsCreneaux, labelCreneau } from "./creneaux-rdv";
import { meetingToIcs } from "./ics";
import { construireRelanceMail, raisonRelance, type SuiteConversation } from "./relance-mail";
import { TAG_DEJA_ECRIT } from "./mail-autopilote";
import { chercherEntreprises, croiserAnnonces, entrepriseVersProspect } from "./trouver-clients";
import { associerContacts, demandeDepuisFiche, lancerEnrichissement, lireEnrichissement, patchDepuisContact, resumeEnrichissement } from "./enrichissement";
import {
  TAG_A_TRAITER,
  closingPret,
  confirmationRdv,
  deciderReponse,
  envoiLienSignature,
  introRenseignement,
  propositionCreneaux,
  rdvChoisi,
  reponsePrix,
  type ClosingDeclare,
  type MailSortant,
} from "./reponses-inscrit";
import type { MessageLu } from "./mime-lecture";
import {
  MARQUE_PREMIER,
  MARQUE_RELANCE,
  REPONSES_VUES_MAX,
  TAG_ENVOI_REFUSE,
  adressesSuivies,
  cleRecherche,
  depuisLecture,
  envoisSuspendus,
  idReponse,
  issueEnvoi,
  journaliser,
  nb,
  planifier,
  premierMessage,
  type EntreeJournal,
  type Envoi,
  type EtatAutopilote,
  type Plan,
  type ReglagesAutopilote,
} from "./autopilote-inscrit";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'EXÉCUTEUR DU PILOTE — ce qu'ALPHA FAIT à chaque passage, une seule fois
 * écrit, quel que soit l'endroit où il tourne.
 *
 * Décision de Zakaria (30/10/2026) : « ALPHA vend ALPHA » doit tourner dans le
 * cloud, onglet fermé, sans n8n. Le pilote existait — DANS le navigateur
 * (`components/autopilote/moteur-autopilote.tsx`). Réécrire sa boucle côté
 * serveur aurait fait DEUX définitions de « ce qu'ALPHA fait d'un oui, d'un
 * prix, d'un créneau » : la panne la plus fréquente de ce dépôt. Elle vit donc
 * ici, et chaque lieu ne fournit que ses PORTES (où sont les fiches, comment un
 * message part, comment on lit la boîte et l'agenda).
 *
 * ⚠ Les règles ne bougent pas : `planifier` décide, `deciderReponse` classe,
 * `issueEnvoi` tranche un refus — ce module n'en contient aucune de plus. Il a
 * été TRANSPOSÉ du moteur du navigateur ligne à ligne ; les commentaires qui
 * expliquent chaque garde y ont été gardés.
 *
 * ⚠ Les portes lisent l'état FRAIS à chaque appel : une fiche importée à
 * l'étape « chercher » doit être vue par l'étape suivante.
 * ─────────────────────────────────────────────────────────────────────
 */

export type RecuDeLecture = { etat?: string; raison?: string; messages?: MessageLu[] };

export interface PortesPilote {
  maintenant(): Date;
  uid(): string;
  /** Fiches et rendez-vous, FRAIS à chaque appel. */
  prospects(): Prospect[];
  meetings(): Meeting[];
  reglages(): ReglagesAutopilote;
  etat(): EtatAutopilote;
  majEtat(f: (e: EtatAutopilote) => EtatAutopilote): void;
  patchProspect(id: string, patch: Partial<Prospect>): void;
  addEvent(id: string, ev: Omit<TimelineEvent, "id">): void;
  upsertMeeting(m: Meeting): void;
  /** Importer des fiches neuves ; `refus` quand le stockage ne peut plus les tenir. */
  importer(fiches: Prospect[]): { added: number } | { refus: string };
  /** Qui écrit, pour les réponses (signature, lien de RDV). */
  expediteur(): { accountId?: string; closerName: string; agencyName: string; bookingUrl?: string };
  /** Le profil qui parle — celui de l'inscrit, ou du maître qui l'a rempli (`expediteurDuPilote`). */
  inscrit(): ExpediteurInscrit | null;
  profil(): ProfilOperateur | null | undefined;
  closing(): ClosingDeclare | null | undefined;
  cleDropcontact(): string;
  envoyer(p: Prospect, mail: MailSortant, suite?: SuiteConversation, copieExpediteur?: boolean): Promise<Envoi>;
  lireReponses(q: { adresses: string[]; depuis: string; imapHost?: string }): Promise<RecuDeLecture>;
  agenda(): Promise<EtatAgenda>;
  /** Le réseau pour le registre, les annonces légales et Dropcontact. */
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

const fiche = (pp: PortesPilote, id: string) => pp.prospects().find((p) => p.id === id);
const noter = (pp: PortesPilote, e: Omit<EntreeJournal, "le">) => pp.majEtat((etat) => journaliser(etat, e, pp.maintenant()));

/** Un envoi qui n'est pas parti : `issueEnvoi` décide, ce code n'applique que sa décision. */
function subirRefus(pp: PortesPilote, p: Prospect, r: Exclude<Envoi, { ok: true }>, nature: "premier" | "reponse" | "relance") {
  const tags = fiche(pp, p.id)?.tags ?? p.tags ?? [];
  const now = pp.maintenant();
  switch (issueEnvoi(r, nature)) {
    case "deja-ecrit":
      pp.patchProspect(p.id, { tags: [...new Set([...tags, TAG_DEJA_ECRIT])] });
      return noter(pp, { type: "pause", texte: `${p.company} : déjà contacté récemment, ALPHA ne le réécrit pas.`, prospectId: p.id });
    case "reessayer": {
      const attendre = r.attendreMs ?? (r.status === 402 ? 12 * 3_600_000 : 15 * 60_000);
      return pp.majEtat((e) => journaliser({ ...e, envoisSuspendusJusqua: new Date(now.getTime() + attendre).toISOString() }, { type: "pause", texte: `Envois suspendus : ${r.erreur}` }, now));
    }
    case "humain":
      pp.patchProspect(p.id, {
        tags: [...new Set([...tags, TAG_A_TRAITER])],
        nextStep: { date: now.toISOString().slice(0, 10), action: "Lui répondre toi-même : ALPHA n'a pas pu envoyer sa réponse" },
      });
      return noter(pp, { type: "escalade", texte: `${p.company} attend une réponse qu'ALPHA n'a pas pu envoyer (${r.erreur}) : à toi.`, prospectId: p.id });
    default:
      // Définitif sur un message construit par ALPHA : on ne le rejoue pas en boucle.
      pp.patchProspect(p.id, { tags: [...new Set([...tags, TAG_ENVOI_REFUSE])] });
      return noter(pp, { type: "erreur", texte: `Message refusé pour ${p.company} : ${r.erreur}`, prospectId: p.id });
  }
}

// ══════════ LES ÉTAPES ══════════

async function lire(pp: PortesPilote) {
  const maintenant = pp.maintenant();
  const etat = pp.etat();
  const adresses = adressesSuivies(pp.prospects(), maintenant);
  let rep: RecuDeLecture;
  try {
    rep = await pp.lireReponses({ adresses, depuis: depuisLecture(etat, maintenant).toISOString(), imapHost: pp.reglages().imapHost });
  } catch {
    rep = { etat: "non-lu", raison: "réseau indisponible" };
  }
  if (rep.etat !== "lu" || !Array.isArray(rep.messages)) {
    const texte = `Réponses non lues : ${rep.raison ?? "réponse illisible"}`;
    // On ne remplit pas le journal de la même panne toutes les quatre minutes.
    if (pp.etat().journal[0]?.texte !== texte) noter(pp, { type: "erreur", texte });
    pp.majEtat((e) => ({ ...e, derniereLecture: maintenant.toISOString() }));
    return;
  }
  const vues = new Set(etat.reponsesVues);
  const nouvelles = rep.messages.filter((m) => !vues.has(idReponse(m))).reverse();
  for (const m of nouvelles) await traiterReponse(pp, m);
  pp.majEtat((e) => ({ ...e, derniereLecture: maintenant.toISOString() }));
}

async function traiterReponse(pp: PortesPilote, m: MessageLu) {
  const maintenant = pp.maintenant();
  const p = pp.prospects().find((x) => x.email?.trim().toLowerCase() === m.de);
  const id = idReponse(m);
  const vu = () => pp.majEtat((e) => ({ ...e, reponsesVues: [id, ...e.reponsesVues].slice(0, REPONSES_VUES_MAX) }));
  if (!p) return vu();
  const profil = pp.inscrit() !== null ? pp.profil() : null;
  const d = deciderReponse(p, m, profil, maintenant, pp.closing());
  // Répondre hors des heures utiles, ou pendant une pause d'envoi, attendra le
  // passage suivant : on NE marque PAS la réponse comme traitée, sinon elle ne
  // serait jamais reprise.
  if (d.repondre && (!fenetreOuverte(maintenant).open || envoisSuspendus(pp.etat(), maintenant))) return;

  // ⚠⚠ Consigner la réponse REÇUE (événement, étape, « vue ») n'a lieu que
  // quand on sait qu'elle ne repassera pas : notre réponse est partie, ou
  // l'humain a pris le relais. Marquée vue AVANT l'envoi, un refus passager
  // (palier, réseau) faisait perdre un « oui » pour toujours.
  const consigner = () => {
    pp.patchProspect(p.id, d.patch);
    pp.addEvent(p.id, { date: m.date ?? maintenant.toISOString(), kind: "email", summary: d.evenement });
    vu();
  };
  const repondre = async (mail: MailSortant, copieExpediteur = false): Promise<boolean> => {
    const r = await pp.envoyer(fiche(pp, p.id) ?? p, mail, "reponse", copieExpediteur);
    if (r.ok) {
      consigner();
      return true;
    }
    if (issueEnvoi(r, "reponse") !== "reessayer") consigner();
    subirRefus(pp, p, r, "reponse");
    return false;
  };

  if (d.escalade || !d.repondre) {
    consigner();
    if (d.escalade) return noter(pp, { type: "escalade", texte: `${p.company} : ${d.escalade}`, prospectId: p.id });
    if (d.classement.intention === "refus") return noter(pp, { type: "lit", texte: `${p.company} refuse : retiré, plus aucun message.`, prospectId: p.id });
    return;
  }

  // ── LE CLOSING : le prix déclaré, ou le lien pour signer (`closingPret`). ──
  if (d.repondre === "prix" || d.repondre === "signer") {
    const c = closingPret(pp.closing());
    const mail = d.repondre === "prix" && c.prix ? reponsePrix(p, { prix: c.prix, lien: c.lien }, m.sujet) : c.lien ? envoiLienSignature(p, c.lien, m.sujet) : null;
    // Le closing a changé entre la décision et l'envoi : on ne devine pas, on remonte.
    if (!mail) {
      consigner();
      return noter(pp, { type: "escalade", texte: `${p.company} : ${d.classement.motif}`, prospectId: p.id });
    }
    if (!(await repondre(mail))) return;
    const quoi = d.repondre === "prix" ? (c.lien ? "le prix et le lien pour démarrer" : "le prix") : "le lien pour signer";
    pp.addEvent(p.id, { date: maintenant.toISOString(), kind: "email", summary: `ALPHA a répondu : ${quoi}.` });
    return noter(pp, { type: "repond", texte: `${p.company} : ${quoi} envoyé${d.repondre === "signer" ? " — vérifie l'encaissement" : ""}.`, prospectId: p.id });
  }

  const exp = pp.expediteur();
  const reglages = pp.reglages();
  const dureeMs = reglages.dureeRdvMin * 60_000;
  const agenda = await pp.agenda();
  const aToi = (action: string, texte: string) => {
    consigner();
    pp.patchProspect(p.id, { tags: [...new Set([...(fiche(pp, p.id)?.tags ?? []), TAG_A_TRAITER])], nextStep: { date: maintenant.toISOString().slice(0, 10), action } });
    noter(pp, { type: "escalade", texte, prospectId: p.id });
  };

  if (d.repondre === "confirmer") {
    const proposes = (p.rdvPropose?.creneaux ?? []).map((c) => new Date(c));
    const creneau = proposes[d.classement.creneau ?? -1];
    const pris = pp.meetings().some((x) => !x.done && Math.abs(Date.parse(x.date) - (creneau?.getTime() ?? 0)) < 3 * 3_600_000);
    // ⚠ Relu au moment de CONFIRMER : il a pu poser autre chose sur ce créneau
    // depuis qu'on l'a proposé. Agenda illisible ici : on confirme quand même —
    // le créneau était libre quand on l'a proposé, et le prospect s'est engagé.
    const pris2 = agenda.etat === "lu" && creneau ? plageQuiGene(creneau.getTime(), dureeMs, agenda.plages, 0) !== null : false;
    if (pris2 && creneau) {
      return aToi("Caler un autre créneau (le choisi est pris dans ton agenda)", `${p.company} a choisi ${labelCreneau(creneau)}, mais ton agenda est pris à cette heure : à toi de recaler.`);
    }
    if (!creneau || creneau.getTime() <= maintenant.getTime() || pris) {
      consigner();
      pp.patchProspect(p.id, { tags: [...new Set([...(fiche(pp, p.id)?.tags ?? []), TAG_A_TRAITER])], nextStep: { date: maintenant.toISOString().slice(0, 10), action: "Caler un autre créneau (le choisi n'est plus libre)" } });
      return noter(pp, { type: "escalade", texte: `${p.company} a choisi un créneau qui n'est plus libre : à toi de recaler.`, prospectId: p.id });
    }
    const rdv = rdvChoisi(p, creneau, reglages.canalRdv, reglages.dureeRdvMin, pp.uid());
    // Copie cachée à l'expéditeur : l'invitation arrive aussi dans SA boîte, donc dans son agenda.
    if (!(await repondre(confirmationRdv(p, creneau, rdv.channel, exp, m.sujet, meetingToIcs(rdv, p)), true))) return;
    pp.upsertMeeting(rdv);
    pp.patchProspect(p.id, { stage: "demo", rdvPropose: undefined, nextStep: { date: creneau.toISOString().slice(0, 10), action: `Rendez-vous : ${labelCreneau(creneau)}` } });
    pp.addEvent(p.id, { date: maintenant.toISOString(), kind: "meeting", summary: `Rendez-vous posé par ALPHA : ${labelCreneau(creneau)} (invitation envoyée, copie dans ta boîte).` });
    const relu = agenda.etat === "non-lu" ? " Ton agenda n'a pas pu être relu au moment de confirmer : vérifie qu'il est libre." : "";
    return noter(pp, { type: "rdv", texte: `Rendez-vous avec ${p.company} : ${labelCreneau(creneau)}. L'invitation est aussi dans ta boîte.${relu}`, prospectId: p.id });
  }

  // ⚠⚠ On ne propose JAMAIS de créneau à l'aveugle : un agenda branché mais
  // illisible remonte à l'humain. Proposer une heure prise, c'est écrire au
  // prospect le lendemain « finalement, je ne peux pas ».
  if (agenda.etat === "non-lu") {
    return aToi("Lui proposer des créneaux toi-même (ton agenda n'a pas pu être lu)", `${p.company} est intéressé, mais ton agenda n'a pas pu être lu (${agenda.raison}) : ALPHA ne propose pas d'heure à l'aveugle. À toi.`);
  }
  // Trois créneaux libres : hors de ses rendez-vous posés ET de son agenda.
  const creneaux = prochainsCreneaux(maintenant, {
    n: 3,
    occupes: pp.meetings().filter((x) => !x.done).map((x) => new Date(x.date)),
    indisponibles: agenda.etat === "lu" ? agenda.plages : [],
    dureeMs,
  });
  if (!creneaux.length) {
    return aToi("Lui proposer des créneaux toi-même (aucun libre trouvé)", `${p.company} est intéressé, mais ALPHA ne trouve aucun créneau libre dans ton agenda : à toi.`);
  }
  const intro = d.repondre === "renseignement" ? introRenseignement(profil, creneaux.length) ?? undefined : undefined;
  if (!(await repondre(propositionCreneaux(p, creneaux, exp, m.sujet, intro)))) return;
  pp.patchProspect(p.id, { rdvPropose: { creneaux: creneaux.map((c) => c.toISOString()), le: maintenant.toISOString() } });
  const libres = agenda.etat === "lu" ? ", libres dans ton agenda" : "";
  pp.addEvent(p.id, { date: maintenant.toISOString(), kind: "email", summary: `ALPHA a répondu : ${nb(creneaux.length, "créneau proposé", "créneaux proposés")}${libres}.` });
  noter(pp, { type: "repond", texte: `${p.company} est intéressé : ${nb(creneaux.length, "créneau proposé", "créneaux proposés")}${libres}.`, prospectId: p.id });
}

async function relireEnrichissements(pp: PortesPilote, requestIds: string[], cle: string) {
  for (const requestId of requestIds) {
    const r = await lireEnrichissement(requestId, cle, (u, i) => pp.fetch(u, i));
    if (r.etat === "en-cours") continue;
    const lot = pp.etat().enrichissements.find((e) => e.requestId === requestId);
    pp.majEtat((e) => ({ ...e, enrichissements: e.enrichissements.filter((x) => x.requestId !== requestId) }));
    if (!lot) continue;
    if (r.etat === "non-lu") {
      noter(pp, { type: "erreur", texte: `Coordonnées non lues : ${r.raison}` });
      continue;
    }
    let trouves = 0;
    const lotFiches = lot.prospectIds.map((id) => ({ id, siren: fiche(pp, id)?.siren }));
    associerContacts(lotFiches, r.contacts).forEach(({ id, contact: c }) => {
      const p = fiche(pp, id);
      if (!p) return;
      const patch = patchDepuisContact(p, c);
      if (patch.email || patch.phone) trouves++;
      pp.patchProspect(id, patch);
      pp.addEvent(id, { date: pp.maintenant().toISOString(), kind: "note", summary: resumeEnrichissement(c) });
    });
    noter(pp, { type: "enrichit", texte: `Coordonnées trouvées pour ${nb(trouves, "entreprise", "entreprises")} sur ${lot.prospectIds.length}${r.credits !== null ? ` · ${r.credits} crédits Dropcontact restants` : ""}.` });
  }
}

async function lancerEnrichissements(pp: PortesPilote, ids: string[], cle: string) {
  const fiches = ids.map((id) => fiche(pp, id)).filter((p): p is Prospect => Boolean(p));
  const demandes = fiches.map((p) => demandeDepuisFiche(p)).filter((d): d is NonNullable<typeof d> => d !== null);
  if (demandes.length !== fiches.length) return;
  const r = await lancerEnrichissement(demandes, cle, (u, i) => pp.fetch(u, i));
  if (r.etat !== "lance") return noter(pp, { type: "erreur", texte: `Recherche de coordonnées impossible : ${r.raison}` });
  const now = pp.maintenant();
  const jour = now.toISOString().slice(0, 10);
  pp.majEtat((e) => ({
    ...e,
    enrichissements: [...e.enrichissements, { requestId: r.requestId, prospectIds: fiches.map((p) => p.id), lance: now.toISOString() }],
    enrichisJour: { jour, n: (e.enrichisJour.jour === jour ? e.enrichisJour.n : 0) + fiches.length },
  }));
  noter(pp, { type: "enrichit", texte: `Recherche des coordonnées de ${nb(fiches.length, "entreprise", "entreprises")} lancée chez Dropcontact.` });
}

async function ecrire(pp: PortesPilote, id: string) {
  const p = fiche(pp, id);
  if (!p) return;
  const mail = premierMessage(p, pp.expediteur(), pp.inscrit());
  const r = await pp.envoyer(p, mail);
  if (!r.ok) return subirRefus(pp, p, r, "premier");
  const now = pp.maintenant();
  pp.addEvent(p.id, { date: now.toISOString(), kind: "email", summary: `${MARQUE_PREMIER} : ${mail.subject}` });
  pp.patchProspect(p.id, { stage: "contact", nextStep: { date: new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10), action: "ALPHA attend sa réponse" } });
  noter(pp, { type: "ecrit", texte: `Premier message envoyé à ${p.company}.`, prospectId: p.id });
}

async function relancer(pp: PortesPilote, id: string, numero: number) {
  const p = fiche(pp, id);
  if (!p) return;
  const raison = raisonRelance(p, pp.maintenant().getTime());
  if (!raison) return;
  const mail = construireRelanceMail(p, raison);
  const r = await pp.envoyer(p, mail, "relance");
  if (!r.ok) return subirRefus(pp, p, r, "relance");
  pp.addEvent(p.id, { date: pp.maintenant().toISOString(), kind: "email", summary: `${MARQUE_RELANCE} (n°${numero}) : ${raison.fait}` });
  noter(pp, { type: "relance", texte: `Relance n°${numero} envoyée à ${p.company} (${raison.fait}).`, prospectId: p.id });
}

async function chercher(pp: PortesPilote, c: NonNullable<Plan["chercher"]>) {
  const connus = new Set(pp.prospects().map((p) => p.siren).filter((x): x is string => Boolean(x)));
  const r = await chercherEntreprises({ activites: c.activites, zone: c.zone, taille: c.taille }, c.page, (u, i) => pp.fetch(u, i), connus);
  const now = pp.maintenant();
  const jour = now.toISOString().slice(0, 10);
  pp.majEtat((e) => ({ ...e, recherchesJour: { jour, n: (e.recherchesJour.jour === jour ? e.recherchesJour.n : 0) + 1 } }));
  if (r.etat !== "lu") return noter(pp, { type: "erreur", texte: `Registre non lu : ${r.raison}` });
  const annonces = await lireLot(r.lecture.entreprises.map((e) => e.siren), (u, i) => pp.fetch(u, i));
  const x = croiserAnnonces(r.lecture.entreprises, annonces);
  const fiches = x.retenues.map((y) => entrepriseVersProspect(y.entreprise, now, y.annonces));
  const import_ = fiches.length ? pp.importer(fiches) : { added: 0 };
  if ("refus" in import_) return noter(pp, { type: "pause", texte: import_.refus });
  // Dernière page atteinte : la cible est épuisée POUR AUJOURD'HUI. Demain on
  // repart du début — de nouvelles entreprises s'inscrivent chaque jour.
  const epuisee = r.lecture.page >= r.lecture.pages;
  const cle = cleRecherche(pp.reglages());
  pp.majEtat((e) => ({
    ...e,
    pagesRegistre: { ...e.pagesRegistre, [cle]: epuisee ? 0 : r.lecture.page },
    ciblesEpuisees: epuisee ? { ...(e.ciblesEpuisees ?? {}), [cle]: jour } : e.ciblesEpuisees,
  }));
  noter(pp, {
    type: "cherche",
    texte: `Registre, page ${r.lecture.page} : ${nb(import_.added, "entreprise ajoutée", "entreprises ajoutées")}${x.exclues.length ? `, ${nb(x.exclues.length, "écartée", "écartées")} par une annonce légale` : ""}.`,
  });
}

/**
 * Un passage : planifier, puis exécuter dans l'ordre (lire → coordonnées →
 * relance ou premier message → chercher). Rend le plan joué, pour que
 * l'appelant puisse dire ce qui a tourné et ce qui attend.
 */
export async function passagePilote(pp: PortesPilote, capacites: { boite: boolean }): Promise<Plan> {
  const reglages = pp.reglages();
  const cle = pp.cleDropcontact();
  const plan = planifier(pp.prospects(), reglages, pp.etat(), { boite: capacites.boite, cleDropcontact: Boolean(cle) }, pp.maintenant());
  if (!reglages.actif) return plan;
  try {
    if (plan.lire) await lire(pp);
    if (plan.relireEnrichissements.length && cle) await relireEnrichissements(pp, plan.relireEnrichissements, cle);
    if (plan.lancerEnrichissement.length && cle) await lancerEnrichissements(pp, plan.lancerEnrichissement, cle);
    if (plan.relancer) await relancer(pp, plan.relancer.prospectId, plan.relancer.numero);
    else if (plan.ecrire) await ecrire(pp, plan.ecrire);
    if (plan.chercher) await chercher(pp, plan.chercher);
  } catch (e) {
    noter(pp, { type: "erreur", texte: `Passage interrompu : ${e instanceof Error ? e.message.slice(0, 160) : "erreur"}` });
  }
  return plan;
}
