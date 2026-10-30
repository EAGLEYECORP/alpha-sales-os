import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expediteurDuPilote, premierMessage } from "../lib/autopilote-inscrit";
import { classerReponse, confirmationRdv } from "../lib/reponses-inscrit";
import { prochainsCreneaux } from "../lib/creneaux-rdv";
import { DIVULGATION_ECRITE } from "../lib/signature-ia";
import { PROMESSE_COURTE } from "../lib/promesse";
import { REGISTRE } from "../lib/trouver-clients";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";
import { INTERDITS, textesRetiresTropTot, tweens, verifierNomsEnCapitales, visibleDe } from "./film-outils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE FILM « ALPHA VEND ALPHA » (29/10/2026) — le cycle entier, de A à Z.
 *
 * Le compte MAÎTRE donne NOTRE offre au pilote automatique ; le film montre
 * les vrais écrans de ce qu'il fait ensuite (`capturer.mjs`, données fictives
 * dans `donnees.json`). Ce qui peut mentir dans un tel film, et que ce test
 * refuse :
 *  · une légende que le code ne tient plus (« il dit qu'il est une IA »,
 *    « mercredi est pris : pas proposé », « le prix : à toi ») — chacune est
 *    REJOUÉE ici sur les données du tournage, avec les fonctions de production ;
 *  · une frappe simulée, un texte retiré trop tôt, un interdit, une donnée réelle.
 *
 * ⚠ Il a été UTILE avant d'exister, comme les deux films d'avant. Préparer les
 * captures a fait tomber CINQ défauts de ce qui part chez un prospect : le
 * maître écrivait sur notre escalier au lieu de son offre ; chaque email portait
 * deux signatures et trois « STOP » ; le pied affirmait « nous accompagnons les
 * professionnels de votre secteur » à zéro client ; l'email des créneaux
 * montrait des puces sous « Répondez 1, 2 ou 3 » ; et le bandeau forçait tout
 * l'email à 600 px sur un téléphone. Tous corrigés et gardés avant le tournage.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();
const DOSSIER = join(RACINE, "scripts/video/compositions/alpha-vend-alpha");
const html = readFileSync(join(DOSSIER, "index.html"), "utf8");
const visible = visibleDe(html);
const capturer = readFileSync(join(DOSSIER, "capturer.mjs"), "utf8");
const partition = JSON.parse(readFileSync(join(RACINE, "scripts/video/partitions/alpha-vend-alpha.json"), "utf8")) as {
  duree: number;
  accords: [number, number[]][];
};
interface Donnees {
  maintenant: string;
  reglages: { accountId: string; agencyName: string; closerName: string; offer: { city: string }; profil: { poste: "dirigeant"; metier: string; cibleSecteur: string; cibleRole: string; cibleZone: string } };
  cible: { saisie: string; activite: string; naf: string; zone: string };
  agenda: { occupe: { debut: string; fin: string }[] };
  entreprises: { siren: string; nom: string; prenom: string; email: string; qualification: string }[];
  telephone: string;
  reponses: { de: number; apres: "premier" | "creneaux"; date: string; texte: string; attendu: string }[];
}
const D = JSON.parse(readFileSync(join(DOSSIER, "donnees.json"), "utf8")) as Donnees;
const fiche = (i: number): Prospect =>
  ({ ...prospectDefaults, id: `reg-${D.entreprises[i].siren}`, company: D.entreprises[i].nom, name: `${D.entreprises[i].prenom} Démo`, email: D.entreprises[i].email, tags: ["registre"] }) as Prospect;
const expediteur = () =>
  expediteurDuPilote({ inscrit: null, profil: D.reglages.profil, agencyName: D.reglages.agencyName, city: D.reglages.offer.city });

// ── 1 · LE TOURNAGE : le vrai mode, de fausses données ──────────────────

test("⚠⚠ le tournage se fait en mode MAÎTRE prouvé par le serveur, sur le vrai pilote, réseau seulement remplacé", () => {
  assert.match(capturer, /droits\.maitre !== true\) throw/, "sans verdict maître, ce n'est plus ALPHA qui vend ALPHA");
  assert.match(capturer, /getByRole\("button", \{ name: \/Lancer ALPHA\/ \}\)\.click\(\)/, "le cycle doit être lancé par le vrai bouton");
  assert.match(capturer, /\/api\/email\/preview/, "les emails montrés sont rendus par le SERVEUR, pas dessinés");
  assert.match(capturer, /timezoneId: "Europe\/Paris"/, "en UTC, l'écran annonçait 08:00 pour un rendez-vous à 9 h");
  // Le faux `/api/send` est STRICT, comme le vrai (decisionRecontact).
  assert.match(capturer, /!x\.suite && ecrits\.has\(to\)\) return json\(r, [^)]*\}, 409\)/);
  assert.match(capturer, /x\.suite === "reponse" && !ecrits\.has\(to\)\) return json\(r, [^)]*\}, 409\)/);
});

test("les données du tournage sont FICTIVES : (DÉMO), domaines réservés, plage ARCEP de fiction", () => {
  for (const e of D.entreprises) {
    assert.match(e.nom, /\(DÉMO\)$/, e.nom);
    assert.match(e.email, /@[\w-]+\.example\.com$/, `${e.email} : domaine RFC 2606 exigé`);
    assert.match(e.siren, /^0{6}\d{3}$/, `${e.siren} : SIREN de fixture, hors registre`);
  }
  assert.match(D.telephone, /^046571/, "plage ARCEP réservée à la fiction");
  assert.match(visible, /ÉCRANS RÉELS · EXEMPLES ILLUSTRATIFS/);
});

// ── 2 · CE QUE LE FILM AFFIRME, REJOUÉ SUR LE VRAI CODE ─────────────────

test("⚠⚠ A — la phrase tapée est NOTRE offre, et c'est elle que le premier message pose en question", () => {
  const m = premierMessage(fiche(0), { accountId: "eagleye", closerName: D.reglages.closerName, agencyName: D.reglages.agencyName }, expediteur());
  assert.ok(m.body.includes(`Est-ce qu'${D.reglages.profil.metier}, c'est un sujet chez vous en ce moment ?`), m.body);
  assert.match(m.body, /je m'adresse aux dirigeants \(agences immobilières\)/);
  assert.doesNotMatch(m.body, /accueil téléphonique|process commercial|acquéreurs/, "plus rien de l'escalier : ALPHA vend ce qu'on lui a dit de vendre");
  // La frappe est réelle : une capture par lettre, posées dans l'ordre.
  const images = [...html.matchAll(/id="af(\d{2})" src="caps\/frappe-(\d{2})\.png"/g)];
  assert.equal(images.length, D.reglages.profil.metier.length + 1, "une image par lettre, plus le champ vide");
  const apparitions = tweens(html).filter((x) => x.cible.startsWith("#af") && x.versOpacite === 1).map((x) => x.t);
  assert.equal(apparitions.length, D.reglages.profil.metier.length);
  assert.deepEqual([...apparitions].sort((a, b) => a - b), apparitions, "les lettres n'arrivent pas dans l'ordre");
  assert.match(capturer, /champ\.type\(metier\[i - 1\]\)/, "la capture tape la phrase dans le VRAI champ");
});

test("B — « par métier et par zone, au registre officiel » : la recherche part du registre de l'État", () => {
  assert.match(visible, /Par métier et par zone, au registre officiel\./);
  assert.equal(REGISTRE, "https://recherche-entreprises.api.gouv.fr/search");
  assert.match(capturer, /page\.route\("https:\/\/recherche-entreprises\.api\.gouv\.fr\/\*\*"/, "on remplace la RÉPONSE du registre, jamais l'app");
});

test("⚠⚠ D — « il dit qu'il est une IA » : le premier message se clôt sur la divulgation", () => {
  assert.match(visible, /Une seule question\. Et il dit qu'il est une IA\./);
  const m = premierMessage(fiche(0), { accountId: "eagleye", closerName: D.reglages.closerName, agencyName: D.reglages.agencyName }, expediteur());
  assert.ok(m.body.endsWith(DIVULGATION_ECRITE));
  assert.equal(m.body.split(D.reglages.closerName).length - 1, 0, "la signature est posée par le RENDU, une seule fois");
});

test("⚠⚠ E — « mercredi est pris dans ton agenda : pas proposé » — et SANS l'agenda, il l'aurait été", () => {
  assert.match(visible, /Mercredi est pris dans ton agenda : pas proposé\./);
  // L'instant où le pilote a lu le « oui » (la réponse est datée dans le tournage).
  const oui = D.reponses.find((r) => r.attendu === "veut-rdv")!;
  const maintenant = new Date(oui.date);
  const occupe = D.agenda.occupe.map((p) => ({ debut: Date.parse(p.debut), fin: Date.parse(p.fin) }));
  const jour = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", timeZone: "Europe/Paris" });
  const avec = prochainsCreneaux(maintenant, { n: 3, indisponibles: occupe });
  const sans = prochainsCreneaux(maintenant, { n: 3 });
  assert.equal(avec.length, 3);
  assert.ok(!avec.some((d) => jour(d) === "mercredi"), `mercredi proposé malgré l'agenda : ${avec.map(jour)}`);
  assert.ok(sans.some((d) => jour(d) === "mercredi"), "sans l'agenda, mercredi n'était pas proposé : la légende ne prouverait rien");
});

test("les réponses du tournage sont CLASSÉES par le vrai code comme le film le raconte", () => {
  const oui = D.reponses.find((r) => r.apres === "premier" && r.de === 0)!;
  assert.equal(classerReponse({ texte: oui.texte, autoReponse: false }).intention, oui.attendu);
  const prix = D.reponses.find((r) => r.attendu === "prix")!;
  assert.equal(classerReponse({ texte: prix.texte, autoReponse: false }).intention, "prix", "« le prix : à toi » exige que la question d'argent soit reconnue");
  const choix = D.reponses.find((r) => r.apres === "creneaux")!;
  const proposes = [new Date("2026-11-05T08:00:00Z"), new Date("2026-11-06T08:00:00Z"), new Date("2026-11-09T08:00:00Z")];
  const c = classerReponse({ texte: choix.texte, autoReponse: false }, proposes);
  assert.equal(c.intention, choix.attendu);
  assert.equal(c.intention === "choix-creneau" ? c.creneau : null, 1, "« 2 » choisit le DEUXIÈME créneau");
});

test("F — « l'invitation part avec, copie dans ta boîte » : un .ics joint, et la copie à l'expéditeur", () => {
  assert.match(visible, /L'invitation part avec, copie dans ta boîte\./);
  const c = confirmationRdv({ name: "Camille Démo" }, new Date("2026-11-06T08:00:00Z"), "visio", { closerName: "", agencyName: "" }, "Re: x", "BEGIN:VCALENDAR\r\nEND:VCALENDAR");
  assert.equal(c.attachments?.[0].filename, "rendez-vous.ics");
  const moteur = readFileSync(join(RACINE, "lib/pilote-executeur.ts"), "utf8");
  assert.match(moteur, /repondre\(confirmationRdv\([^;]*\), true\)/, "la confirmation part avec `copieExpediteur` : l'invitation arrive dans SON agenda");
});

test("G — « le prix et la signature : à toi » ; Z — la devise est la promesse du dépôt, mot pour mot", () => {
  assert.match(visible, /Le prix et la signature : à toi\./);
  assert.equal(classerReponse({ texte: "Je veux signer le contrat.", autoReponse: false }).intention, "veut-signer");
  const devise = /<span class="ligne">([^<]+)<\/span><b class="ligne">([^<]+)<\/b>/.exec(html);
  assert.ok(devise);
  assert.equal(`${devise[1]} ${devise[2]}`, PROMESSE_COURTE);
});

test("⚠ aucun prix, aucun chiffre de performance, aucun superlatif — et les noms en capitales", () => {
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(visible, motif, raison);
  verifierNomsEnCapitales(visible);
  // Le seul nombre à l'écran est le « 2 » que le prospect écrit pour choisir.
  assert.deepEqual(visible.match(/\d+/g) ?? [], ["2"], "aucun autre nombre : rien n'est mesuré");
});

// ── 3 · LA LECTURE, LE SON, LES FICHIERS ────────────────────────────────

test("l'étiquette « EXEMPLES ILLUSTRATIFS » entre avant le premier écran et ne sort qu'avec le logo", () => {
  const pas = tweens(html);
  const entree = pas.find((p) => p.cible === "#illustr" && p.versOpacite === 1)!;
  const ecran = pas.find((p) => p.cible === "#aE" && p.versOpacite === 1)!;
  const fin = Number(html.match(/<section id="s8"[^>]*data-start="([\d.]+)"/)?.[1]);
  assert.ok(entree.t <= ecran.t);
  for (const s of pas.filter((p) => p.cible === "#illustr" && p.versOpacite === 0)) assert.ok(s.t >= fin - 0.35 - 1e-9, `elle sort à ${s.t} s, avant la fin`);
});

test("⚠⚠ CHAQUE TEXTE RESTE POSÉ AU MOINS 0,3 s PAR MOT (plancher 1,2 s) — mesuré sur la timeline jouée", () => {
  const { fautifs, mesures } = textesRetiresTropTot(html, partition.duree);
  assert.ok(mesures >= 18, `le test ne mesure plus rien (${mesures} textes)`);
  assert.deepEqual(fautifs, [], `texte retiré trop tôt — allonger la scène, pas raccourcir la phrase :\n${fautifs.join("\n")}`);
});

test("le son est calé sur l'image : même durée, un accord par scène, scènes contiguës", () => {
  const racine = html.match(/data-composition-id="main"[^>]*data-duration="([\d.]+)"/)?.[1];
  assert.equal(Number(racine), partition.duree);
  assert.equal(Number(html.match(/<audio[^>]*data-duration="([\d.]+)"/)?.[1]), partition.duree);
  const debuts = [...html.matchAll(/<section id="s\d"[^>]*data-start="([\d.]+)"/g)].map((m) => Number(m[1]));
  const durees = [...html.matchAll(/<section id="s\d"[^>]*data-duration="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(debuts.length, 8);
  assert.deepEqual(partition.accords.map(([t]) => t), debuts);
  durees.forEach((d, i) => {
    const suite = i + 1 < debuts.length ? debuts[i + 1] : partition.duree;
    assert.ok(Math.abs(debuts[i] + d - suite) < 1e-6, `la scène ${i + 1} ne s'enchaîne pas`);
  });
  // Plus long que la règle des 25 s, et c'est un choix : la demande était le cycle
  // ENTIER, étape par étape. Sept étapes lisibles ne tiennent pas en vingt secondes.
  assert.ok(partition.duree <= 38, `${partition.duree} s : au-delà, on ne regarde plus un cycle, on le subit`);
});

test("le film rendu est dans public/media/linkedin, et ses captures ne sont PAS commitées", () => {
  assert.ok(existsSync(join(RACINE, "public/media/linkedin/alpha-vend-alpha-2026-10-29.mp4")));
  assert.match(readFileSync(join(DOSSIER, ".gitignore"), "utf8"), /^caps\/$/m);
});

// ── 4 · LE POST ─────────────────────────────────────────────────────────

const postMd = readFileSync(join(RACINE, "marketing/post-alpha-vend-alpha-2026-10-29.md"), "utf8");
const post = /## Texte du post[\s\S]*?```\n([\s\S]*?)\n```/.exec(postMd)?.[1] ?? "";

test("le post tient dans LinkedIn, s'ouvre sur l'accroche du film, et passe par les MÊMES interdits", () => {
  assert.ok(post.length > 400 && post.length <= 3000, `${post.length} caractères`);
  assert.ok(post.startsWith("ALPHA vend ALPHA."));
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(post, motif, raison);
  verifierNomsEnCapitales(post);
  assert.match(post, /Écrans réels/);
  assert.match(post, /fictiv/);
  assert.match(post, /alphasalesos\.eagleyecorp\.fr\/vitrine/);
  assert.ok(post.includes(D.reglages.profil.metier), "la phrase tapée dans le film est citée telle quelle");
});

test("⚠⚠ le post dit la frontière, et ne prétend aucun client", () => {
  assert.match(post, /onglet (?:d'ALPHA )?(?:est )?ouvert/);
  assert.match(post, /aucun client|zéro client|pas encore de client/i, "ALPHA qui vend ALPHA n'a encore rien vendu : on le dit avant qu'on nous le demande");
  assert.doesNotMatch(post, /ne quitte(?:nt)? jamais|ne passe(?:nt)? (?:jamais )?par nos serveurs/i);
  assert.match(postMd, /\*\*Statut : (?:PRÊT, PAS PUBLIÉ|PUBLIÉ le \d{2}\/\d{2}\/\d{4}[^*]*\*\*[\s\S]{0,40}urn:li:ugcPost:\d+)/);
});
