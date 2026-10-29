import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";
import { decoderEntete, lireMessage, sansHistorique } from "../lib/mime-lecture";
import { decouper, lireReponsesImap, EchecLecture, dateImap } from "../lib/imap-lecture";
import {
  DROPCONTACT, TAG_INTROUVABLE, aEnrichir, associerContacts, demandeDepuisFiche, emailRetenu, lancerEnrichissement, lireEnrichissement, patchDepuisContact,
} from "../lib/enrichissement";
import { classerReponse, confirmationRdv, deciderReponse, introRenseignement, propositionCreneaux, base64Utf8 } from "../lib/reponses-inscrit";
import {
  ETAT_AUTOPILOTE_VIDE, MARQUE_PREMIER, REGLAGES_AUTOPILOTE_DEFAUT, RESERVE_MIN, TAG_ENVOI_REFUSE, aContacter, adressesSuivies, planifier, preRequis, premierMessage,
  type ReglagesAutopilote,
} from "../lib/autopilote-inscrit";
import { DIVULGATION_ECRITE } from "../lib/signature-ia";
import { DO_NOT_CALL_TAG } from "../lib/voice-script";
import { lireSignaux } from "../lib/signaux-publics";
import { imapPourSmtp, imapSaisiAcceptable } from "../lib/identifiants-assistes";
import { DROIT_GRATUIT, autorise, pageOuverteAuVisiteur } from "../lib/entitlements";
import { CHEMIN_PAR_API } from "../lib/api-access";
import { CAPACITES_PAR_API } from "../lib/capacites-cle";
import { POST as postReponses } from "../app/api/reponses/route";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ALPHA FAIT TOUTE LA CHAÎNE (29/10/2026) — chercher, joindre, écrire, lire,
 * répondre, poser le rendez-vous, relancer.
 *
 * ⚠ AUCUNE ENTREPRISE NI ADRESSE RÉELLE : domaines RFC 2606 (`example.com`),
 * SIREN hors registre (ceux de `tests/signaux-publics.test.ts`), « (démo) »
 * dans les noms. Le faux serveur IMAP parle le protocole ; ce n'est PAS un vrai
 * hébergeur, et la doctrine le dit.
 * ─────────────────────────────────────────────────────────────────────
 */

const A = "000000018";
const B = "000000034";
// Mardi 3 novembre 2026, 10 h à Paris (UTC+1) : fenêtre ouverte.
const MARDI_10H = new Date("2026-11-03T09:00:00Z");
// Le même jour à 22 h : fenêtre fermée.
const MARDI_22H = new Date("2026-11-03T21:00:00Z");
const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

function fiche(o: Partial<Prospect> = {}): Prospect {
  return {
    ...prospectDefaults,
    id: o.id ?? `p-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    company: "PLOMBERIE (DÉMO)",
    sector: "autre",
    city: "Lyon",
    stage: "prospect",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...o,
  } as Prospect;
}

// ══════════ 1 · LIRE UN EMAIL ══════════

const CRLF = (s: string) => s.replace(/\r?\n/g, "\r\n");

const REPONSE_GMAIL = CRLF(`From: =?UTF-8?Q?Camille_D=C3=A9mo?= <camille@example.com>
To: moi@example.com
Subject: =?UTF-8?B?UmU6IFBMT01CRVJJRSDigJQgdW5lIHF1ZXN0aW9u?=
Date: Tue, 3 Nov 2026 09:30:00 +0100
Message-ID: <rep-1@example.com>
In-Reply-To: <envoi-1@example.com>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="b1"

--b1
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

2, c'est parfait. =C3=80 mardi !

Le mar. 3 nov. 2026 =C3=A0 09:00, Moi <moi@example.com> a
=C3=A9crit :
> 1. lundi 9 novembre
> R=C3=A9pondez STOP pour ne plus en recevoir.
--b1
Content-Type: text/html; charset="UTF-8"

<p>2, c'est parfait.</p>
--b1--
`);

test("⚠⚠ on lit SA réponse, pas notre message cité : « STOP » et « 1. » de l'historique disparaissent", () => {
  const m = lireMessage(Buffer.from(REPONSE_GMAIL, "latin1"));
  assert.equal(m.de, "camille@example.com");
  assert.equal(m.sujet, "Re: PLOMBERIE — une question");
  assert.equal(m.messageId, "<rep-1@example.com>");
  assert.equal(m.autoReponse, false);
  assert.equal(m.texte, "2, c'est parfait. À mardi !");
  assert.doesNotMatch(m.texte, /STOP|1\./, "notre propre message ne doit jamais être relu comme sa réponse");
});

test("mots encodés, réponses automatiques, HTML seul", () => {
  assert.equal(decoderEntete("=?ISO-8859-1?Q?Caf=E9?= =?ISO-8859-1?Q?_cr=E8me?="), "Café crème");
  const absence = lireMessage(CRLF("From: x@example.com\nSubject: Réponse automatique : absent\nAuto-Submitted: auto-replied\n\nJe suis absent."));
  assert.equal(absence.autoReponse, true);
  const html = lireMessage(CRLF("From: x@example.com\nContent-Type: text/html; charset=utf-8\n\n<p>Oui, appelez-moi</p><br>Merci"));
  assert.match(html.texte, /Oui, appelez-moi/);
  assert.equal(sansHistorique("Ok\n\nOn Tue, Nov 3, 2026, Me wrote:\n> bla"), "Ok");
});

// ══════════ 2 · IMAP, CONTRE UN FAUX SERVEUR ══════════

test("le découpage IMAP compte des OCTETS : un littéral accentué ne décale pas la suite", () => {
  const corps = Buffer.from("Re: déjà\r\n", "utf8");
  const buf = Buffer.concat([Buffer.from(`* 1 FETCH (UID 7 BODY[] {${corps.length}}\r\n`), corps, Buffer.from(")\r\nL3 OK fini\r\n")]);
  const { reponses, reste } = decouper(buf);
  assert.equal(reponses.length, 2);
  assert.equal(reponses[0].litteraux[0].toString("utf8"), "Re: déjà\r\n");
  assert.match(reponses[1].texte, /^L3 OK/);
  assert.equal(reste.length, 0);
  assert.equal(dateImap(new Date("2026-11-03T09:00:00Z")), "03-Nov-2026");
});

const MESSAGES: Record<number, string> = {
  11: REPONSE_GMAIL,
  12: CRLF("From: banque@example.net\nSubject: Votre relevé\n\nConfidentiel."),
  13: CRLF("From: autre@example.com\nSubject: Absence\nAuto-Submitted: auto-replied\n\nAbsent jusqu'au 10."),
};

function fauxServeur(motDePasse: string): Promise<{ port: number; commandes: string[]; fermer: () => void }> {
  const commandes: string[] = [];
  const serveur = net.createServer((s) => {
    s.write("* OK faux serveur pret\r\n");
    let tampon = "";
    s.on("data", (c) => {
      tampon += c.toString("latin1");
      let i: number;
      while ((i = tampon.indexOf("\r\n")) >= 0) {
        const ligne = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);
        const [tag, ...reste] = ligne.split(" ");
        const cmd = reste.join(" ");
        commandes.push(cmd.replace(/LOGIN .*/, "LOGIN ***"));
        if (/^LOGIN/.test(cmd)) s.write(cmd.endsWith(`"${motDePasse}"`) ? `${tag} OK connecte\r\n` : `${tag} NO [AUTHENTICATIONFAILED] refuse\r\n`);
        else if (/^EXAMINE/.test(cmd)) s.write(`* 3 EXISTS\r\n${tag} OK [READ-ONLY] examine\r\n`);
        else if (/^UID SEARCH/.test(cmd)) s.write(`* SEARCH 11 12 13\r\n${tag} OK cherche\r\n`);
        else if (/^UID FETCH/.test(cmd)) {
          const uids = cmd.split(" ")[2].split(",").map(Number);
          const entete = /HEADER\.FIELDS/.test(cmd);
          for (const [n, u] of uids.entries()) {
            const brut = MESSAGES[u];
            const contenu = Buffer.from(entete ? brut.split("\r\n").find((l) => l.startsWith("From:")) + "\r\n\r\n" : brut, "latin1");
            s.write(Buffer.concat([Buffer.from(`* ${n + 1} FETCH (UID ${u} BODY[] {${contenu.length}}\r\n`), contenu, Buffer.from(")\r\n")]));
          }
          s.write(`${tag} OK fetch\r\n`);
        } else if (/^LOGOUT/.test(cmd)) {
          s.write(`* BYE\r\n${tag} OK bye\r\n`);
          s.end();
        } else s.write(`${tag} BAD inconnu\r\n`);
      }
    });
  });
  return new Promise((ok) =>
    serveur.listen(0, "127.0.0.1", () => ok({ port: (serveur.address() as net.AddressInfo).port, commandes, fermer: () => serveur.close() }))
  );
}

test("⚠⚠ IMAP : lecture SEULE, et seul le corps des prospects listés est rapatrié", async () => {
  const f = await fauxServeur("bon");
  try {
    const msgs = await lireReponsesImap(
      { host: "127.0.0.1", port: f.port, user: "moi@example.com", pass: "bon", ouvrir: () => net.connect(f.port, "127.0.0.1") },
      ["camille@example.com", "autre@example.com"],
      new Date("2026-10-20T00:00:00Z")
    );
    assert.deepEqual(msgs.map((m) => m.de).sort(), ["autre@example.com", "camille@example.com"]);
    assert.ok(f.commandes.some((c) => c === "EXAMINE INBOX"), "la boîte s'ouvre en lecture seule");
    assert.ok(!f.commandes.some((c) => /^SELECT/.test(c)), "jamais SELECT : rien ne doit être marqué lu");
    const corps = f.commandes.find((c) => /BODY\.PEEK\[\]/.test(c)) ?? "";
    assert.doesNotMatch(corps, /\b12\b/, "le relevé de la banque n'est JAMAIS rapatrié");
    assert.ok(!f.commandes.some((c) => /STORE|EXPUNGE|COPY|MOVE/.test(c)));
  } finally {
    f.fermer();
  }
});

test("un mot de passe refusé se dit « auth », pas « personne n'a répondu »", async () => {
  const f = await fauxServeur("bon");
  try {
    await assert.rejects(
      lireReponsesImap({ host: "127.0.0.1", port: f.port, user: "moi", pass: "mauvais", ouvrir: () => net.connect(f.port, "127.0.0.1") }, ["camille@example.com"], new Date()),
      (e: unknown) => e instanceof EchecLecture && e.classe === "auth"
    );
  } finally {
    f.fermer();
  }
});

test("le serveur de lecture : connu, inconnu (on demande), ou saisi — jamais chez un autre domaine", () => {
  assert.equal(imapPourSmtp("smtp.gmail.com"), "imap.gmail.com");
  assert.equal(imapPourSmtp("smtp.inconnu.example"), null, "on ne devine pas « imap.<domaine> »");
  assert.equal(imapPourSmtp("smtp-relay.brevo.com"), null, "un relais n'a pas de boîte");
  assert.equal(imapSaisiAcceptable("imap.ionos.fr", "smtp.ionos.fr"), true);
  assert.equal(imapSaisiAcceptable("imap.attaquant.example", "smtp.ionos.fr"), false, "son mot de passe ne part que chez son hébergeur");
});

// ══════════ 3 · LES COORDONNÉES (Dropcontact) ══════════

test("la demande part du registre : SIREN + représentant quand il est unique", () => {
  const p = fiche({ company: "PLOMBERIE (DÉMO)", siren: A, representant: { prenom: "CAMILLE", nom: "DEMO" } });
  assert.deepEqual(demandeDepuisFiche(p), { company: "PLOMBERIE (DÉMO)", num_siren: A, last_name: "DEMO", first_name: "CAMILLE" });
  assert.equal(aEnrichir(fiche({ email: "x@example.com", siren: A })), false, "on ne paie pas pour ce qu'on a");
  assert.equal(aEnrichir(fiche({ siren: A, tags: [TAG_INTROUVABLE] })), false, "on ne repaie pas un échec");
});

test("⚠⚠ jamais une adresse personnelle ni « catch-all » : nominative@pro d'abord, sinon generic@pro", () => {
  assert.deepEqual(
    emailRetenu({ email: [{ email: "perso@gmail.example", qualification: "nominative@perso" }, { email: "contact@example.com", qualification: "generic@pro" }, { email: "c.demo@example.com", qualification: "nominative@pro" }] }),
    { email: "c.demo@example.com", nominatif: true }
  );
  assert.equal(emailRetenu({ email: [{ email: "perso@gmail.example", qualification: "nominative@perso" }] }), null);
  assert.equal(emailRetenu({ email: [{ email: "x@example.com", qualification: "catch_all@pro" }] }), null);
});

test("le patch complète sans écraser, retire « à joindre », et marque l'échec", () => {
  const p = fiche({ siren: A, phone: "0465710000", tags: ["registre", "a-joindre"] });
  const ok = patchDepuisContact(p, { email: [{ email: "c.demo@example.com", qualification: "nominative@pro" }], phone: "0465719999", full_name: "Camille Démo" });
  assert.equal(ok.email, "c.demo@example.com");
  assert.equal(ok.phone, undefined, "un numéro déjà posé ne se remplace pas");
  assert.equal(ok.name, "Camille Démo", "le nom vient avec l'email nominatif du fournisseur");
  assert.ok(!ok.tags!.includes("a-joindre"));
  const rien = patchDepuisContact(fiche({ siren: B, tags: ["a-joindre"] }), { email: [] });
  assert.ok(rien.tags!.includes(TAG_INTROUVABLE));
});

test("⚠ la clé part dans l'EN-TÊTE, jamais dans l'adresse ; un refus est `non-lu`", async () => {
  const appels: { url: string; headers?: Record<string, string> }[] = [];
  const ok = await lancerEnrichissement([{ company: "X (DÉMO)", num_siren: A }], "cle-secrete", async (url, init) => {
    appels.push({ url, headers: init?.headers });
    return { ok: true, status: 200, json: async () => ({ error: false, success: true, request_id: "abc123", credits_left: 9 }) };
  });
  assert.deepEqual(ok, { etat: "lance", requestId: "abc123", credits: 9 });
  assert.equal(appels[0].url, DROPCONTACT);
  assert.equal(appels[0].headers?.["X-Access-Token"], "cle-secrete");
  assert.doesNotMatch(appels[0].url, /cle-secrete/);
  const refus = await lancerEnrichissement([{ company: "X" }], "mauvaise", async () => ({ ok: false, status: 401, json: async () => ({}) }));
  assert.equal(refus.etat, "non-lu");
  const attente = await lireEnrichissement("abc123", "k", async () => ({ ok: true, status: 200, json: async () => ({ error: false, success: false, reason: "Request not ready yet" }) }));
  assert.equal(attente.etat, "en-cours", "« pas prête » est un état, pas une panne");
});

test("⚠⚠ vu au rendu : un contact va à la fiche que son SIREN désigne, jamais à la seule position", () => {
  const lot = [{ id: "plomberie", siren: A }, { id: "atelier", siren: B }];
  // Le fournisseur rend l'ordre INVERSE : la position aurait croisé les emails.
  const r = associerContacts(lot, [{ siren: B, email: [] }, { siren: A, email: [] }]);
  assert.deepEqual(r.map((x) => [x.id, x.contact.siren]), [["atelier", B], ["plomberie", A]]);
  // Un SIREN qu'aucune fiche du lot ne porte : posé NULLE PART.
  assert.deepEqual(associerContacts(lot, [{ siren: "000000042" }]), []);
  // Sans SIREN rendu, la position (rien ne la contredit).
  assert.deepEqual(associerContacts(lot, [{}, {}]).map((x) => x.id), ["plomberie", "atelier"]);
});

// ══════════ 4 · COMPRENDRE LA RÉPONSE ══════════

const CRENEAUX = [new Date("2026-11-09T09:00:00Z"), new Date("2026-11-10T13:00:00Z"), new Date("2026-11-11T09:00:00Z")]; // lun · mar · mer
const msg = (texte: string, autoReponse = false) => ({ texte, autoReponse });

test("⚠⚠ classer : le refus d'abord ; l'argent, la signature et le doute remontent ; le choix d'un créneau se COMPREND", () => {
  assert.equal(classerReponse(msg("Stop, ne me contactez plus.")).intention, "refus");
  assert.equal(classerReponse(msg("Oui pourquoi pas, mais combien ça coûte ?")).intention, "prix");
  assert.equal(classerReponse(msg("On est prêts, envoyez le contrat.")).intention, "veut-signer");
  assert.equal(classerReponse(msg("Pas le temps en ce moment.")).intention, "objection");
  assert.equal(classerReponse(msg("Oui avec plaisir, appelez-moi.")).intention, "veut-rdv");
  assert.equal(classerReponse(msg("C'est pour quel type d'entreprise ?")).intention, "renseignement");
  assert.equal(classerReponse(msg("Bien reçu.")).intention, "hors-sujet");
  assert.equal(classerReponse(msg("absent", true)).intention, "auto-reponse");
  const deux = classerReponse(msg("2, c'est parfait"), CRENEAUX);
  assert.deepEqual([deux.intention, deux.creneau], ["choix-creneau", 1]);
  assert.equal(classerReponse(msg("Mardi me va très bien"), CRENEAUX).creneau, 1);
  // Il propose autre chose : on ne réserve pas une heure mal comprise.
  assert.equal(classerReponse(msg("Plutôt vendredi après-midi ?"), CRENEAUX).intention, "hors-sujet");
  assert.equal(classerReponse(msg("Le 4"), CRENEAUX).intention, "hors-sujet", "un numéro hors liste ne se devine pas");
});

test("la décision : refus → retiré pour de bon ; prix → à toi, daté ; question sans offre déclarée → à toi", () => {
  const p = fiche({ email: "camille@example.com" });
  const lu = (texte: string) => ({ de: "camille@example.com", date: MARDI_10H.toISOString(), sujet: "Re: x", messageId: "<m>", inReplyTo: null, autoReponse: false, texte });
  const refus = deciderReponse(p, lu("Non merci"), null, MARDI_10H);
  assert.ok(refus.patch.tags!.includes(DO_NOT_CALL_TAG));
  assert.equal(refus.patch.stage, "perdu");
  const prix = deciderReponse(p, lu("Quel est votre tarif ?"), null, MARDI_10H);
  assert.equal(prix.repondre, null);
  assert.ok(prix.patch.tags!.includes("reponse-a-traiter"));
  assert.equal(prix.patch.nextStep!.date, "2026-11-03");
  assert.ok(prix.escalade);
  assert.equal(deciderReponse(p, lu("Vous faites quoi au juste ?"), null, MARDI_10H).repondre, null);
  const profil = { poste: "solo" as const, metier: "Des cuisines sur mesure.", cibleSecteur: "restaurants", cibleRole: "", cibleZone: "" };
  assert.equal(deciderReponse(p, lu("Vous faites quoi au juste ?"), profil, MARDI_10H).repondre, "renseignement");
});

test("⚠⚠ ce qui part parle de SON offre, propose 3 créneaux numérotés, et dit qu'une IA écrit", () => {
  const exp = { closerName: "Camille", agencyName: "CUISINES (DÉMO)", bookingUrl: "https://rdv.example.com" };
  const prop = propositionCreneaux({ name: "Jean Démo" }, CRENEAUX, exp, "PLOMBERIE — une question");
  assert.equal(prop.subject, "Re: PLOMBERIE — une question");
  assert.match(prop.body, /^Bonjour Jean,/);
  assert.match(prop.body, /\n1\. .*\n2\. .*\n3\. /);
  assert.match(prop.body, /Répondez simplement 1, 2 ou 3/);
  assert.ok(prop.body.includes(DIVULGATION_ECRITE));
  assert.doesNotMatch(prop.body, /EAGLEYE|bureau de vente|programmes?\b|acquéreurs/, "jamais notre offre dans la bouche d'un inscrit");
  assert.equal(introRenseignement({ poste: "solo", metier: "", cibleSecteur: "", cibleRole: "", cibleZone: "" }), null);
  assert.match(introRenseignement({ poste: "solo", metier: "Des cuisines sur mesure.", cibleSecteur: "", cibleRole: "", cibleZone: "" })!, /^En deux mots : des cuisines sur mesure\./);
  const conf = confirmationRdv({ name: "" }, CRENEAUX[1], "visio", exp, "Re: x", "BEGIN:VCALENDAR\r\nSUMMARY:Rendez-vous — démo\r\nEND:VCALENDAR");
  assert.ok(conf.body.includes(DIVULGATION_ECRITE));
  assert.equal(Buffer.from(conf.attachments![0].contentBase64, "base64").toString("utf8"), "BEGIN:VCALENDAR\r\nSUMMARY:Rendez-vous — démo\r\nEND:VCALENDAR");
  assert.equal(base64Utf8("é"), Buffer.from("é", "utf8").toString("base64"));
});

// ══════════ 5 · LE PLAN D'UN PASSAGE ══════════

const R = (o: Partial<ReglagesAutopilote> = {}): ReglagesAutopilote => ({ ...REGLAGES_AUTOPILOTE_DEFAUT, actif: true, activites: ["43.22A"], zone: "69", ...o });
const CAP = { boite: true, cleDropcontact: true };
const ecritIlYa = (jours: number) => ({ id: `e${jours}`, date: new Date(MARDI_10H.getTime() - jours * 86_400_000).toISOString(), kind: "email" as const, summary: `${MARQUE_PREMIER} : objet` });

test("⚠⚠ à qui ALPHA écrit : jamais à qui a refusé, est liquidé, a déjà reçu un message, ou attend l'humain", () => {
  const liquidee = lireSignaux(B, [{ dateparution: "2026-10-01", familleavis: "collective", typeavis: "annonce", modificationsgenerales: null, jugement: JSON.stringify({ nature: "Jugement d'ouverture de liquidation judiciaire", complementJugement: "liquidation judiciaire" }), acte: null, url_complete: "https://www.bodacc.fr/x", registre: [B] }], MARDI_10H);
  const prets = aContacter(
    [
      fiche({ id: "ok", email: "a@example.com" }),
      fiche({ id: "sans-email" }),
      fiche({ id: "refus", email: "b@example.com", tags: [DO_NOT_CALL_TAG] }),
      fiche({ id: "liquidee", email: "c@example.com", signauxPublics: liquidee }),
      fiche({ id: "deja", email: "d@example.com", events: [ecritIlYa(2)] }),
      fiche({ id: "humain", email: "e@example.com", tags: ["reponse-a-traiter"] }),
      fiche({ id: "refuse-serveur", email: "f@example.com", tags: [TAG_ENVOI_REFUSE] }),
      // Vu au rendu : le premier message partait vers le JEU DE DÉMONSTRATION.
      fiche({ id: "demo-cabinet-1", email: "contact@cabinet.example.com" }),
    ],
    MARDI_10H
  ).map((p) => p.id);
  assert.deepEqual(prets, ["ok"]);
});

test("⚠⚠ le plan : arrêté = rien ; sans boîte = il le dit ; la nuit = il lit sans écrire ; plafond = pause", () => {
  const p = [fiche({ id: "ok", email: "a@example.com" })];
  assert.equal(planifier(p, R({ actif: false }), ETAT_AUTOPILOTE_VIDE, CAP, MARDI_10H).ecrire, null);
  const jour = planifier(p, R(), ETAT_AUTOPILOTE_VIDE, CAP, MARDI_10H);
  assert.equal(jour.ecrire, "ok");
  const sansBoite = planifier(p, R(), ETAT_AUTOPILOTE_VIDE, { ...CAP, boite: false }, MARDI_10H);
  assert.equal(sansBoite.ecrire, null);
  assert.ok(sansBoite.attentes.some((a) => /boîte email/.test(a)));
  const nuit = planifier(p, R(), ETAT_AUTOPILOTE_VIDE, CAP, MARDI_22H);
  assert.equal(nuit.ecrire, null);
  assert.ok(nuit.attentes.some((a) => /n'écrit pas/.test(a)));
  const pleins = Array.from({ length: 3 }, (_, i) => fiche({ email: `x${i}@example.com`, stage: "contact", events: [{ ...ecritIlYa(0), id: `z${i}` }] }));
  assert.equal(planifier([...p, ...pleins], R({ envoisParJour: 3 }), ETAT_AUTOPILOTE_VIDE, CAP, MARDI_10H).ecrire, null);
  const suspendu = planifier(p, R(), { ...ETAT_AUTOPILOTE_VIDE, envoisSuspendusJusqua: "2026-11-03T12:00:00Z" }, CAP, MARDI_10H);
  assert.equal(suspendu.ecrire, null, "quand le serveur a dit non, on ne le martèle pas");
});

test("⚠ une relance ne part qu'avec une raison NEUVE — et passe devant un premier message", () => {
  const sansRaison = fiche({ id: "r", email: "r@example.com", stage: "contact", events: [ecritIlYa(4)] });
  const avecRaison = fiche({ id: "s", email: "s@example.com", stage: "contact", events: [ecritIlYa(4)], nextStep: { date: "2026-11-03", action: "Rappeler", demandePar: "prospect" } });
  const neuve = fiche({ id: "n", email: "n@example.com" });
  assert.equal(planifier([sansRaison, neuve], R(), ETAT_AUTOPILOTE_VIDE, CAP, MARDI_10H).relancer, null, "pas de raison neuve, pas de relance");
  const plan = planifier([avecRaison, neuve], R(), ETAT_AUTOPILOTE_VIDE, CAP, MARDI_10H);
  assert.deepEqual(plan.relancer, { prospectId: "s", numero: 1 });
  assert.equal(plan.ecrire, null, "un message par passage");
});

test("quand la réserve baisse, ALPHA va chercher la page SUIVANTE ; sans cible, il le dit", () => {
  const etat = { ...ETAT_AUTOPILOTE_VIDE, pagesRegistre: { "43.22A|69|toutes": 2 } };
  assert.deepEqual(planifier([], R(), etat, CAP, MARDI_10H).chercher, { activites: ["43.22A"], zone: "69", taille: "toutes", page: 3 });
  const reserve = Array.from({ length: RESERVE_MIN }, (_, i) => fiche({ email: `r${i}@example.com` }));
  assert.equal(planifier(reserve, R(), etat, CAP, MARDI_10H).chercher, null);
  // Vu au rendu : une cible épuisée était relue à chaque passage.
  const epuisee = planifier([], R(), { ...etat, ciblesEpuisees: { "43.22A|69|toutes": "2026-11-03" } }, CAP, MARDI_10H);
  assert.equal(epuisee.chercher, null);
  assert.ok(epuisee.attentes.some((a) => /élargis la zone/.test(a)));
  assert.notEqual(planifier([], R(), { ...etat, ciblesEpuisees: { "43.22A|69|toutes": "2026-11-02" } }, CAP, MARDI_10H).chercher, null, "le lendemain, on recherche");
  const sansCible = planifier([], R({ activites: [], zone: "" }), ETAT_AUTOPILOTE_VIDE, CAP, MARDI_10H);
  assert.equal(sansCible.chercher, null);
  assert.ok(sansCible.attentes.some((a) => /métier et quelle zone/.test(a)));
});

test("coordonnées : un lot dans le budget du jour ; sans clé, il le dit au lieu de se taire", () => {
  const ajoindre = Array.from({ length: 30 }, (_, i) => fiche({ id: `j${i}`, siren: A, tags: ["a-joindre"] }));
  assert.equal(planifier([fiche({ id: "demo-x", siren: A, tags: ["a-joindre"] })], R(), ETAT_AUTOPILOTE_VIDE, CAP, MARDI_10H).lancerEnrichissement.length, 0, "on ne paie jamais pour une fiche de démo");
  assert.equal(planifier(ajoindre, R({ enrichissementsParJour: 12 }), ETAT_AUTOPILOTE_VIDE, CAP, MARDI_10H).lancerEnrichissement.length, 12);
  const sansCle = planifier(ajoindre, R(), ETAT_AUTOPILOTE_VIDE, { ...CAP, cleDropcontact: false }, MARDI_10H);
  assert.equal(sansCle.lancerEnrichissement.length, 0);
  assert.ok(sansCle.attentes.some((a) => /clé Dropcontact/.test(a)));
  const epuise = planifier(ajoindre, R({ enrichissementsParJour: 5 }), { ...ETAT_AUTOPILOTE_VIDE, enrichisJour: { jour: "2026-11-03", n: 5 } }, CAP, MARDI_10H);
  assert.equal(epuise.lancerEnrichissement.length, 0);
});

test("les adresses suivies : celles à qui ALPHA a écrit, pas les autres", () => {
  assert.deepEqual(adressesSuivies([fiche({ email: "A@Example.com", events: [ecritIlYa(3)] }), fiche({ email: "b@example.com" })], MARDI_10H), ["a@example.com"]);
});

test("⚠⚠ le premier message est celui de l'écran, plus l'aveu de l'IA ; un inscrit ne signe jamais EAGLEYE", () => {
  const m = premierMessage(fiche({ name: "Jean Démo" }), { accountId: "eagleye", closerName: "Camille", agencyName: "CUISINES (DÉMO)" }, { profil: { poste: "solo", metier: "des cuisines sur mesure", cibleSecteur: "restaurants", cibleRole: "gérants", cibleZone: "" }, agencyName: "CUISINES (DÉMO)", city: "" });
  assert.ok(m.body.endsWith(DIVULGATION_ECRITE));
  assert.match(m.body, /STOP/);
  assert.doesNotMatch(m.body, /EAGLEYE/);
});

test("les prérequis disent ce qui manque et ce que ça coupe", () => {
  const l = preRequis({ metier: "", reglages: { activites: [], zone: "Lyon" }, boite: false, cleDropcontact: false });
  assert.deepEqual(l.filter((x) => !x.ok).map((x) => x.id), ["offre", "cible", "cle", "boite"]);
  assert.match(l.find((x) => x.id === "cible")!.manque, /CODE/, "un nom de commune : la raison du registre est reprise");
});

// ══════════ 6 · LES PORTES ══════════

test("⚠ l'écran est gratuit et ouvert au visiteur ; LIRE sa boîte vit sur le chemin de l'envoi, ouvert par sa clé email", () => {
  assert.equal(autorise(DROIT_GRATUIT, "/autopilote"), true);
  assert.equal(pageOuverteAuVisiteur("/autopilote"), true);
  assert.equal(CHEMIN_PAR_API["/api/reponses"], "/campaigns");
  assert.deepEqual(CAPACITES_PAR_API["/api/reponses"], ["email"]);
  assert.equal(autorise(DROIT_GRATUIT, "/campaigns"), false, "sans sa clé, la lecture reste fermée");
  assert.match(lire("middleware.ts"), /"\/api\/reponses",/);
});

test("⚠⚠ /api/reponses : pas de session, pas de lecture", async () => {
  const avant = { ...process.env };
  Object.assign(process.env, { SUPABASE_JWT_SECRET: "secret-de-test-hs256-0123456789abcdef", NEXT_PUBLIC_SUPABASE_URL: "https://exemple.supabase.co" });
  delete process.env.SITE_PASSWORD;
  try {
    const r = await postReponses(new NextRequest("https://alpha.example/api/reponses", { method: "POST", body: JSON.stringify({ adresses: ["a@example.com"] }) }));
    assert.equal(r.status, 401);
  } finally {
    process.env = avant;
  }
});

test("⚠⚠ NOTRE boîte ne se lit que pour le maître, et le moteur écrit en mode AUTONOME", () => {
  const route = lire("app/api/reponses/route.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(route, /if \(smtp\.origine === "maison" && !droits\.maitre\)/);
  const moteur = lire("components/autopilote/moteur-autopilote.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(moteur, /modeProduction: "autonome"/);
  assert.doesNotMatch(moteur, /modeProduction: "valide-par-humain"/, "personne ne relit : le dire serait faux");
  const imap = lire("lib/imap-lecture.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(imap, /SELECT INBOX|\bSTORE\b|EXPUNGE/);
});
