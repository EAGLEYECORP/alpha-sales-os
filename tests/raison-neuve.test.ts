import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AUCUNE_RAISON, OUVERTURE_FRAICHE_JOURS, raisonNeuve } from "../lib/raison-neuve";
import { PRIX_HONORE_JUSQU_AU } from "../lib/grille-perimee";
import { prospectDefaults } from "../lib/seed";
import { VERTICALS } from "../lib/playbook";
import type { Prospect } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA RÈGLE ÉTAIT ÉNONCÉE CINQ FOIS ET PRODUITE ZÉRO FOIS — 17/09/2026.
 *
 * « Revenir avec une raison NEUVE, jamais “je me permets de relancer” » est
 * écrit dans `master-rappel`, `priorites`, `reactivite`, `vital-signs` et
 * `business-rules`. Aucun des cinq n'en fabrique une : `master-rappel` en
 * liste les formes EN PROSE et s'arrête là.
 *
 * Conséquence sur l'écran du matin : « Revenir avec une raison NEUVE —
 * <société> » s'affiche à quelqu'un qui n'en a aucune. Il écrira donc « je me
 * permets de relancer » — la phrase exacte que la règle interdit, produite PAR
 * la règle faute d'alternative.
 * ─────────────────────────────────────────────────────────────────────
 */

const AVANT = Date.parse("2026-09-20T09:00:00.000Z");
const APRES = Date.parse("2026-11-02T09:00:00.000Z");

/** Une fiche endormie, chiffrée sur la grille morte — l'état des 3 vraies. */
const fiche = (patch: Partial<Prospect> = {}): Prospect => ({
  ...prospectDefaults,
  id: "demo-test",
  name: "Contact (démo)",
  company: "Client (démo)",
  sector: "maitrise-ouvrage",
  city: "Lyon",
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-07-09T10:00:00.000Z",
  stage: "offre",
  setupValue: 990,
  monthlyValue: 115,
  events: [{ id: "e1", date: "2026-07-09T10:00:00.000Z", kind: "appel", summary: "échange" }],
  ...patch,
});

test("⚠⚠ UNE FICHE ENDORMIE AU PRIX MORT A UNE RAISON, ET ELLE EST VRAIE", () => {
  const r = raisonNeuve(fiche(), AVANT);
  assert.ok(r, "la grille a changé : c'est un fait daté, donc une raison");
  assert.equal(r.source, "prix-honore");
  assert.match(r.fait, /\d{2}\/\d{2}\/\d{4}/, "le fait porte une DATE — sans elle, ce n'est qu'une formule");
  assert.equal(r.provenance, "lib/grille-perimee.ts", "une raison sans provenance se périme en silence");
});

test("⚠⚠ ZÉRO FAIT → ZÉRO RAISON, et on le DIT", () => {
  /**
   * La règle de la boucle de mesure appliquée à une phrase. Une raison
   * FABRIQUÉE est pire que pas de raison : le prospect entend un prétexte, et
   * un prétexte ne se rejoue pas une deuxième fois.
   *
   * ⚠ Et `AUCUNE_RAISON` ne se contente pas de constater : elle dit de NE PAS
   * relancer. Un écran qui affiche « Revenir avec une raison NEUVE » puis se
   * tait revient à demander d'en inventer une.
   */
  const aJour = fiche({ setupValue: 1490, monthlyValue: 149 });
  assert.equal(raisonNeuve(aJour, AVANT), null);
  assert.match(AUCUNE_RAISON, /ne relance pas|attends/i, "elle doit ARRÊTER, pas seulement informer");
});

test("⚠ L'ÉCHÉANCE PASSÉE RETIRE LA RAISON — elle ne la transforme pas", () => {
  /**
   * Après le 17/10, « votre tarif tient » devient faux. Une raison qui survit
   * à son fait est exactement le prétexte qu'on refuse.
   */
  assert.equal(raisonNeuve(fiche(), APRES), null);
  assert.ok(Date.parse(PRIX_HONORE_JUSQU_AU) < APRES, "le jeu d'essai doit bien encadrer l'échéance");
});

test("⚠⚠ UNE OUVERTURE EST UNE RAISON, MAIS ELLE NE SE DIT PAS", () => {
  /**
   * « J'ai vu que vous aviez ouvert mon message » est VRAI et sonne fliqué —
   * le même interdit que citer son permis à froid. Le fait sert à choisir le
   * MOMENT, jamais à ouvrir la conversation.
   */
  const aJour = fiche({ setupValue: 1490, monthlyValue: 149 });
  const r = raisonNeuve(aJour, AVANT, { derniereOuverture: "2026-09-19T09:00:00.000Z" });
  assert.equal(r?.source, "il-a-ouvert");
  assert.ok(!/ouvert|cliqué|consulté/i.test(r!.phrase), `la phrase ne doit pas citer l'observation : « ${r!.phrase} »`);
  assert.match(r!.fait, /Ouverture|clic/i, "…mais le FAIT, lui, le dit — il sert à décider");

  // Trop vieille : « pendant que le sujet est frais » deviendrait faux.
  const vieille = new Date(AVANT - (OUVERTURE_FRAICHE_JOURS + 3) * 86_400_000).toISOString();
  assert.equal(raisonNeuve(aJour, AVANT, { derniereOuverture: vieille }), null);
});

test("⚠ LE PRIX PASSE DEVANT L'OUVERTURE — on ouvre sur ce qu'on DONNE", () => {
  /**
   * L'ordre n'est pas arbitraire : le prix APPORTE quelque chose au prospect,
   * l'ouverture ne lui apprend rien et le met en position de se justifier.
   */
  const r = raisonNeuve(fiche(), AVANT, { derniereOuverture: "2026-09-19T09:00:00.000Z" });
  assert.equal(r?.source, "prix-honore");
});

test("⚠⚠ AUCUNE PHRASE NE CONTIENT LA FORMULE INTERDITE, NI UN MONTANT", () => {
  /**
   * ══ LE SIXIÈME TEXTE, ENCORE ══
   *
   * Ces phrases se PRONONCENT ou s'écrivent à un prospect. Le dépôt a déjà
   * payé une fois d'avoir oublié qu'un `pitch` entre guillemets est un texte
   * que personne ne relit.
   *
   * Deux interdits ici :
   * · « je me permets de relancer » — la formule que toute la doctrine refuse,
   *   et que ce module existe précisément pour remplacer ;
   * · un MONTANT — le prix se redit de vive voix, jamais dans un message qui
   *   se transfère. Un chiffre écrit se retrouve cité hors de son périmètre.
   */
  const cas = [
    raisonNeuve(fiche(), AVANT),
    raisonNeuve(fiche({ setupValue: 1490, monthlyValue: 149 }), AVANT, {
      derniereOuverture: "2026-09-19T09:00:00.000Z",
    }),
  ];
  for (const r of cas) {
    assert.ok(r, "les deux sources doivent produire quelque chose");
    assert.ok(!/je me permets|je me permet/i.test(r.phrase), `formule interdite : « ${r.phrase} »`);
    /**
     * ⚠ LE MOTIF A DÛ ÊTRE RESSERRÉ LE JOUR MÊME : écrit d'abord `\d{3,}`, il
     * a fait tomber ma propre phrase sur « jusqu'au 17/10/2026 » — une DATE,
     * qui est justement ce qui rend la raison défendable. Un garde qui refuse
     * une phrase juste est un garde qu'on assouplit au mauvais endroit la fois
     * suivante ; on retire les dates AVANT de chercher un montant.
     */
    const sansDates = r.phrase.replace(/\b\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}\b/g, "");
    assert.ok(
      !/\d[\d\s  ]*\s*€|\beuros?\b|\bHT\b/i.test(sansDates) && !/\d{3,}/.test(sansDates),
      `aucun montant dans un message : « ${r.phrase} »`,
    );
  }
});

test("⚠⚠ AUCUNE PHRASE NE DÉCLENCHE UN INTERDIT DE VERTICALE", () => {
  /**
   * Croisé contre les motifs EXÉCUTABLES des verticales, pas contre une liste
   * réécrite ici — deux listes divergeraient, et c'est celle qu'on ne relit
   * pas qui cesserait de mordre. C'est la garde de `playbook-interdits`,
   * appliquée à un texte qu'elle ne connaissait pas.
   */
  const phrases = [
    raisonNeuve(fiche(), AVANT)!.phrase,
    raisonNeuve(fiche({ setupValue: 1490, monthlyValue: 149 }), AVANT, {
      derniereOuverture: "2026-09-19T09:00:00.000Z",
    })!.phrase,
    AUCUNE_RAISON,
  ];
  for (const v of VERTICALS) {
    for (const i of v.forbidden ?? []) {
      if (!i.motif) continue; // interdit de JUGEMENT : pas de motif exécutable
      for (const phrase of phrases) {
        assert.ok(
          !i.motif.test(phrase),
          `verticale ${v.id} — « ${i.regle} » déclenché par : « ${phrase} »`,
        );
      }
    }
  }
});

test("⚠⚠ LA RAISON EST BRANCHÉE LÀ OÙ L'INJONCTION S'AFFICHE", () => {
  /**
   * Le test qui empêche ce module de devenir le SIXIÈME endroit qui énonce la
   * règle sans la produire. `priorites.ts` est l'écran du matin : c'est là que
   * « Revenir avec une raison NEUVE » se lit, donc là que la raison doit
   * arriver.
   *
   * ⚠ On cherche l'APPEL, pas l'import : un import inutilisé passe un grep et
   * laisse l'écran muet — le défaut mesuré aujourd'hui même sur la garde du
   * cadrage.
   */
  const src = readFileSync(join(process.cwd(), "lib/priorites.ts"), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );
  assert.match(src, /raisonNeuve\(/, "l'écran du matin doit APPELER la raison");
  assert.match(src, /AUCUNE_RAISON/, "…et servir l'absence de raison quand il n'y en a pas");
});

test("⚠ LA RÈGLE N'EST PAS RÉÉCRITE UNE SIXIÈME FOIS", () => {
  /**
   * Cinq modules l'énoncent déjà. Ce module la PRODUIT — il n'a aucune raison
   * de redéclarer une liste de formes acceptables, qui divergerait de celle
   * de `master-rappel` au premier ajustement.
   */
  const fichiers = readdirSync(join(process.cwd(), "lib")).filter((f) => f.endsWith(".ts"));
  const producteurs = fichiers.filter((f) =>
    /export function raisonNeuve|export const RAISONS_NEUVES/.test(
      readFileSync(join(process.cwd(), "lib", f), "utf8"),
    ),
  );
  assert.deepEqual(producteurs, ["raison-neuve.ts"], "une seule source produit la raison");
});
