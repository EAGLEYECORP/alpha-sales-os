import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ORDRE_SECTEURS } from "../lib/secteurs";
import { verticalForProspect, verticalForSector, VERTICALS } from "../lib/playbook";
import { buildTemplates, type AngleKey } from "../lib/templates";
import { emailBody, emailSubject } from "../lib/mail-compose";
import { inviteText } from "../lib/linkedin-sequence";
import { messageCourt } from "../lib/approche-ecrite";
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

test("⚠⚠ LES MESSAGES DE LA FICHE NE DISENT PAS L'INTERDIT DE LA VERTICALE", () => {
  /**
   * ⚠⚠ CE QUE CE GARDE A ATTRAPÉ, ET QU'AUCUN TEST NE VOYAIT.
   *
   * L'onglet « messages » d'une fiche portait SES TROIS textes en dur, écrits
   * pour le marché d'avant :
   *  · « Pendant que {société} est fermé, vos futurs clients cherchent — et
   *    trouvent le concurrent qui répond » ;
   *  · « j'ai préparé une maquette de {société} sur mobile » ;
   *  · « j'ai étudié la présence en ligne de {société} (note, avis,
   *    réactivité) ».
   * Servis à une SCCV qui construit soixante-huit logements, les trois
   * annoncent qu'on n'a pas regardé à qui on écrit — et le premier prononce
   * exactement l'interdit numéro un de la verticale.
   *
   * ⚠ Le test ne cherche PAS ces phrases-là : il croise les DEUX côtés. Il
   * construit les messages que la fiche propose réellement, pour une vraie
   * fiche du marché en cours, et il les passe dans les motifs EXÉCUTABLES de
   * sa propre verticale. Une reformulation de bonne foi tombe donc aussi —
   * c'est la seule chose qui arrive vraiment.
   */
  /**
   * ⚠ CE BLOC EXISTE PARCE QUE LE RESTE DU TEST A UN TROU, et le dire vaut
   * mieux que le laisser. Les assertions ci-dessous portent sur les MODULES.
   * Si une session future recopie du texte en dur dans l'écran — le geste
   * exact qui a créé le défaut — elles resteraient muettes : l'écran
   * n'appellerait simplement plus les modules qu'on vérifie.
   *
   * On vérifie donc aussi que l'écran les APPELLE. C'est faible (un motif,
   * sur un nom de fonction), et ça ne prétend pas plus ; mais c'est le seul
   * lien entre « le module dit vrai » et « c'est ce module qui parle ».
   */
  const ecran = readFileSync(join(process.cwd(), "app/(app)/prospects/[id]/page.tsx"), "utf8");
  for (const appel of ["emailBody(", "inviteText(", "messageCourt("]) {
    assert.ok(
      ecran.includes(appel),
      `la fiche n'appelle plus ${appel} — si elle écrit ses messages elle-même, ils redeviendront ceux du marché d'avant`
    );
  }

  const fiche = seedProspects[0];
  assert.ok(fiche, "aucune fiche de démonstration — le test ne mesure rien");

  const v = verticalForProspect(fiche);
  assert.equal(v?.id, "maitrise-ouvrage", `la fiche témoin est routée sur « ${v?.id} »`);

  const motifs = v!.forbidden.filter((f) => f.motif);
  assert.ok(motifs.length > 0, "la verticale ne porte aucun interdit exécutable — le test ne mesure rien");

  const messages: Array<[string, string]> = [
    ["objet email", emailSubject(fiche)],
    ["corps email", emailBody(fiche, { closerName: "Zakaria" })],
    ["message court", messageCourt(fiche)],
    ["invitation LinkedIn", inviteText(fiche)],
  ];

  for (const [ou, texte] of messages) {
    assert.ok(texte.trim().length > 20, `${ou} : vide ou tronqué (${texte.length} car.)`);
    for (const f of motifs) {
      assert.doesNotMatch(texte, f.motif!, `${ou} prononce un interdit de la verticale — « ${f.regle} »\n${texte}`);
    }
  }
});
