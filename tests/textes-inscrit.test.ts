import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { demoDepuisProfil } from "../lib/demo-icp";
import { inviteText, messageText, relanceText, buildLinkedinQueue } from "../lib/linkedin-sequence";

/** La limite de LinkedIn pour une note d'invitation (celle que l'écran annonce : « ≤ 300 car. »). */
const LINKEDIN_INVITE_LIMIT = 300;
import { emailBody, emailSubject } from "../lib/mail-compose";
import { approcheInscrit, messageCourt, type ExpediteurInscrit } from "../lib/approche-ecrite";
import { PROFIL_VIDE, type ProfilOperateur } from "../lib/profil-operateur";
import { sansCommentaires } from "./citations-alpha";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'UN INSCRIT COPIE ET ENVOIE PARLE DE SON OFFRE ET SIGNE DE SON NOM.
 *
 * Mesuré le 22/10/2026 avec le vrai code : l'invitation LinkedIn d'un inscrit
 * qui vend un logiciel de paie disait « je suis Julie Martin, d'EAGLEYE CORP.
 * Je m'adresse aux métiers où le téléphone EST le canal d'entrée ». La société
 * venait du COMPTE que tout inscrit porte, le reste de NOS aimants. Une
 * invitation se copie à la main : aucun serveur ne la relit.
 * ─────────────────────────────────────────────────────────────────────
 */

const PROFIL: ProfilOperateur = { ...PROFIL_VIDE, metier: "un logiciel de paie", cibleSecteur: "restaurants", cibleRole: "gérants", cibleZone: "Lyon" };
const INSCRIT: ExpediteurInscrit = { profil: PROFIL, agencyName: "Dupont Conseil SAS", city: "Lyon" };
const p = demoDepuisProfil(PROFIL)![0];

/** Ce qui trahit notre marque ou nos aimants dans un texte écrit. */
const NOTRE = /eagleye|nuwacom|alpha|accueil|décroch|téléphone|appels? manqu|visibilit|en ligne|il m'arrive de préparer|audit/i;

const textes = (inscrit: ExpediteurInscrit) => ({
  invitation: inviteText(p, "eagleye", "Julie Martin", inscrit),
  message: messageText(p, "", "eagleye", "Julie Martin", inscrit),
  relance: relanceText(p, "eagleye", "Julie Martin", inscrit),
  objet: emailSubject(p, "eagleye", inscrit),
  email: emailBody(p, { accountId: "eagleye", closerName: "Julie Martin", inscrit }),
  whatsapp: messageCourt(p, "eagleye", inscrit),
});

test("⚠⚠ les cinq textes d'un inscrit parlent de SON offre, signent de SA société, sans un mot de notre marque ni de nos aimants", () => {
  const t = textes(INSCRIT);
  for (const [nom, texte] of Object.entries(t)) {
    assert.doesNotMatch(texte, NOTRE, `${nom} : « ${texte} »`);
  }
  for (const nom of ["invitation", "message", "email", "whatsapp"] as const) {
    assert.match(t[nom], /un logiciel de paie/, `${nom} doit poser la question de SON offre`);
    assert.match(t[nom], /gérants/, `${nom} doit dire SON critère`);
  }
  for (const nom of ["invitation", "message", "relance", "email"] as const) {
    assert.match(t[nom], /Dupont Conseil SAS/, `${nom} doit signer de SA société`);
  }
  assert.ok(t.invitation.length <= LINKEDIN_INVITE_LIMIT, "l'invitation tient dans la limite LinkedIn");
  assert.match(t.email, /STOP/, "la mention de refus reste");
  // La relance de nos verticales renvoie à NOTRE pitch (« c'est exactement le
  // problème dont je parlais ») : un inscrit n'en a parlé nulle part. La
  // mutation qui la rétablissait passait le motif ci-dessus.
  assert.doesNotMatch(t.relance, /problème dont je parlais|sur le terrain, pas sur LinkedIn/);
});

test("sans société saisie : son nom seul, jamais le nôtre, et aucun tiret orphelin", () => {
  const t = textes({ ...INSCRIT, agencyName: "", city: "" });
  assert.match(t.invitation, /je suis Julie Martin\./);
  for (const [nom, texte] of Object.entries(t)) {
    assert.doesNotMatch(texte, NOTRE, nom);
    assert.doesNotMatch(texte, /— ?$|— ,|, $/m, `${nom} : signature mutilée`);
  }
});

test("un profil vide donne des formulations neutres — jamais des crochets, qui partiraient avec le texte copié", () => {
  const a = approcheInscrit(PROFIL_VIDE);
  for (const v of [a.phraseCritere, a.question, a.objet]) assert.doesNotMatch(v, /\[|\]/);
  assert.equal(a.signal, null, "aucun aimant à nous");
  assert.doesNotMatch(textes({ profil: null, agencyName: "", city: "" }).invitation, NOTRE);
});

test("le compte maître est inchangé (sinon les tests ci-dessus ne prouvent rien)", () => {
  assert.match(inviteText(p, "eagleye", "Julie Martin"), /EAGLEYE CORP/);
  const file = buildLinkedinQueue([p], { accountId: "eagleye", closerName: "Julie Martin", inscrit: INSCRIT });
  assert.doesNotMatch(file[0].text, NOTRE, "la file LinkedIn passe l'expéditeur jusqu'au texte");
});

test("⚠ les écrans passent l'expéditeur, sur un verdict serveur PESSIMISTE", () => {
  const lire = (f: string) => sansCommentaires(readFileSync(join(process.cwd(), f), "utf8"));
  const linkedin = lire("app/(app)/linkedin/page.tsx");
  assert.match(linkedin, /const inscrit = useExpediteurInscrit\(\)/);
  assert.match(linkedin, /buildLinkedinQueue\([\s\S]{0,400}inscrit,/);
  const fiche = lire("app/(app)/prospects/[id]/page.tsx");
  assert.match(fiche, /emailSubject\(p, accountId, inscrit\)/);
  assert.match(fiche, /emailBody\(p, \{ accountId, closerName: closer, inscrit \}\)/);
  assert.match(fiche, /messageCourt\(p, accountId, inscrit\)/);
  assert.match(fiche, /inviteText\(p, accountId, closer, inscrit\)/);
  const hook = lire("lib/use-expediteur.ts");
  assert.match(hook, /useMaitreProuve\(\)/);
  const droits = lire("lib/use-droits.ts");
  assert.match(droits, /setM\(d !== OPTIMISTE && d\.maitre\)/, "une panne ne doit jamais prouver « maître »");
  assert.match(droits, /useState<boolean>\(cache\?\.maitre \?\? false\)/, "faux tant qu'on ne sait pas");
});
