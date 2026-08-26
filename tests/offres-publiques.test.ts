import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OFFRES,
  PRIX_PUBLICS,
  PRO_APPELS_INCLUS,
  margeOffre,
  offreParId,
  validerOffres,
  type OffrePublique,
} from "../lib/offres-publiques";
import { PLANS } from "../lib/stripe";
import { ESSAI_HT, OUTBOUND_UNIT_HT } from "../lib/bricks";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE SEULE GRILLE DE PRIX. C'est tout ce que ce fichier protège.
 *
 * Il y en avait TROIS : la vitrine (79 / 149 €), Stripe (79 / 149 €) et le
 * catalogue commercial (Alpha Voice à 364 €/mois). Le site vendait donc à
 * 149 € ce que le catalogue facturait 364 €, et l'offre Pro annonçait
 * « Alpha Voice inclus » sans aucun plafond d'appels — une perte sèche dès
 * 2 200 appels dans le mois.
 *
 * Trois grilles ne divergent pas par négligence : elles divergent parce que
 * rien ne les compare. Voilà la comparaison.
 * ─────────────────────────────────────────────────────────────────────
 */

const SITE = readFileSync(join(process.cwd(), "site/index.html"), "utf8");

// ─────────── 1. LA RÈGLE QUI A COÛTÉ LE PLUS CHER ───────────

test("la grille publique est valide — aucune offre bancale", () => {
  const erreurs = validerOffres();
  assert.deepEqual(
    erreurs,
    [],
    `grille invalide :\n${erreurs.map((e) => `  ${e.offreId}.${e.champ} — ${e.probleme}`).join("\n")}`
  );
});

test("une offre qui inclut la voix SANS plafond est refusée", () => {
  // Le cas exact qui était en ligne. Le validateur doit le rejeter.
  const perte: OffrePublique = {
    ...offreParId("pro")!,
    id: "pro-sans-plafond",
    appelsInclus: null,
    auDela: null,
  };
  const erreurs = validerOffres([perte]);
  assert.ok(
    erreurs.some((e) => e.champ === "appelsInclus"),
    "la voix sans plafond doit être une erreur, pas un choix"
  );
  assert.ok(erreurs.some((e) => /perte sèche/.test(e.probleme)), "et le motif doit être dit");
});

test("un plafond sans « au-delà » écrit est refusé aussi", () => {
  const piege: OffrePublique = { ...offreParId("pro")!, id: "pro-piege", auDela: "" };
  const erreurs = validerOffres([piege]);
  assert.ok(erreurs.some((e) => e.champ === "auDela"));
});

test("un prix affiché sans moyen d'encaisser est refusé", () => {
  // Le visiteur clique « payer » et tombe dans le vide, au moment exact où il
  // voulait payer. C'est arrivé une fois avec des liens Stripe de gabarit.
  const orphelin: OffrePublique = { ...offreParId("solo")!, id: "solo-orphelin", priceEnv: null };
  const erreurs = validerOffres([orphelin]);
  assert.ok(erreurs.some((e) => e.champ === "priceEnv"));
});

test("l'offre Pro est rentable AU PLAFOND, et son seuil de perte est connu", () => {
  const m = margeOffre(offreParId("pro")!);
  assert.ok((m.margeMarginalePct ?? 0) > 60, `marge marginale ${m.margeMarginalePct} %`);
  assert.ok(m.seuilPerteAppels !== null, "on doit SAVOIR à partir de combien d'appels ça bascule");
  assert.ok(
    (m.seuilPerteAppels ?? 0) > PRO_APPELS_INCLUS * 5,
    "le seuil de perte doit rester loin du plafond annoncé, sinon la marge est illusoire"
  );
});

test("une offre sans appels n'invente pas de coût marginal", () => {
  const m = margeOffre(offreParId("solo")!);
  assert.equal(m.coutMarginalEur, 0, "l'hébergement est mutualisé : le client de plus ne coûte rien");
  assert.match(m.phrase, /vient de la valeur/, "et il faut dire d'où vient le prix à la place");
});

// ─────────── 2. LA VITRINE NE PEUT PLUS DIVERGER ───────────

/** Les prix en euros réellement écrits dans un bloc de tarif du site. */
function prixAffiches(html: string): number[] {
  const bloc = html.slice(html.indexOf('<div class="pricing">'), html.indexOf("</section>", html.indexOf('<div class="pricing">')));
  return [...bloc.matchAll(/<div class="price">\s*([\d\s]+)\s*€/g)].map((m) => Number(m[1].replace(/\s/g, "")));
}

test("tout prix affiché sur la vitrine existe dans la grille publique", () => {
  const affiches = prixAffiches(SITE);
  assert.ok(affiches.length >= 2, "le test ne prouve rien s'il ne trouve aucun prix");
  for (const p of affiches) {
    assert.ok(
      PRIX_PUBLICS.includes(p),
      `${p} € est affiché sur le site mais n'existe dans aucune offre (grille : ${PRIX_PUBLICS.join(", ")} €)`
    );
  }
});

test("la vitrine n'annonce jamais la voix sans son plafond", () => {
  /**
   * LE TEST QUI COMPTE. « Alpha Voice inclus » sans nombre d'appels est une
   * promesse illimitée, et elle passe en perte dès 2 200 appels.
   */
  const bloc = SITE.slice(SITE.indexOf('<div class="pricing">'));
  const fin = bloc.indexOf("</section>");
  const tarifs = bloc.slice(0, fin);

  if (/Alpha Voice/i.test(tarifs)) {
    assert.match(
      tarifs,
      /\d+\s*appels?\s*(\/|par )mois/i,
      "un bloc de tarif qui cite Alpha Voice doit annoncer le nombre d'appels inclus"
    );
    assert.match(
      tarifs,
      /au-del[àa]/i,
      "…et ce qui se passe au-delà du plafond, sinon le client découvre la limite quand elle le bloque"
    );
  }
});

test("le plafond affiché sur la vitrine est CELUI de la grille, pas un autre nombre", () => {
  const tarifs = SITE.slice(SITE.indexOf('<div class="pricing">'));
  assert.ok(
    tarifs.includes(`${PRO_APPELS_INCLUS} appels`),
    `la vitrine doit afficher ${PRO_APPELS_INCLUS} appels — le chiffre vient de lib/offres-publiques.ts`
  );
  assert.ok(
    tarifs.includes(`${OUTBOUND_UNIT_HT} €`),
    `le prix du millier supplémentaire (${OUTBOUND_UNIT_HT} €) doit venir de la même source`
  );
});

// ─────────── 3. STRIPE SUIT LA GRILLE, PAS L'INVERSE ───────────

test("chaque plan Stripe correspond à une offre publique au MÊME prix", () => {
  for (const plan of Object.values(PLANS)) {
    const offre = offreParId(plan.id);
    assert.ok(offre, `le plan Stripe « ${plan.id} » n'existe pas dans la grille publique`);
    assert.equal(
      offre!.prixHT,
      plan.monthly,
      `${plan.id} : Stripe encaisse ${plan.monthly} € mais la grille annonce ${offre!.prixHT} €`
    );
  }
});

test("toute offre encaissable nomme une variable d'environnement de prix", () => {
  for (const o of OFFRES) {
    if (o.cadence === "devis") continue;
    assert.ok(o.priceEnv, `${o.id} affiche un prix sans variable de prix Stripe`);
    assert.match(o.priceEnv!, /^STRIPE_PRICE_/, `${o.id} : ${o.priceEnv} ne suit pas la convention`);
  }
});

test("les offres nouvelles sont déclarées dans .env.example, sinon elles ne s'encaissent jamais", () => {
  // Une variable qu'on oublie de documenter est une variable qu'on oublie de
  // renseigner — et le bouton « payer » tombe dans le vide en production.
  const env = readFileSync(join(process.cwd(), ".env.example"), "utf8");
  for (const o of OFFRES) {
    if (!o.priceEnv) continue;
    assert.ok(env.includes(o.priceEnv), `${o.priceEnv} manque dans .env.example (offre « ${o.id} »)`);
  }
});

// ─────────── 4. COHÉRENCE AVEC LE CATALOGUE INTERNE ───────────

test("l'essai public est au même prix que l'essai du catalogue", () => {
  assert.equal(offreParId("essai")!.prixHT, ESSAI_HT);
});

test("le palier voix public est au même prix que la grille de volume", () => {
  assert.equal(offreParId("voix-1000")!.prixHT, OUTBOUND_UNIT_HT);
});

test("l'offre sur devis n'affiche aucun prix", () => {
  const devis = OFFRES.filter((o) => o.cadence === "devis");
  assert.ok(devis.length > 0, "il faut au moins une porte « on en parle »");
  for (const o of devis) assert.equal(o.prixHT, null);
});
