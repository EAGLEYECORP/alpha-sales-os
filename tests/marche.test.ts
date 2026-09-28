import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MARCHE_FRANCE,
  MARCHE_LOGICIEL,
  MARCHE_SETUP,
  MARCHE_VOIX,
  RELEVE_LE,
  RESERVE_GLOBALE,
  TOUS_RELEVES,
  comparer,
  prixConseille,
  type RelevePrix,
} from "../lib/marche";
import { ALPHA_VOICE_SETUP_HT, OFFRES, offreParId, PACK_SETUP_HT } from "../lib/offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN RELEVÉ DE MARCHÉ N'EST PAS UNE VÉRITÉ — c'est ce que ce fichier protège.
 *
 * Ces chiffres viennent d'articles de comparaison, pas des pages de tarifs
 * des éditeurs. Ils datent, ils simplifient, et ils se trompent parfois sur
 * les paliers. La même discipline que `lib/references.ts` s'applique : la
 * provenance et le niveau de preuve voyagent AVEC le chiffre, sinon un prix
 * de blog finit cité en rendez-vous comme s'il était opposable.
 * ─────────────────────────────────────────────────────────────────────
 */

// ─────────── 1. AUCUN CHIFFRE SANS SA PROVENANCE ───────────

test("chaque relevé porte sa source, sa date et son niveau de preuve", () => {
  assert.ok(TOUS_RELEVES.length >= 10, "un relevé de trois lignes ne dit rien du marché");
  for (const r of TOUS_RELEVES) {
    assert.ok(r.source.trim().length > 5, `${r.id} : source manquante`);
    assert.ok(r.releveLe, `${r.id} : date manquante — un prix sans date se périme en silence`);
    assert.ok(["source-primaire", "secondaire", "fourchette"].includes(r.fiabilite), `${r.id} : fiabilité invalide`);
  }
});

test("aucun relevé ne se présente comme une source primaire — aucun ne l'est", () => {
  /**
   * Le jour où quelqu'un ouvre vraiment la page de tarifs d'un éditeur, il
   * passera cette ligne en « source-primaire » ET mettra la vraie URL. Tant
   * que ce n'est pas fait, prétendre le contraire donne une fausse assurance
   * en rendez-vous.
   */
  for (const r of TOUS_RELEVES) {
    if (r.fiabilite === "source-primaire") {
      assert.match(
        r.source,
        /https?:\/\//,
        `${r.id} se dit source primaire sans URL de page de tarifs — c'est une source secondaire`
      );
    }
  }
});

test("une fourchette va du bas vers le haut, et le bas n'est pas nul", () => {
  for (const r of TOUS_RELEVES) {
    assert.ok(r.basEur > 0, `${r.id} : borne basse nulle — « à partir de 0 » n'est pas un prix`);
    assert.ok(r.hautEur >= r.basEur, `${r.id} : fourchette inversée (${r.basEur} > ${r.hautEur})`);
  }
});

test("chaque relevé dit ce que la comparaison NE dit pas", () => {
  // Comparer deux prix sans comparer les périmètres est la façon la plus
  // rapide de se convaincre qu'on est cher, ou bon marché, à tort.
  const sansReserve = TOUS_RELEVES.filter((r) => !r.reserve.trim());
  assert.ok(
    sansReserve.length <= 1,
    `${sansReserve.length} relevés sans réserve écrite : ${sansReserve.map((r) => r.id).join(", ")}`
  );
});

test("la réserve globale nomme la limite de l'exercice", () => {
  assert.match(RESERVE_GLOBALE, /secondaire/i);
  assert.match(RESERVE_GLOBALE, /pas un tarif opposable/i);
  assert.ok(RESERVE_GLOBALE.includes("2026"), "la date doit figurer dans la réserve");
  assert.match(RELEVE_LE, /^\d{4}-\d{2}-\d{2}$/);
});

// ─────────── 2. LA COMPARAISON DIT LA VÉRITÉ ───────────

const ref = (id: string): RelevePrix => TOUS_RELEVES.find((r) => r.id === id)!;

test("un prix dans la fourchette est dit « dans le marché »", () => {
  const c = comparer("test", 250, ref("secretaire-ia-fr"));
  assert.equal(c.position, "dans-marche");
});

test("un prix très au-dessus est nommé « hors marché », pas enjolivé", () => {
  const c = comparer("test", 1000, ref("secretaire-ia-fr"));
  assert.equal(c.position, "hors-marche");
  assert.match(c.phrase, /il faut un argument que le prospect achète, ou baisser/);
});

test("un prix sous le marché est signalé aussi — se sous-vendre est un problème", () => {
  const c = comparer("test", 50, ref("secretaire-ia-fr"));
  assert.equal(c.position, "sous-marche");
  assert.match(c.phrase, /sous-vend/i, "il faut le dire, pas seulement s'en réjouir");
});

test("« un peu moins que le marché » est calculable et reste au-dessus du bas de fourchette", () => {
  for (const r of TOUS_RELEVES) {
    const p = prixConseille(r);
    assert.ok(p <= r.hautEur, `${r.id} : le conseillé dépasse le haut de fourchette`);
  }
  // Et la remise est réelle, pas cosmétique.
  assert.ok(prixConseille(ref("secretaire-ia-fr")) < ref("secretaire-ia-fr").hautEur);
});

// ─────────── 3. LE CONSTAT SUR NOS PROPRES PRIX ───────────

test("le pack complet est DANS la fourchette d'une implémentation sur mesure", () => {
  /**
   * Le résultat le plus utile du relevé, et il contredit l'intuition d'hier :
   * ce n'est PAS le pack qui est mal placé. Monter le full OS au-dessus de
   * 10 000 € n'était pas la bonne réponse.
   */
  const c = comparer("Pack complet", PACK_SETUP_HT, ref("setup-integre"));
  assert.equal(c.position, "dans-marche");
});

test("⚠ notre installation est TRÈS AU-DESSUS des frais de mise en service du marché", () => {
  /**
   * ⚠ CE TEST DISAIT LE CONTRAIRE, ET IL AVAIT RAISON À L'ÉPOQUE.
   *
   * Il comparait « Essai terrain » (290 €) à la fourchette française des frais
   * de mise en service (100–300 €) et concluait « dans-marché ». L'offre est
   * sortie de la grille le 04/09/2026 — et avec elle, le seul prix d'entrée
   * qui ressemblait au marché. Ce que le prospect voit maintenant en premier,
   * c'est **990 € d'installation**, soit ×3,3 le haut de fourchette.
   *
   * Recopier l'ancien verdict sur la nouvelle offre aurait été confortable et
   * faux. Le test asserte donc ce qui est VRAI : on est hors marché sur ce
   * poste, et c'est la première objection qu'on entendra. Elle a une réponse
   * — le télésecrétariat facture une mise en relation, nous installons une
   * ligne, un script audité et une voix — mais cette réponse doit être
   * SERVIE, pas supposée. Si un jour l'installation redescend sous 600 €, ce
   * test tombera : ce sera le moment de réécrire l'argument, pas de le taire.
   */
  const c = comparer("Installation Alpha Voice", ALPHA_VOICE_SETUP_HT, ref("mise-en-service-fr"));
  assert.equal(c.position, "hors-marche", `${ALPHA_VOICE_SETUP_HT} € contre 100–300 € — ${c.phrase}`);
  assert.ok(c.ratioHaut >= 3, "l'écart doit rester chiffré, pas seulement qualifié");
});

test("Alpha Voice tient face au comparable FRANÇAIS, pas face à une API américaine", () => {
  const voix = offreParId("voix-1000")!;
  // Le bon comparable : ce à quoi un artisan lyonnais compare réellement.
  const fr = comparer("Alpha Voice", voix.prixHT!, ref("telesecretariat-humain"));
  assert.equal(fr.position, "dans-marche");

  // Le mauvais comparable, mais celui qu'un acheteur technique sortira :
  // ramené à la minute, on est très au-dessus d'une plateforme tout-inclus.
  const minutes = 1000 * 0.3 * 2.85;
  const parMinute = Number((voix.prixHT! / minutes).toFixed(3));
  const api = comparer("Alpha Voice", parMinute, ref("bland"));
  assert.equal(
    api.position,
    "hors-marche",
    "cet écart doit rester VISIBLE dans le code : c'est le point sur lequel on se fera attaquer"
  );
});

test("aucune offre mensuelle ne se retrouve hors marché sans qu'on le sache", () => {
  // Ce test ne juge pas les prix : il exige qu'on ait REGARDÉ. Une offre
  // mensuelle sans comparable au relevé est un prix posé à l'aveugle.
  const comparables = new Set(["voix-essentiel", "voix-intensif", "omnicanal", "voix-1000"]);
  for (const o of OFFRES.filter((x) => x.cadence === "mensuel")) {
    assert.ok(comparables.has(o.id), `${o.id} n'a aucun comparable dans le relevé de marché`);
  }
});

// ─────────── 4. LES QUATRE FAMILLES SONT COUVERTES ───────────

test("le relevé couvre les quatre familles qu'on vend", () => {
  assert.ok(MARCHE_VOIX.length >= 3, "plateformes vocales");
  assert.ok(MARCHE_FRANCE.length >= 3, "solutions françaises clés en main — le VRAI comparable");
  assert.ok(MARCHE_LOGICIEL.length >= 3, "CRM et outreach");
  assert.ok(MARCHE_SETUP.length >= 2, "frais d'installation");
});

test("le comparable français existe — c'est à lui qu'un prospect compare", () => {
  /**
   * Un artisan lyonnais ne compare pas Alpha Voice à Vapi. Il le compare à son
   * télésecrétariat actuel. Un relevé qui n'aurait que des plateformes
   * américaines donnerait un positionnement faux.
   */
  assert.ok(
    MARCHE_FRANCE.some((r) => /t[ée]l[ée]secr[ée]tariat/i.test(r.acteur + r.quoi)),
    "le télésecrétariat humain doit figurer au relevé"
  );
});
