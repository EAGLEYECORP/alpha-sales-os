import test from "node:test";
import assert from "node:assert/strict";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";
import { CONFIGURATION_ALPHA_VEND_ALPHA as C } from "../lib/alpha-vend-alpha";
import { dansLaCible, ETAT_AUTOPILOTE_VIDE, planifier, premierMessage } from "../lib/autopilote-inscrit";
import { reglagesServeur } from "../lib/pilote-serveur";
import { codeNafValide } from "../lib/naf";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA CIBLE DU PILOTE, ET LE CHANGEMENT DE CIBLE (05/11/2026).
 *
 * Décision de Zakaria : la verticale est le BTP qui vit de commerciaux sur
 * le terrain. Le premier message NOMME la cible ; les fiches trouvées pour
 * l'ancienne (agences immobilières) restent dans le pipe et ne doivent pas
 * recevoir un message adressé au BTP.
 * ─────────────────────────────────────────────────────────────────────
 */

const MARDI_10H = new Date("2026-11-03T09:00:00Z");
const fiche = (o: Partial<Prospect>): Prospect =>
  ({ ...prospectDefaults, name: "", sector: "autre", city: "Lyon", stage: "prospect", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", ...o }) as Prospect;

test("la cible du maître : BTP à équipes terrain, 10 salariés ou plus, codes NAF réels", () => {
  assert.deepEqual(C.autopilote.activites, ["41.20A", "43.32A", "43.22B", "43.29A", "43.91B"]);
  for (const c of C.autopilote.activites) assert.ok(codeNafValide(c), `${c} n'est pas un code NAF de la table INSEE`);
  assert.equal(C.autopilote.taille, "10-plus");
  assert.match(C.profil.cibleSecteur, /BTP/);
});

test("⚠⚠ le premier message dit la cible BTP, et ne promet que ce qu'ALPHA fait", () => {
  const m = premierMessage(fiche({ id: "a", company: "MENUISERIE A (DÉMO)", email: "contact@menuiserie-a.example" }), { accountId: "eagleye", agencyName: C.agencyName }, { profil: C.profil, agencyName: C.agencyName, city: C.ville });
  assert.match(m.body, /je m'adresse aux dirigeants \(BTP, équipes commerciales terrain\)/);
  assert.ok(m.body.includes(`Est-ce qu'${C.profil.metier}, c'est un sujet chez vous en ce moment ?`));
  assert.doesNotMatch(m.body, /je travaille avec|nos clients|garanti/i);
});

test("dansLaCible : un code d'activité hors cible écarte, l'absence de code laisse passer", () => {
  const r = { activites: C.autopilote.activites };
  assert.equal(dansLaCible({ tags: ["registre", "naf-68.31Z"] }, r), false);
  assert.equal(dansLaCible({ tags: ["registre", "naf-43.32A"] }, r), true);
  assert.equal(dansLaCible({ tags: ["import"] }, r), true);
});

test("⚠⚠ après le changement de cible, une ancienne fiche n'est ni écrite ni enrichie — une fiche de la cible l'est", () => {
  const reglages = reglagesServeur(true, {});
  const immo = fiche({ id: "immo", company: "AGENCE (DÉMO)", email: "contact@agence.example", tags: ["registre", "naf-68.31Z"] });
  const btp = fiche({ id: "btp", company: "MENUISERIE (DÉMO)", email: "contact@menuiserie.example", tags: ["registre", "naf-43.32A"], createdAt: "2026-10-02T00:00:00.000Z" });
  const plan = planifier([immo, btp], reglages, ETAT_AUTOPILOTE_VIDE, { boite: true, cleDropcontact: true, lectureSite: true }, MARDI_10H);
  assert.equal(plan.ecrire, "btp");
  const seule = planifier([immo], reglages, ETAT_AUTOPILOTE_VIDE, { boite: true, cleDropcontact: true, lectureSite: true }, MARDI_10H);
  assert.equal(seule.ecrire, null, "une agence immobilière ne reçoit pas un message adressé au BTP");
  const sansEmail = fiche({ id: "immo2", tags: ["registre", "a-joindre", "naf-68.31Z"], siren: "000000018" });
  const p2 = planifier([sansEmail], reglages, ETAT_AUTOPILOTE_VIDE, { boite: true, cleDropcontact: true }, MARDI_10H);
  assert.deepEqual(p2.lancerEnrichissement, [], "on ne dépense pas un crédit Dropcontact sur l'ancienne cible");
});
