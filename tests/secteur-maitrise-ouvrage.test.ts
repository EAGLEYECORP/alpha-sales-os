import { test } from "node:test";
import assert from "node:assert/strict";
import { ORDRE_SECTEURS } from "../lib/secteurs";
import { verticalForProspect, verticalForSector, VERTICALS } from "../lib/playbook";
import { buildTemplates, type AngleKey } from "../lib/templates";
import { permisVersProspect, lirePermis } from "../lib/permis-construire";
import { PERMIS_DEMO, seedProspects } from "../lib/seed";
import type { Prospect, Sector } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MARCHÉ EN COURS EST NOMMABLE, ET LE DIRE SERT À QUELQUE CHOSE.
 *
 * ⚠ CE QUE LE REFACTOR A FERMÉ. `Sector` était resté au marché d'AVANT
 * (restauration, pubs, ambulances) quand l'avatar est devenu le maître
 * d'ouvrage à permis actif. Faute de valeur pour le dire, l'importeur de
 * permis — celui de NOTRE marché — écrivait `sector: "autre"`.
 *
 * Conséquence mesurée : `verticalForProspect` cherche TAG, puis texte, puis
 * SECTEUR. Une fiche de maîtrise d'ouvrage qui perd son tag (un aller-retour
 * par un tableur suffit) et dont les notes ne portent aucun mot-clé retombait
 * sur `verticalForSector("autre")` → la verticale GÉNÉRIQUE. Le script du
 * marché en cours existait ; il était inatteignable par le seul chemin dont
 * dispose un import plat.
 * ─────────────────────────────────────────────────────────────────────
 */

const fiche = (p: Partial<Prospect>): Pick<Prospect, "sector" | "notes"> & { tags?: string[] } => ({
  sector: "maitrise-ouvrage",
  notes: "",
  ...p,
});

test("⚠ LE TROU D'ORIGINE : sans tag ni mot-clé, le SECTEUR sert encore", () => {
  /**
   * ⚠⚠ C'EST LE TEST QUI COMPTE. Il ne vérifie pas qu'une valeur existe dans
   * une union — ça, le compilateur le fait. Il vérifie que le dernier recours
   * de `verticalForProspect` ARRIVE au bon script.
   *
   * Mutation vérifiée : remettre `sectors: []` sur la verticale
   * `maitrise-ouvrage` fait tomber ce test et lui seul.
   */
  const v = verticalForProspect(fiche({ notes: "", tags: [] }));
  assert.ok(v, "aucune verticale — la fiche n'a plus aucun script");
  assert.equal(
    v!.id,
    "maitrise-ouvrage",
    `une fiche de maîtrise d'ouvrage sans tag tombe sur « ${v!.id} » — le script du marché en cours est inatteignable`
  );
});

test("⚠ le secteur ne prend PAS le pas sur le tag", () => {
  /**
   * L'ordre reste tag → texte → secteur, et le refactor ne doit pas l'inverser.
   * Un tag est posé par un importeur, il est DÉTERMINISTE ; un secteur peut
   * venir d'une colonne de tableur remplie à la main.
   */
  const v = verticalForProspect(fiche({ sector: "maitrise-ouvrage", tags: ["restauration"] }));
  assert.equal(v?.id, "restauration", "le secteur a écrasé le tag");
});

test("⚠ L'IMPORTEUR DE PERMIS ÉCRIT LE SECTEUR, plus le fourre-tout", () => {
  /**
   * Le tag seul ne suffit pas : il ne survit pas à un export CSV puis
   * réimport, alors que la colonne « secteur » si. C'est précisément le
   * scénario qui renvoyait la fiche sur la verticale générique.
   */
  assert.ok(PERMIS_DEMO.length > 0, "aucun arrêté de démonstration — le test ne mesure rien");
  const retenus = PERMIS_DEMO.filter((p) => lirePermis(p).retenu);
  assert.ok(retenus.length > 0, "aucun arrêté retenu — extraction cassée");

  for (const p of retenus) {
    const f = permisVersProspect(p, lirePermis(p));
    assert.equal(f.sector, "maitrise-ouvrage", `${f.company} importée en « ${f.sector} »`);
  }
});

test("⚠ les fiches de démonstration portent le secteur du marché en cours", () => {
  for (const p of seedProspects) {
    assert.equal(p.sector, "maitrise-ouvrage", `${p.company} est en « ${p.sector} »`);
  }
});

test("⚠ UN SEUL SECTEUR PAR VERTICALE, ET RÉCIPROQUEMENT", () => {
  /**
   * `verticalForSector` rend la PREMIÈRE verticale qui revendique le secteur.
   * Deux verticales sur le même secteur feraient donc dépendre le script de
   * l'ordre de déclaration dans le tableau — un tri anodin changerait ce qu'on
   * dit au téléphone, sans que rien ne tombe.
   */
  const vus = new Map<Sector, string>();
  for (const v of VERTICALS) {
    for (const s of v.sectors) {
      const deja = vus.get(s);
      assert.ok(!deja, `« ${s} » revendiqué par ${deja} ET ${v.id} — le script dépendrait de l'ordre du tableau`);
      vus.set(s, v.id);
    }
  }
  // Non-vacuité : un tableau vide passerait cette boucle sans rien comparer.
  assert.ok(vus.size >= 5, `extraction cassée : ${vus.size} secteur(s) revendiqué(s)`);
  for (const s of ORDRE_SECTEURS) {
    assert.ok(verticalForSector(s), `« ${s} » ne mène à aucune verticale — une fiche sans tag n'a aucun script`);
  }
});

test("⚠⚠ AUCUN GABARIT « APPELS MANQUÉS » N'EST ENGENDRÉ POUR LA MAÎTRISE D'OUVRAGE", () => {
  /**
   * ⚠⚠ LE PIÈGE QUE CE REFACTOR A FAILLI TOMBER DEDANS.
   *
   * `AngleKey` s'écrivait `Exclude<Sector, "autre"> | …`. Ce couplage affirmait
   * que TOUT secteur de l'app a un angle d'appel manqué. Ajouter
   * « maitrise-ouvrage » à `Sector` aurait donc FORCÉ, sous peine d'erreur de
   * compilation, l'écriture d'un angle d'appels manqués pour la maîtrise
   * d'ouvrage — c'est-à-dire exactement l'interdit numéro un de sa verticale.
   * Le type aurait exigé le mensonge.
   *
   * Ces gabarits font dire, mot pour mot : « des {lossUnit} qui vont chez le
   * concurrent qui répond », « mettre vos horaires à jour partout ». C'est la
   * famille ACCUEIL TÉLÉPHONIQUE / VISIBILITÉ LOCALE, et elle est fausse ici.
   *
   * Le garde ne cherche pas une chaîne : il croise les deux côtés. Tout secteur
   * dont la verticale porte un interdit EXÉCUTABLE doit être absent de la
   * bibliothèque de gabarits.
   */
  const gabarits = buildTemplates();
  assert.ok(gabarits.length > 20, `extraction cassée : ${gabarits.length} gabarit(s)`);
  const servis = new Set<AngleKey>(gabarits.map((g) => g.sector));

  const interdits = VERTICALS.filter((v) => v.forbidden.some((f) => f.motif));
  assert.ok(interdits.length > 0, "aucune verticale ne porte d'interdit exécutable — le test ne mesure rien");

  for (const v of interdits) {
    for (const s of v.sectors) {
      assert.ok(
        !servis.has(s as AngleKey),
        `des gabarits sont engendrés pour « ${s} », dont la verticale ${v.id} interdit l'argument qu'ils portent`
      );
    }
  }

  // Et le cas nommé, pour que l'échec soit lisible sans dérouler la boucle.
  assert.ok(!servis.has("maitrise-ouvrage" as AngleKey), "un gabarit d'appels manqués vise la maîtrise d'ouvrage");
});
