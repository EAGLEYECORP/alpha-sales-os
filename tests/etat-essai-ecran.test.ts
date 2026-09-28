import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ENVELOPPE_OUVERTURE_EUR, PLAFOND_ESSAI_COUT_EUR, etatEssai } from "../lib/essai";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ESSAI SE DIT À CELUI QUI LE VIT.
 *
 * ══ ⚠⚠ LE DÉFAUT RÉPARÉ, ET IL ÉTAIT DE MON FAIT ══
 *
 * Le lot du 17/09 a ouvert l'essai trente jours et produit `etatEssai`, qui
 * rend une `phrase` écrite pour être lue par un humain. **Aucun écran ne
 * l'affichait** — le défaut récurrent de ce dépôt, commis le matin même sur la
 * brique qu'on venait d'ouvrir.
 *
 * Et le trou était pire que « pas d'information ». Un essai fermé retombe au
 * socle gratuit, qui porte `statut: "actif"` : vu du navigateur, **un essai
 * terminé était indistinguable d'un compte qui n'en a jamais eu**. Le
 * locataire perdait `/campaigns`, `/agent` et `/audits` du jour au lendemain
 * et en déduisait une panne.
 * ─────────────────────────────────────────────────────────────────────
 */

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\/|\{\s*\/\*[\s\S]*?\*\/\s*\}|\/\/.*$/gm, "");

const dans = (j: number) => new Date(Date.now() + j * 86_400_000).toISOString();

test("⚠⚠ L'ÉTAT DE L'ESSAI TRAVERSE JUSQU'À L'ÉCRAN — la chaîne entière", () => {
  /**
   * ⚠ ON SUIT LA CHAÎNE, PAS LES MAILLONS. La leçon est déjà écrite dans ce
   * dépôt : « j'ai testé les maillons, pas la chaîne, et la mutation l'a dit ».
   * Chaque étape prise isolément peut être juste pendant que l'ensemble ne
   * transporte rien.
   *
   * Les quatre maillons : le type le porte, la résolution le remplit, la
   * route le descend, le composant l'affiche.
   */
  const ent = sansCommentaires(lire("lib/entitlements.ts"));
  assert.match(ent, /essai\?: EtatEssai/, "1. le droit porte l'état");
  assert.match(ent, /return \{ \.\.\.droitGratuit\(tenant\.id\), essai \}/, "2a. rempli même quand l'essai est FERMÉ");
  assert.match(ent, /\n\s*essai,\n/, "2b. et quand il est actif");

  const route = sansCommentaires(lire("app/api/compte/droits/route.ts"));
  assert.match(route, /essai: d\.essai \?\? null/, "3. la route le descend, `null` quand il n'y en a pas");

  const hook = sansCommentaires(lire("lib/use-droits.ts"));
  assert.match(hook, /essai: EtatEssai \| null/, "4a. le hook le type");

  const panneau = sansCommentaires(lire("components/billing/etat-essai-panel.tsx"));
  assert.match(panneau, /\{essai\.phrase\}/, "4b. et le composant rend la PHRASE, pas une paraphrase");

  const page = sansCommentaires(lire("app/(app)/compte/page.tsx"));
  assert.match(page, /<EtatEssaiPanel \/>/, "5. la page le monte — sinon tout ce qui précède est mort");
});

test("⚠⚠ TROIS ÉTATS, JAMAIS DEUX", () => {
  /**
   * `null` = pas d'essai sur ce compte → on n'affiche RIEN. Une section
   * « aucun essai en cours » inquiète sans informer.
   *
   * Et surtout : « tu as consommé ton quota » et « notre ouverture est
   * pleine » ne se disent pas pareil. Le second n'est pas la faute du
   * locataire, et il appelle un autre geste.
   */
  const p = sansCommentaires(lire("components/billing/etat-essai-panel.tsx"));
  assert.match(p, /if \(!essai\) return null/, "pas d'essai ⇒ rien à l'écran");
  assert.match(p, /if \(essai\.actif\)/, "l'essai en cours a son propre rendu");
  assert.match(
    p,
    /essai\.fin === "enveloppe-epuisee" \|\| essai\.fin === "cout-inconnu"/,
    "une fermeture qui vient de NOUS se distingue d'un quota consommé",
  );
});

test("⚠⚠ L'ENVELOPPE D'OUVERTURE NE DESCEND JAMAIS DANS L'ÉCRAN", () => {
  /**
   * C'est le budget d'acquisition de notre société — même famille que
   * `/offre` et `voice-costs`, réservés au maître. Le locataire voit SA
   * consommation, qui est la sienne. `etatEssai` garde déjà ce nombre hors de
   * sa phrase ; ce garde vérifie que ni la route ni le composant ne le
   * réintroduisent par la fenêtre.
   */
  for (const f of ["app/api/compte/droits/route.ts", "components/billing/etat-essai-panel.tsx"]) {
    const src = sansCommentaires(lire(f));
    assert.ok(!/ENVELOPPE_OUVERTURE_EUR/.test(src), `${f} ne doit pas connaître notre enveloppe`);
    assert.ok(
      !new RegExp(`\\b${ENVELOPPE_OUVERTURE_EUR}\\b`).test(src),
      `${f} ne doit pas chiffrer notre enveloppe`,
    );
  }
  // Et la phrase servie sur une enveloppe épuisée ne la chiffre pas non plus.
  const r = etatEssai({ jusquA: dans(10), coutConsommeEur: 1, coutGlobalEur: ENVELOPPE_OUVERTURE_EUR });
  assert.equal(r.fin, "enveloppe-epuisee");
  assert.ok(!r.phrase.includes(String(ENVELOPPE_OUVERTURE_EUR)));
});

test("⚠ LES DEUX LIMITES S'AFFICHENT ENSEMBLE", () => {
  /**
   * Elles sont INDÉPENDANTES et la première atteinte ferme. N'afficher que
   * les jours ferait découvrir le plafond de consommation au moment exact où
   * il mord — c'est-à-dire au pire moment, et sans prévenir.
   */
  const p = sansCommentaires(lire("components/billing/etat-essai-panel.tsx"));
  assert.match(p, /essai\.joursRestants/, "la durée");
  assert.match(p, /essai\.coutRestantEur/, "et la consommation");

  // Le cas qui prouve que montrer les deux sert à quelque chose : il reste
  // 27 jours, et pourtant l'essai est à un euro de la fermeture.
  const presque = etatEssai({ jusquA: dans(27), coutConsommeEur: PLAFOND_ESSAI_COUT_EUR - 1, coutGlobalEur: 0 });
  assert.equal(presque.actif, true);
  assert.equal(presque.joursRestants, 27);
  assert.equal(presque.coutRestantEur, 1, "27 jours affichés, 1 € réel — c'est pour ça qu'on montre les deux");
});

test("⚠ L'ÉCRAN N'AUTORISE RIEN — il décrit", () => {
  /**
   * `essai` est DESCRIPTIF. Les droits viennent de `bricks`, et la barrière
   * est le middleware. Le jour où quelqu'un ouvre une fonctionnalité sur
   * `essai.actif`, il existe deux définitions de ce qui est ouvert, et c'est
   * celle du navigateur qui décide — donc celle qu'on peut réécrire.
   */
  const ent = sansCommentaires(lire("lib/entitlements.ts"));
  const autorise = ent.slice(ent.indexOf("export function autorise("));
  const corps = autorise.slice(0, autorise.indexOf("\n}"));
  assert.ok(!/essai/.test(corps), "`autorise()` ne doit pas lire l'état d'essai");

  const panneau = sansCommentaires(lire("components/billing/etat-essai-panel.tsx"));
  assert.ok(
    !/fetch\(|\/api\//.test(panneau),
    "le panneau lit le hook, il n'appelle rien lui-même",
  );
});

test("⚠ LE PANNEAU NOMME LA SORTIE QUI NE COÛTE RIEN À PERSONNE", () => {
  /**
   * Une clé apportée ne consomme NI le plafond NI l'enveloppe
   * (`origine: "locataire"` ⇒ débit zéro). C'est la seule issue gratuite des
   * deux côtés, et elle se dit AVANT la fermeture, pas seulement après.
   */
  const p = sansCommentaires(lire("components/billing/etat-essai-panel.tsx"));
  const actif = p.slice(p.indexOf("if (essai.actif)"), p.indexOf("const parNous"));
  assert.match(actif, /clé/i, "la sortie BYOK se dit pendant que l'essai tourne encore");
  assert.match(p, /\/settings/, "et elle mène quelque part");
});
