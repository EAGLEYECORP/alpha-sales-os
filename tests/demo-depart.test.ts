import { test } from "node:test";
import assert from "node:assert/strict";
import { demoDeDepart, demoDepuisProfil } from "../lib/demo-icp";
import { isDemoProspect, estAdresseDeDemo, seedCampaigns, seedMeetings, seedActivities, seedProspects } from "../lib/seed";
import { nouvelleFiche } from "../lib/nouvelle-fiche";
import { apercuInscrit } from "../lib/premier-resultat";
import { useAlpha } from "../lib/store";
import { PROFIL_VIDE } from "../lib/profil-operateur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'UN INSCRIT VOIT EN PREMIER NE DÉCRIT PLUS NOTRE MARCHÉ.
 *
 * Décision du 21/10/2026 : Alpha s'adresse à n'importe quelle entreprise. Le
 * départ était le nôtre — huit promoteurs, nos prix, nos campagnes Alpha Voice
 * — et une fiche saisie à la main naissait « maîtrise d'ouvrage, Lyon,
 * 290 €/mois ». Le jeu écrit à la main reste le banc d'essai du module permis.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce qui trahit notre ancien marché ou notre offre dans une fiche. */
const NOTRE_MARCHE = /promot|permis|maîtr|sccv|lots?\b|alpha voice|eagleye|lyon/i;

const texteDe = (p: { company: string; notes: string; tags: string[]; city: string; nextStep: { action: string } | null }) =>
  [p.company, p.notes, p.city, p.tags.join(" "), p.nextStep?.action ?? ""].join(" | ");

test("la démo de départ couvre plusieurs métiers, sans un mot de notre marché", () => {
  const d = demoDeDepart();
  assert.ok(d.length >= 6);
  const metiers = new Set(d.map((p) => p.company.replace(/ \d+ \(démo\)$/, "")));
  assert.ok(metiers.size >= 5, `une démo « horizontale » sur ${metiers.size} métier(s) n'en est pas une`);
  for (const p of d) assert.doesNotMatch(texteDe(p), NOTRE_MARCHE, p.company);
});

test("les quatre garanties tiennent sur la démo de départ — et aucun montant", () => {
  for (const p of demoDeDepart()) {
    assert.ok(isDemoProspect(p.id), `${p.id} : /api/send ne le refuserait pas`);
    assert.match(p.phone ?? "", /^06 39 98 /, "tranche ARCEP réservée à la fiction");
    assert.ok(estAdresseDeDemo(p.email ?? ""), "domaine réservé RFC 2606");
    assert.match(p.company, /\(démo\)$/);
    assert.equal(p.monthlyValue + p.setupValue + p.ignoranceTax, 0, "un montant inventé entre dans le pipe pondéré");
  }
});

test("la démo de départ est déterministe (même rendu → mêmes fiches)", () => {
  assert.deepEqual(demoDeDepart(), demoDeDepart());
});

test("⚠⚠ un navigateur neuf part de la démo multi-secteurs, plus du monde « promoteurs »", () => {
  // L'état INITIAL d'abord (aucun test précédent n'a touché le store, et chaque
  // fichier de test tourne dans son propre processus), puis le « remettre la démo ».
  const initial = useAlpha.getState();
  assert.deepEqual(initial.prospects.map((p) => p.id), demoDeDepart().map((p) => p.id), "état initial");
  assert.equal(initial.campaigns.length, 0, "état initial : campagnes de démo");
  assert.equal(initial.settings.agencyName, "", "état initial : raison sociale");
  useAlpha.getState().resetToSeed();
  const s = useAlpha.getState();
  assert.deepEqual(s.prospects.map((p) => p.id), demoDeDepart().map((p) => p.id));
  for (const p of s.prospects) assert.doesNotMatch(texteDe(p), NOTRE_MARCHE);
  assert.equal(s.campaigns.length, 0, "les campagnes de démo vendaient Alpha Voice à des promoteurs");
  assert.equal(s.meetings.length, 0);
  assert.equal(s.activities.length, 0);
  assert.equal(s.competitors.length, 0);
  assert.equal(s.settings.agencyName, "", "un inscrit ne démarre plus sous notre raison sociale");
  assert.equal(s.settings.offer?.whatYouSell, "", "ni avec notre offre");
});

test("⚠ appliquer un profil retire aussi le monde de démo d'un ancien navigateur — et rien d'autre", () => {
  const vraieCampagne = { ...seedCampaigns[0], id: "c-vraie" };
  const vraiRdv = { ...seedMeetings[0], id: "m-vrai", prospectId: "vrai-1" };
  useAlpha.setState({
    prospects: [...seedProspects, { ...seedProspects[0], id: "vrai-1", company: "Vraie Boîte SAS" }],
    campaigns: [...seedCampaigns, vraieCampagne],
    meetings: [...seedMeetings, vraiRdv],
    activities: [...seedActivities],
  });
  useAlpha.getState().appliquerProfil({ ...PROFIL_VIDE, metier: "logiciel de paie", cibleSecteur: "restauration", cibleRole: "gérant" });
  const s = useAlpha.getState();
  assert.deepEqual(s.campaigns.map((c) => c.id), ["c-vraie"], "seules les campagnes de démo partent");
  assert.deepEqual(s.meetings.map((m) => m.id), ["m-vrai"], "seuls les rendez-vous de fiches de démo partent");
  assert.ok(s.prospects.some((p) => p.id === "vrai-1"), "une fiche réelle ne part jamais");
  assert.ok(!s.activities.some((a) => a.prospectId && isDemoProspect(a.prospectId)), "le journal de démo part aussi");
  assert.ok(s.prospects.filter((p) => isDemoProspect(p.id)).every((p) => /restauration/.test(p.company)));
});

test("une fiche saisie à la main ne naît plus « maîtrise d'ouvrage, Lyon, 290 €/mois »", () => {
  const f = nouvelleFiche();
  assert.equal(f.sector, "autre");
  assert.equal(f.city, "");
  assert.equal(f.monthlyValue + f.setupValue + f.ignoranceTax, 0);
  assert.equal(nouvelleFiche("  Bordeaux ").city, "Bordeaux", "la zone visée par l'inscrit, si elle est dite");
});

test("l'aperçu de valeur d'un inscrit parle de SON offre", () => {
  const { apercu, manques } = apercuInscrit({ ...PROFIL_VIDE, metier: "logiciel de paie", cibleSecteur: "restauration", cibleRole: "gérants" });
  assert.deepEqual(manques, []);
  assert.equal(apercu.offre, "logiciel de paie");
  assert.match(apercu.message, /logiciel de paie/);
  assert.doesNotMatch(`${apercu.criterion} ${apercu.angle} ${apercu.message}`, /accueil|décroch|alpha|eagleye/i);
  assert.ok(apercuInscrit(null).manques.length === 3, "un profil vide se nomme");
});

test("la démo par profil reste inchangée", () => {
  const d = demoDepuisProfil({ ...PROFIL_VIDE, cibleSecteur: "logistique", cibleRole: "DAF", cibleZone: "Rhône" });
  assert.ok(d && d.every((p) => /logistique \d+ \(démo\)$/.test(p.company) && p.city === "Rhône"));
});
