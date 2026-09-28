import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INTERDICTIONS_SECTORIELLES,
  interdictionPour,
  motifDuRefus,
  secteursInterditsDans,
} from "../lib/secteurs-interdits";
import { auditScript, buildVoiceScript, DISCLOSURE_REQUIREMENTS } from "../lib/voice-script";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE GARDE QUI MANQUAIT : « a-t-on le DROIT d'appeler ce secteur ? »
 *
 * Tout le moteur de conformité vérifiait COMMENT on démarche (mentions,
 * marque, art. 50) et QUAND (décret n° 2022-1313). Jamais SI.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Un script d'appel à froid par ailleurs PARFAIT — toutes mentions incluses. */
function scriptConforme(sujet: string): string {
  const base = buildVoiceScript({
    mode: "prospection-b2b",
    company: "ACME",
    onBehalfOf: "ACME",
    agentName: "Alpha",
  });
  return `${base}\n${sujet}`;
}

test("⚠⚠ UN SCRIPT PAR AILLEURS PARFAIT EST REFUSÉ S'IL VISE UN SECTEUR INTERDIT", () => {
  /**
   * C'est tout le sujet du module. Avant lui, ce script passait l'audit EN
   * ENTIER : mentions présentes, article 50 prononcé, cadence sous le plafond
   * — et une infraction au bout du fil. Le client prend l'amende, avec notre
   * outil, en ayant lu « conforme » sur notre écran.
   */
  const r = auditScript(scriptConforme("Je vous appelle au sujet du financement CPF de vos salariés."), {
    mode: "prospection-b2b",
  });
  assert.equal(r.ok, false, "un démarchage CPF doit être refusé");
  assert.ok(
    r.manquantes.some((m) => /2022-1587/.test(m)),
    "le refus doit NOMMER le texte — « non conforme » sans référence envoie chercher à l'aveugle",
  );
  assert.ok(
    r.manquantes.some((m) => /Ce qui reste possible/.test(m)),
    "un refus sans issue se contourne : il doit dire ce qui reste légal",
  );
});

/** Ce que le garde SECTORIEL ajoute, isolé des autres exigences. */
function refusSectoriels(script: string, mode: "prospection-b2b" | "rappel-entrant"): string[] {
  return auditScript(script, { mode }).manquantes.filter((m) => /Script refusé/.test(m));
}

test("⚠ le même script SANS le secteur interdit n'ajoute RIEN — le garde ne mord pas au hasard", () => {
  /**
   * Contre-test obligatoire : un garde qui refuse tout satisferait le test
   * précédent en rendant le produit inutilisable.
   *
   * ⚠ On mesure le DELTA, pas `ok`. Première rédaction : j'exigeais `ok:true`
   * sur une fixture minimale, et elle tombait sur une exigence d'appel à froid
   * PRÉEXISTANTE (« aucune explication technique »). Le test accusait mon
   * garde d'un refus qui ne venait pas de lui — un test qui désigne le mauvais
   * coupable fait « corriger » du code correct.
   */
  assert.deepEqual(
    refusSectoriels(scriptConforme("Je vous appelle au sujet de vos rendez-vous non honorés."), "prospection-b2b"),
    [],
    "un démarchage licite ne doit recevoir AUCUN refus sectoriel",
  );
});

test("les trois secteurs sont détectés, chacun par une formulation MÉTIER", () => {
  const cas: Array<[string, string]> = [
    ["financement CPF", "formation-cpf"],
    ["compte personnel de formation", "formation-cpf"],
    ["travaux de rénovation énergétique", "renovation-energetique"],
    ["une pompe à chaleur", "renovation-energetique"],
    ["MaPrimeRénov", "renovation-energetique"],
    ["votre contrat d'assurance", "assurance"],
    ["une complémentaire santé", "assurance"],
  ];
  for (const [phrase, id] of cas) {
    const trouve = secteursInterditsDans(`Bonjour, je vous appelle pour ${phrase}.`);
    assert.ok(trouve.length > 0, `« ${phrase} » doit déclencher une règle`);
    assert.equal(trouve[0].interdiction.id, id, `« ${phrase} » → ${id}`);
  }
});

test("⚠ LES MOTS ORDINAIRES NE DÉCLENCHENT RIEN — un garde trop large finit désarmé", () => {
  /**
   * La leçon déjà payée deux fois par `InterditFroid` : un motif approximatif
   * refuse des scripts corrects, on l'assouplit, et il ne sert plus à rien.
   * « formation », « énergie », « assurer » sont du vocabulaire courant.
   */
  const innocents = [
    "Je vous appelle au sujet de la formation de vos commerciaux.",
    "On veut assurer un suivi régulier de vos demandes.",
    "Votre facture d'énergie augmente, mais ce n'est pas mon sujet.",
    "Je peux vous garantir un rendez-vous sous 48 heures.",
    "Nous travaillons avec des cabinets de santé.",
  ];
  for (const phrase of innocents) {
    assert.deepEqual(
      secteursInterditsDans(phrase),
      [],
      `« ${phrase} » est une phrase légitime et ne doit RIEN déclencher`,
    );
  }
});

test("⚠⚠ LE GARDE NE S'ARME QUE SUR LA PROSPECTION — pas sur un rappel consenti", () => {
  /**
   * Dans ces secteurs, le rappel d'un lead consenti est exactement ce qui
   * RESTE légal, et c'est là qu'est l'argent. Le bloquer retirerait au client
   * sa seule activité licite — et le garde se ferait débrancher dans la
   * semaine, emportant les deux autres contrôles avec lui.
   */
  const script = scriptConforme("Vous avez demandé un devis de rénovation énergétique, je vous rappelle.");
  assert.equal(refusSectoriels(script, "prospection-b2b").length, 1, "en démarchage : refusé");
  assert.deepEqual(refusSectoriels(script, "rappel-entrant"), [], "en rappel entrant : aucun refus sectoriel");
});

test("⚠ LE NIVEAU DE PREUVE VOYAGE AVEC LA RÈGLE — rien n'est présenté comme vérifié", () => {
  /**
   * Aucun de ces textes n'a été ouvert : le proxy refuse la récupération de
   * page. La même discipline que `lib/references.ts` impose aux sources
   * extérieures. Ce qui serait irresponsable n'est pas d'écrire une règle non
   * vérifiée — c'est de la laisser manquer, ou de la dire vérifiée.
   */
  for (const i of INTERDICTIONS_SECTORIELLES) {
    assert.equal(
      i.verification,
      "non-verifiee",
      `${i.id} : tant qu'aucun juriste n'a confirmé, le champ reste « non-verifiee »`,
    );
    assert.match(i.texte, /\d{4}/, `${i.id} : le texte doit être nommé avec son année, jamais « la loi »`);
    assert.ok(i.alternative.length > 40, `${i.id} : une interdiction sans issue écrite se contourne`);
  }
  // Et la réserve REMONTE jusqu'à l'humain, pas seulement dans le type.
  const a = secteursInterditsDans("financement CPF")[0];
  assert.match(motifDuRefus(a), /non vérifiée/i, "la réserve doit être dans le message affiché");
});

test("interdictionPour : trouve par id, et rend null sans inventer", () => {
  assert.equal(interdictionPour("formation-cpf")?.portee, "interdiction");
  assert.equal(interdictionPour("assurance")?.portee, "consentement-prealable");
  assert.equal(interdictionPour("plomberie"), null, "un secteur libre ne doit porter aucune règle fantôme");
});

test("⚠ le garde est BRANCHÉ dans auditScript — pas seulement exporté", () => {
  // Le défaut récurrent du dépôt. Un module de conformité que la porte
  // d'envoi n'appelle pas ne protège personne, et il a l'air fait.
  const src = readFileSyncSafe("lib/voice-script.ts");
  assert.match(src, /secteursInterditsDans\(script\)/, "auditScript doit interroger le module");
  assert.match(src, /motifDuRefus\(/, "et servir le motif nommé, pas un verdict nu");
  // Contre-preuve par le comportement, pas seulement par le texte.
  assert.ok(DISCLOSURE_REQUIREMENTS.length > 0);
});

function readFileSyncSafe(rel: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("node:fs").readFileSync(require("node:path").join(process.cwd(), rel), "utf8");
}
