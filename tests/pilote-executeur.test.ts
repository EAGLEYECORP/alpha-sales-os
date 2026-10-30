import test from "node:test";
import assert from "node:assert/strict";
import { prospectDefaults } from "../lib/seed";
import type { Meeting, Prospect, TimelineEvent } from "../lib/types";
import { passagePilote, type PortesPilote, type RecuDeLecture } from "../lib/pilote-executeur";
import { ETAT_AUTOPILOTE_VIDE, REGLAGES_AUTOPILOTE_DEFAUT, type Envoi, type EtatAutopilote, type ReglagesAutopilote } from "../lib/autopilote-inscrit";
import type { MailSortant } from "../lib/reponses-inscrit";
import type { SuiteConversation } from "../lib/relance-mail";
import type { MessageLu } from "../lib/mime-lecture";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'EXÉCUTEUR DU PILOTE, joué sur de FAUSSES PORTES en mémoire.
 *
 * Jusqu'au 30/10/2026 la boucle vivait dans un composant React : elle ne se
 * prouvait qu'au rendu, navigateur compris. Sortie dans `lib/pilote-executeur.ts`
 * pour tourner AUSSI sur le serveur (onglet fermé), elle se teste enfin comme
 * une fonction — et ce test vaut pour les deux lieux, puisqu'ils jouent les
 * mêmes étapes.
 * ─────────────────────────────────────────────────────────────────────
 */

const MARDI_10H = new Date("2026-11-03T09:00:00Z"); // 10 h à Paris, fenêtre ouverte

interface Monde {
  prospects: Prospect[];
  meetings: Meeting[];
  etat: EtatAutopilote;
  envois: { to?: string; mail: MailSortant; suite?: SuiteConversation; copie?: boolean }[];
  reponses: MessageLu[];
  repondreEnvoi: (n: number) => Envoi;
}

function monde(fiches: Partial<Prospect>[]): { m: Monde; pp: PortesPilote } {
  const m: Monde = {
    prospects: fiches.map(
      (o, i) =>
        ({
          ...prospectDefaults,
          id: `p-${i}`,
          name: "Camille Démo",
          company: `AGENCE ${i} (DÉMO)`,
          sector: "autre",
          city: "Lyon",
          stage: "prospect",
          tags: ["registre"],
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
          ...o,
        }) as Prospect,
    ),
    meetings: [],
    etat: { ...ETAT_AUTOPILOTE_VIDE },
    envois: [],
    reponses: [],
    repondreEnvoi: () => ({ ok: true }),
  };
  const reglages: ReglagesAutopilote = { ...REGLAGES_AUTOPILOTE_DEFAUT, actif: true, activites: [], zone: "" };
  let n = 0;
  const pp: PortesPilote = {
    maintenant: () => MARDI_10H,
    uid: () => `id-${++n}`,
    prospects: () => m.prospects,
    meetings: () => m.meetings,
    reglages: () => reglages,
    etat: () => m.etat,
    majEtat: (f) => {
      m.etat = f(m.etat);
    },
    patchProspect: (id, patch) => {
      m.prospects = m.prospects.map((p) => (p.id === id ? { ...p, ...patch } : p));
    },
    addEvent: (id, ev: Omit<TimelineEvent, "id">) => {
      m.prospects = m.prospects.map((p) => (p.id === id ? { ...p, events: [{ ...ev, id: `e-${++n}` }, ...p.events] } : p));
    },
    upsertMeeting: (r) => {
      m.meetings = [...m.meetings.filter((x) => x.id !== r.id), r];
    },
    importer: (f) => {
      m.prospects = [...m.prospects, ...f];
      return { added: f.length };
    },
    expediteur: () => ({ accountId: "eagleye", closerName: "", agencyName: "EAGLEYE CORP" }),
    inscrit: () => ({ profil: pp.profil(), agencyName: "EAGLEYE CORP", city: "Lyon" }),
    profil: () => ({ poste: "dirigeant", metier: "un OS de vente qui trouve vos clients et pose vos rendez-vous", cibleSecteur: "agences immobilières", cibleRole: "dirigeants", cibleZone: "Rhône" }),
    closing: () => ({ prix: "En ligne, ALPHA est gratuit ; installé chez vous, sur devis.", lienSignature: "https://alpha.example.com/compte" }),
    cleDropcontact: () => "",
    envoyer: async (p, mail, suite, copie) => {
      m.envois.push({ to: p.email, mail, suite, copie });
      return m.repondreEnvoi(m.envois.length);
    },
    lireReponses: async (): Promise<RecuDeLecture> => ({ etat: "lu", messages: m.reponses }),
    agenda: async () => ({ etat: "absent" }),
    fetch: async () => {
      throw new Error("réseau non simulé");
    },
  };
  return { m, pp };
}

const lu = (texte: string, sujet = "Re: une question"): MessageLu => ({
  de: "camille@agence.example.com",
  date: MARDI_10H.toISOString(),
  sujet,
  messageId: `<${texte.length}-${sujet.length}@x>`,
  inReplyTo: null,
  autoReponse: false,
  texte,
});

test("premier passage : UN premier message, autonome, à la fiche prête — puis la fiche attend sa réponse", async () => {
  const { m, pp } = monde([{ email: "camille@agence.example.com" }]);
  const plan = await passagePilote(pp, { boite: true });
  assert.equal(plan.ecrire, "p-0");
  assert.equal(m.envois.length, 1);
  assert.equal(m.envois[0].suite, undefined, "un premier message n'est pas une suite");
  assert.equal(m.prospects[0].stage, "contact");
  assert.ok(m.etat.journal.some((j) => j.type === "ecrit"));
});

test("sans boîte, rien ne part — et l'attente se dit", async () => {
  const { m, pp } = monde([{ email: "camille@agence.example.com" }]);
  const plan = await passagePilote(pp, { boite: false });
  assert.equal(m.envois.length, 0);
  assert.ok(plan.attentes.some((a) => /boîte/.test(a)));
});

test("⚠⚠ « oui » → trois créneaux numérotés, en SUITE de conversation ; « 2 » → le rendez-vous, invitation + copie à l'expéditeur", async () => {
  const { m, pp } = monde([{ email: "camille@agence.example.com" }]);
  await passagePilote(pp, { boite: true }); // premier message
  m.reponses = [lu("Oui, avec plaisir.")];
  m.etat = { ...m.etat, derniereLecture: undefined };
  await passagePilote(pp, { boite: true });
  const creneaux = m.envois[1];
  assert.equal(creneaux.suite, "reponse");
  assert.match(creneaux.mail.body, /^1\. /m);
  assert.equal(m.prospects[0].rdvPropose?.creneaux.length, 3);

  m.reponses = [lu("2, parfait.", "Re: Re: une question")];
  m.etat = { ...m.etat, derniereLecture: undefined };
  await passagePilote(pp, { boite: true });
  const conf = m.envois[2];
  assert.equal(conf.copie, true, "l'invitation arrive aussi dans SA boîte");
  assert.equal(conf.mail.attachments?.[0].filename, "rendez-vous.ics");
  assert.equal(m.meetings.length, 1);
  assert.equal(m.prospects[0].stage, "demo");
});

test("⚠⚠ « c'est combien ? » → le prix DÉCLARÉ et le lien, sans humain", async () => {
  const { m, pp } = monde([{ email: "camille@agence.example.com" }]);
  await passagePilote(pp, { boite: true });
  m.reponses = [lu("Bonjour, c'est combien ?")];
  m.etat = { ...m.etat, derniereLecture: undefined };
  await passagePilote(pp, { boite: true });
  assert.match(m.envois[1].mail.body, /installé chez vous/);
  assert.match(m.envois[1].mail.body, /https:\/\/alpha\.example\.com\/compte/);
});

test("⚠⚠ un refus PASSAGER du palier (429) : la réponse n'est PAS consignée (elle repassera), les envois sont suspendus", async () => {
  const { m, pp } = monde([{ email: "camille@agence.example.com" }]);
  await passagePilote(pp, { boite: true });
  m.repondreEnvoi = () => ({ ok: false, status: 429, erreur: "palier du jour atteint", attendreMs: 3_600_000 });
  m.reponses = [lu("Oui, avec plaisir.")];
  m.etat = { ...m.etat, derniereLecture: undefined };
  await passagePilote(pp, { boite: true });
  assert.equal(m.etat.reponsesVues.length, 0, "marquée vue, elle serait perdue pour toujours");
  assert.ok(m.etat.envoisSuspendusJusqua);
});

test("arrêté : rien ne tourne, pas même la lecture", async () => {
  const { m, pp } = monde([{ email: "camille@agence.example.com" }]);
  const r = pp.reglages();
  pp.reglages = () => ({ ...r, actif: false });
  await passagePilote(pp, { boite: true });
  assert.equal(m.envois.length, 0);
});
