import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  BAREME_NEUTRE,
  COMPTE_DE_LA_FAMILLE,
  REV_SHARE_PCT,
  SEUIL_NUWACOM_HT,
  chiffrer,
  palierAlphaVoice,
  type BaremeCompte,
  type FamilleOffre,
} from "../lib/calculateur-offres";
import {
  ALPHA_VOICE_PALIERS,
  ALPHA_VOICE_SETUP_HT,
  ESSAI_HT,
  PACK_MONTHLY_HT,
  PACK_SETUP_HT,
} from "../lib/offres-publiques";
import { baremesPourCalculateur, type BaremeDerive } from "../lib/accounts-commercial";
import { getAccount } from "../lib/accounts";
import { BRICKS, outboundPrice } from "../lib/bricks";

const RACINE = process.cwd();

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

function fichiersSources(dirs: string[]): string[] {
  const out: string[] = [];
  const visite = (d: string) => {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f.startsWith(".")) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) visite(p);
      else if (/\.tsx?$/.test(p)) out.push(p);
    }
  };
  for (const d of dirs) visite(join(RACINE, d));
  return out;
}

/** Les barèmes réels, dérivés comme la route les sert. */
const BAREMES: BaremeDerive[] = baremesPourCalculateur((id) => getAccount(id).name);
const briques = BRICKS.map((b) => ({ id: b.id, label: b.label, setupHT: b.setupHT, monthlyHT: b.monthlyHT }));
const opts = { briques, baremes: BAREMES };

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES DEUX « 30 % » NE SE MÉLANGENT JAMAIS.
 *
 * C'est la règle que CLAUDE.md pose en encadré, et la seule que ce module
 * puisse casser silencieusement :
 *
 *   · le taux d'un COMPTE = ce qui NOUS revient (100 % chez EAGLEYE — c'est
 *     notre société, il n'y a personne à qui reverser) ;
 *   · les 30 % de l'offre commerciale = un PRIX facturé au client sur SON CA.
 *
 * Une ligne « 30 % du CA généré » doit donc facturer 30 % du CA au client ET
 * nous rendre 100 % de cette somme. Si un jour quelqu'un « corrige » ça en
 * appliquant 30 % à notre part, la prévision de trésorerie perd deux tiers de
 * son montant sans qu'aucun test ne tombe — sauf celui-ci.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ le rev-share est un PRIX au client, pas une commission reversée", () => {
  const r = chiffrer({ caMensuelGenere: 100_000, setupRevShare: 5_000 }, opts);
  const l = r.lignes.find((x) => x.famille === "alpha-revshare")!;

  assert.equal(l.clientMensuelHT, 30_000, `le client paie ${REV_SHARE_PCT} % de son CA`);
  assert.equal(l.nousMensuelHT, 30_000, "et ces 30 % nous reviennent ENTIÈREMENT : EAGLEYE est à 100 %");
  assert.equal(l.clientSetupHT, 5_000);
  assert.equal(l.nousSetupHT, 5_000);
  assert.match(l.detail, /PRIX facturé au client/, "le détail doit lever l'ambiguïté à l'écran");
});

test("⚠ Alpha Voice : le client paie le prix public, et TOUT nous revient", () => {
  /**
   * Cette ligne rendait 30 % du setup et 10 % du mensuel — la part qui nous
   * revenait comme INTERMÉDIAIRE. Nous ne le sommes plus : l'offre est à nous.
   *
   * Le test garde la même forme parce que c'est la même question qui doit
   * rester posée : « ce que le client paie » et « ce qui nous revient » sont
   * deux nombres distincts, et le module ne doit jamais les confondre. Ici ils
   * se trouvent égaux — parce que le taux vaut 100, pas parce qu'on les a
   * confondus. C'est ce que la dernière assertion vérifie.
   */
  const r = chiffrer({ alphaVoiceMinutes: 1000 }, opts);
  const l = r.lignes.find((x) => x.famille === "alpha-voice")!;
  const palier = ALPHA_VOICE_PALIERS.find((p) => p.minutes === 1000)!;

  assert.equal(l.clientSetupHT, ALPHA_VOICE_SETUP_HT, "le client paie le prix public");
  assert.equal(l.clientMensuelHT, palier.prixHT);
  assert.equal(l.nousSetupHT, ALPHA_VOICE_SETUP_HT, "100 % : personne à qui reverser");
  assert.equal(l.nousMensuelHT, palier.prixHT);

  // Le compte qui porte la ligne est bien le nôtre — c'est ÇA qui a changé.
  assert.equal(COMPTE_DE_LA_FAMILLE["alpha-voice"], "eagleye");
});

test("Nuwacom — 15 % sur le devis, mais 100 % de la maintenance", () => {
  const r = chiffrer({ chantierHT: 60_000, maintenanceMensuelleHT: 2_000 }, opts);
  const l = r.lignes.find((x) => x.famille === "nuwacom")!;

  assert.equal(l.clientSetupHT, 60_000);
  assert.equal(l.nousSetupHT, 9_000, "15 % de 60 000");
  assert.equal(l.clientMensuelHT, 2_000);
  assert.equal(
    l.nousMensuelHT,
    2_000,
    "la maintenance revient à 100 % : c'est là qu'est la rente du chantier, pas dans les 15 %"
  );

  // Sur un an, la maintenance dépasse déjà les 15 % du devis. C'est le point
  // qu'on perd de vue quand on ne regarde que le pourcentage.
  assert.ok(2_000 * 12 > 9_000);
});

test("un chantier SOUS le seuil doit rester chez nous, et le calculateur le dit", () => {
  const r = chiffrer({ chantierHT: SEUIL_NUWACOM_HT - 5_000 }, opts);
  assert.match(
    r.alertes.join(" "),
    /sous le seuil/i,
    "passer un petit chantier à Nuwacom coûte 85 % du devis — ça doit être dit"
  );
  // Au-dessus du seuil, pas d'alerte de routage.
  const gros = chiffrer({ chantierHT: SEUIL_NUWACOM_HT + 5_000 }, opts);
  assert.doesNotMatch(gros.alertes.join(" "), /sous le seuil/i);
});

test("le plancher Nuwacom est annoncé comme un plancher, pas comme un tarif", () => {
  const r = chiffrer({ chantierHT: 80_000 }, opts);
  assert.match(r.alertes.join(" "), /PLANCHER/, "15 % est le minimum, pas le prix");
  assert.match(r.alertes.join(" "), /APRÈS le cadrage/, "et le contrat se dresse après — c'est le levier");
});

/**
 * ⚠ ZÉRO DONNÉE → ZÉRO CHIFFRE. Une offre sur devis ne vaut pas 0 € : elle
 * n'est pas chiffrée. Un total qui l'absorbe annonce un devis faux, et ça se
 * découvre devant le client.
 */
test("les offres sur devis ne rentrent JAMAIS dans un total", () => {
  const r = chiffrer({ vip: true, surDevis: ["os-personnalise", "visibilite"] }, opts);

  assert.equal(r.client.setupHT, PACK_SETUP_HT, "seul le VIP est compté");
  assert.equal(r.client.mensuelHT, PACK_MONTHLY_HT);
  assert.equal(r.aChiffrerAuCadrage.length, 2);
  assert.match(r.alertes.join(" "), /PAS dans les totaux/i);

  for (const l of r.lignes.filter((x) => x.famille !== "alpha-vip")) {
    assert.equal(l.clientSetupHT, null, `${l.label} ne doit pas valoir 0 €`);
    assert.equal(l.nousSetupHT, null);
  }
});

/**
 * ⚠ LE DÉFAUT QUE J'AI ÉCRIT PUIS SUPPRIMÉ, ET QUI JUSTIFIE CE TEST.
 *
 * J'avais recodé le prix des appels sortants dans le calculateur — sous un
 * commentaire affirmant qu'il ne fallait pas deux arithmétiques du même prix.
 * Il divergeait au-delà de 4 000 appels : 2 184 € au lieu de 2 548 € pour
 * 8 000. Le palier 4 000 est volontairement cassé (le 4e millier est offert)
 * et le vrai calcul gère le dépassement du dernier palier.
 *
 * Le prix vient donc de `/api/catalogue` (qui appelle `outboundPrice`) et
 * entre par la sélection. Ce test vérifie que le calculateur le CONSOMME sans
 * le retoucher — et qu'il refuse de chiffrer si on ne le lui donne pas.
 */
test("le prix des appels sortants est consommé, jamais recalculé", () => {
  const prix = outboundPrice(8_000).monthlyHT;
  const r = chiffrer({ appelsParMois: 8_000, sortantMensuelHT: prix }, opts);
  const l = r.lignes.find((x) => x.famille === "sortant")!;
  assert.equal(l.clientMensuelHT, prix, "le calculateur ne doit pas retoucher le prix reçu");
  assert.equal(l.nousMensuelHT, prix, "EAGLEYE à 100 %");
});

test("sans prix reçu, la ligne d'appels sortants n'est pas chiffrée — et le dit", () => {
  const r = chiffrer({ appelsParMois: 3_000 }, opts);
  const l = r.lignes.find((x) => x.famille === "sortant")!;
  assert.equal(l.clientMensuelHT, null, "pas de montant approximatif inventé");
  assert.equal(r.client.mensuelHT, 0);
  assert.match(r.alertes.join(" "), /pas été reçu du catalogue/i);
});

test("le calculateur ne contient aucune arithmétique du prix sortant", () => {
  /**
   * Garde de non-régression sur la faute que je viens de corriger : la
   * tentation de « juste recalculer, c'est simple » est exactement ce qui
   * fabrique deux prix pour la même chose.
   */
  const src = sansCommentaires(readFileSync(join(RACINE, "lib/calculateur-offres.ts"), "utf8"));
  assert.doesNotMatch(src, /Math\.ceil\([^)]*OUTBOUND_UNIT_CALLS\)\s*\*/, "prix sortant recalculé");
  assert.doesNotMatch(src, /OUTBOUND_UNIT_HT\s*\*/, "prix sortant recalculé");
  assert.doesNotMatch(src, /\*\s*OUTBOUND_UNIT_HT/, "prix sortant recalculé");
});

test("à la carte — la somme des briques, et l'ancrage quand elle dépasse le pack", () => {
  const toutes = briques.map((b) => b.id);
  const r = chiffrer({ briques: toutes }, opts);
  const l = r.lignes.find((x) => x.famille === "alpha-carte")!;

  assert.equal(l.clientSetupHT, briques.reduce((s, b) => s + b.setupHT, 0));
  assert.equal(l.clientMensuelHT, briques.reduce((s, b) => s + b.monthlyHT, 0));
  assert.ok(
    l.clientSetupHT! > PACK_SETUP_HT,
    "la somme des briques doit dépasser le pack — c'est tout le mécanisme d'ancrage"
  );
  assert.match(r.alertes.join(" "), /Montre l'addition/, "on ne pousse pas le pack, on montre l'addition");
});

test("une brique inconnue n'est pas comptée en silence", () => {
  const r = chiffrer({ briques: ["crm", "nawak-inexistante"] }, opts);
  const l = r.lignes.find((x) => x.famille === "alpha-carte")!;
  const crm = briques.find((b) => b.id === "crm")!;
  assert.equal(l.clientSetupHT, crm.setupHT, "seule la brique connue est comptée");
  assert.match(r.alertes.join(" "), /absentes du catalogue/i, "et l'absence est dite");
});

test("VIP et rev-share sont ALTERNATIFS — les cumuler est signalé", () => {
  const r = chiffrer({ vip: true, caMensuelGenere: 50_000 }, opts);
  assert.match(r.alertes.join(" "), /ALTERNATIFS/, "10 000 € OU 30 % + setup, jamais les deux");
});

test("le total an 1 est bien setup + douze mois", () => {
  const r = chiffrer({ vip: true }, opts);
  assert.equal(r.client.an1HT, PACK_SETUP_HT + PACK_MONTHLY_HT * 12);
  assert.equal(r.nous.an1HT, r.client.an1HT, "EAGLEYE à 100 % : les deux colonnes coïncident");
});

test("l'essai est un one-shot, pas un abonnement", () => {
  const r = chiffrer({ essai: true }, opts);
  const l = r.lignes.find((x) => x.famille === "essai")!;
  assert.equal(l.clientSetupHT, ESSAI_HT);
  assert.equal(l.clientMensuelHT, 0, "un essai ne se renouvelle pas tous les mois");
});

test("la répartition par compte sépare les deux économies", () => {
  /**
   * ⚠ Elles étaient TROIS. Le devis mêlait notre chiffre d'affaires et deux
   * commissions d'intermédiaire ; il n'en reste qu'une. La séparation, elle,
   * reste la raison d'être du module : mélanger « ce que le client paie » et
   * « ce qui nous revient » fausse toute prévision.
   *
   * Ce devis-ci porte du VIP et de l'Alpha Voice (les deux à nous, donc un
   * seul bloc EAGLEYE) plus un chantier > 40 k (Nuwacom).
   */
  const r = chiffrer({ vip: true, alphaVoiceMinutes: 500, chantierHT: 60_000 }, opts);
  const ids = r.parCompte.map((c) => c.accountId).sort();
  assert.deepEqual(ids, ["eagleye", "nuwacom"]);

  const eagleye = r.parCompte.find((c) => c.accountId === "eagleye")!;
  assert.equal(eagleye.nous.an1HT, eagleye.client.an1HT, "100 % : ce que le client paie nous revient");

  const nuwacom = r.parCompte.find((c) => c.accountId === "nuwacom")!;
  assert.ok(nuwacom.nous.setupHT < nuwacom.client.setupHT, "15 % : nous touchons une fraction");
});

/**
 * Sans barème (route non appelée, ou compte non maître), le module ne doit pas
 * afficher des parts fausses en silence : il applique 100 % — juste pour
 * EAGLEYE — et le DIT.
 */
test("sans barème chargé, le module l'annonce au lieu de deviner", () => {
  const r = chiffrer({ alphaVoiceMinutes: 500 }, { briques });
  assert.match(r.alertes.join(" "), /Barème des comptes non chargé/);
  assert.match(r.alertes.join(" "), /faux pour Nuwacom/);
  assert.equal(BAREME_NEUTRE.setupPct, 100);
});

test("palierAlphaVoice — on monte au palier qui COUVRE le besoin", () => {
  assert.equal(palierAlphaVoice(1).minutes, 250, "un petit volume prend le premier palier");
  assert.equal(palierAlphaVoice(250).minutes, 250);
  assert.equal(palierAlphaVoice(251).minutes, 500, "251 minutes ne tiennent pas dans 250");
  assert.equal(palierAlphaVoice(9999).minutes, 1500, "au-delà du dernier, on reste au dernier");
});

/**
 * Le routage de l'ESCALIER est une décision commerciale, pas un détail
 * d'implémentation : le gros chantier va chez Nuwacom, tout le reste chez
 * nous. Le changer doit demander de changer ce test.
 *
 * ⚠ `alpha-voice` était la SEULE famille rattachée à un autre compte que
 * EAGLEYE ou Nuwacom. Le revendeur qui la portait est parti ; elle est revenue
 * chez nous. Ce test est l'endroit où ce déplacement se voit en une ligne.
 */
test("le routage par famille suit l'escalier", () => {
  const attendu: Record<FamilleOffre, string> = {
    "alpha-vip": "eagleye",
    "alpha-carte": "eagleye",
    "alpha-revshare": "eagleye",
    sortant: "eagleye",
    essai: "eagleye",
    "os-personnalise": "eagleye",
    visibilite: "eagleye",
    digitalisation: "eagleye",
    "alpha-voice": "eagleye",
    nuwacom: "nuwacom",
  };
  assert.deepEqual(COMPTE_DE_LA_FAMILLE, attendu);
});

test("les barèmes dérivés correspondent au portefeuille réel", () => {
  // Il y avait un troisième barème (30 % du setup, 10 % du mensuel). Le compte
  // a disparu : le barème doit avoir disparu avec lui, sinon un devis se
  // chiffrerait encore sur un accord qui n'existe plus.
  assert.equal(BAREMES.length, 2, "un barème par compte du portefeuille, pas un de plus");
  assert.equal(BAREMES.some((b) => b.accountId === "scintia"), false);

  const nuwacom = BAREMES.find((b) => b.accountId === "nuwacom")!;
  assert.equal(nuwacom.setupPct, 15);
  assert.equal(nuwacom.mensuelPct, 100, "100 % de la maintenance");
  assert.equal(nuwacom.plancher, true, "et c'est un plancher");

  const eagleye = BAREMES.find((b) => b.accountId === "eagleye")!;
  assert.equal(eagleye.setupPct, 100, "notre société : rien à reverser");
  assert.equal(eagleye.mensuelPct, 100);
  assert.equal(eagleye.divergence, undefined, "ses cinq offres sont toutes à 100 %");
});

/**
 * ⚠ Le module descend dans le navigateur (l'écran est un composant client).
 * Il ne doit donc porter AUCUN taux : ils entrent par `options.baremes`,
 * servis par `/api/catalogue` au seul compte maître. C'est la quatrième fois
 * que ce dépôt referme cette fuite — voir lib/accounts, lib/knowledge,
 * lib/business-rules, et le registre des prompts.
 */
test("le calculateur ne porte aucun taux de commission en dur", () => {
  const src = sansCommentaires(readFileSync(join(RACINE, "lib/calculateur-offres.ts"), "utf8"));
  assert.doesNotMatch(src, /accounts-commercial/, "il ne doit pas importer le portefeuille");
  for (const taux of ["30", "15", "10"]) {
    // Un taux nu affecté à un pourcentage : `setupPct: 30`, `mensuelPct: 15`…
    assert.doesNotMatch(
      src,
      new RegExp(`(?:setupPct|mensuelPct|commissionPct|recurringPct)\\s*:\\s*${taux}\\b`),
      `un taux partenaire (${taux} %) est écrit en dur dans un module qui descend au navigateur`
    );
  }
});

test("aucun composant client n'atteint le portefeuille via le calculateur", () => {
  const fautes: string[] = [];
  for (const f of fichiersSources(["app", "components"])) {
    const src = readFileSync(f, "utf8");
    if (!src.includes("calculateur-offres")) continue;
    if (!src.startsWith('"use client"') && !src.includes('"use client"')) continue;
    if (/from "@\/lib\/accounts-commercial"/.test(src)) fautes.push(relative(RACINE, f));
  }
  assert.deepEqual(fautes, [], `ces écrans importent le portefeuille au lieu de le recevoir :\n  ${fautes.join("\n  ")}`);
});
