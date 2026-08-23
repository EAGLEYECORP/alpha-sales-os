import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ACCES_PAR_CHEMIN, CHEMINS_COMMUNS, briquesPourChemin, normaliser, peutOuvrir } from "../lib/bricks-access";
import { CHEMIN_PAR_API } from "../lib/api-access";
import {
  autorise, DROIT_REFUSE, DROIT_SOLO, estMaitre, normaliserBriques, statutEffectif,
  type Entitlement,
} from "../lib/entitlements";
import { BRICKS } from "../lib/bricks";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA VENTE À LA CARTE — « il ne voit QUE sa brique ».
 *
 * Cette phrase était dans la doctrine et sur la vitrine, et nulle part dans
 * le code. Ces tests sont ce qui la rend vraie, et surtout ce qui l'empêche
 * de redevenir fausse : un contrôle d'accès se dégrade par ajout — une page
 * nouvelle, une route nouvelle, et le trou est ouvert sans que rien ne casse.
 * ─────────────────────────────────────────────────────────────────────
 */

const compte = (over: Partial<Entitlement> = {}): Entitlement => ({
  tenantId: "t1",
  bricks: [],
  statut: "actif",
  maitre: false,
  solo: false,
  ...over,
});

// ── LA RÈGLE DE FOND : refusé par défaut ───────────────────────────────

test("accès — une page NON CLASSÉE est refusée, jamais autorisée", () => {
  /**
   * C'est l'inverse du réflexe, et c'est le seul choix tenable : on ajoute des
   * pages sans y penser. En « autorisé par défaut », une page oubliée est une
   * fuite qui ne se voit jamais.
   */
  assert.equal(briquesPourChemin("/page-qui-nexiste-pas"), undefined);
  assert.equal(peutOuvrir("/page-qui-nexiste-pas", ["crm", "cerveau", "pilotage"]), false);
});

test("accès — chaque page de l'app est classée", () => {
  // Le test qui rattrape l'ajout distrait. Une page non classée est refusée
  // à TOUT LE MONDE sauf le maître : le bug se voit en développement, pas en
  // production — mais seulement si quelqu'un le cherche. Le voilà.
  const pages = readdirSync(join(process.cwd(), "app/(app)"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => "/" + e.name);

  const nonClassees = pages.filter(
    (p) => !CHEMINS_COMMUNS.includes(p) && ACCES_PAR_CHEMIN[p] === undefined
  );
  assert.deepEqual(nonClassees, [], `pages sans brique : ${nonClassees.join(", ")}`);
});

test("accès — chaque route API est traduite vers un chemin métier", () => {
  /**
   * Une page bloquée dont l'API répond ne protège rien. Le client qui n'a pas
   * le Cerveau ne verra pas /cerveau, mais fetch("/api/brain") lui rendrait la
   * donnée.
   */
  const routes = new Set<string>();
  const visite = (rel: string) => {
    for (const e of readdirSync(join(process.cwd(), rel), { withFileTypes: true })) {
      if (e.isDirectory()) visite(`${rel}/${e.name}`);
      else if (e.name === "route.ts") routes.add(rel.replace(/^app/, ""));
    }
  };
  visite("app/api");

  const prefixes = Object.keys(CHEMIN_PAR_API);
  const orphelines = [...routes].filter(
    (r) => !prefixes.some((p) => r === p || r.startsWith(p + "/"))
  );
  assert.deepEqual(orphelines, [], `routes API non classées : ${orphelines.join(", ")}`);
});

test("accès — toute brique du catalogue ouvre au moins une page", () => {
  // Une brique vendue qui n'ouvre rien est une brique qu'on facture sans la
  // livrer. Le test l'attrape le jour où on ajoute la brique, pas le jour où
  // le client s'en plaint.
  const ouvertes = new Set(Object.values(ACCES_PAR_CHEMIN).flat());
  for (const b of BRICKS) {
    assert.ok(ouvertes.has(b.id as never), `la brique « ${b.id} » n'ouvre aucune page`);
  }
});

// ── LES DEUX ÉCHECS QUI N'ONT RIEN À VOIR ──────────────────────────────

test("droits — SOLO ouvre tout : l'usage d'aujourd'hui reste intact", () => {
  // Sans système de comptes configuré, Alpha Sales OS est l'outil d'une seule
  // personne. Refuser ici transformerait un outil qui marche en écran vide.
  for (const chemin of ["/cerveau", "/payouts", "/voice", "/nimporte-quoi"]) {
    assert.equal(autorise(DROIT_SOLO, chemin), true, chemin);
  }
});

test("droits — REFUS ne laisse passer que les chemins communs", () => {
  // Un compte qu'on ne peut pas prouver doit pouvoir se connecter et voir
  // pourquoi il est bloqué. L'enfermer dehors ne récupère aucun impayé.
  assert.equal(autorise(DROIT_REFUSE, "/login"), true);
  assert.equal(autorise(DROIT_REFUSE, "/compte"), true);
  assert.equal(autorise(DROIT_REFUSE, "/pipeline"), false);
  assert.equal(autorise(DROIT_REFUSE, "/cerveau"), false);
});

// ── LE CŒUR : un client ne voit QUE sa brique ──────────────────────────

test("droits — un client Alpha Voice n'ouvre pas le Cerveau", () => {
  const client = compte({ bricks: ["alpha-voice"] });
  assert.equal(autorise(client, "/voice"), true, "sa brique s'ouvre");
  assert.equal(autorise(client, "/appels"), true);
  assert.equal(autorise(client, "/cerveau"), false, "le Cerveau reste fermé");
  assert.equal(autorise(client, "/campaigns"), false);
  assert.equal(autorise(client, "/pipeline"), false);
});

test("droits — notre économie n'est ouverte par AUCUNE brique", () => {
  /**
   * Payouts et /offre parlent des commissions entre nous et nos partenaires,
   * et de nos coûts. Un client qui achète TOUT le catalogue ne doit pas y
   * accéder : ce ne sont pas des fonctionnalités, c'est notre comptabilité.
   */
  const clientComplet = compte({ bricks: BRICKS.map((b) => b.id) as never });
  assert.equal(autorise(clientComplet, "/payouts"), false);
  assert.equal(autorise(clientComplet, "/offre"), false);
  // Nous, si.
  assert.equal(autorise(compte({ maitre: true }), "/payouts"), true);
});

test("droits — le MAÎTRE voit tout, y compris les pages non classées", () => {
  // C'est nous qui vendons l'OS : notre compte ne doit jamais se retrouver
  // dehors parce qu'une page vient d'être ajoutée.
  const nous = compte({ maitre: true, bricks: [] });
  for (const chemin of ["/cerveau", "/payouts", "/page-toute-neuve"]) {
    assert.equal(autorise(nous, chemin), true, chemin);
  }
});

test("droits — les sous-chemins suivent leur page", () => {
  // Sans normalisation, chaque fiche prospect serait un chemin non classé,
  // donc refusée, et l'app deviendrait inutilisable pour tout le monde.
  const client = compte({ bricks: ["crm"] });
  assert.equal(normaliser("/prospects/abc-123/edit"), "/prospects");
  assert.equal(autorise(client, "/prospects/abc-123"), true);
  assert.equal(autorise(client, "/cerveau/une-note"), false, "un sous-chemin n'échappe pas au contrôle");
});

// ── ESSAI, SUSPENSION, DONNÉES DOUTEUSES ───────────────────────────────

test("statut — un essai expiré vaut suspension, sans qu'on ait à le réécrire", () => {
  // Le droit suit la DATE, pas un statut qu'un cron aurait dû mettre à jour.
  // Un cron qui ne tourne pas ne doit pas prolonger un essai indéfiniment.
  const ent = compte({ statut: "essai", essaiJusquA: "2026-08-01T00:00:00Z", bricks: ["crm"] });
  assert.equal(statutEffectif(ent, new Date("2026-07-30T00:00:00Z")), "essai");
  assert.equal(statutEffectif(ent, new Date("2026-08-10T00:00:00Z")), "suspendu");

  assert.equal(autorise(ent, "/pipeline", new Date("2026-07-30T00:00:00Z")), true);
  assert.equal(autorise(ent, "/pipeline", new Date("2026-08-10T00:00:00Z")), false);
  // Mais il peut toujours venir payer.
  assert.equal(autorise(ent, "/compte", new Date("2026-08-10T00:00:00Z")), true);
});

test("droits — une brique inconnue venue de la base n'accorde rien", () => {
  // On n'accorde jamais un droit qu'on ne comprend pas : une valeur inventée
  // en base ne doit pas devenir une clé.
  assert.deepEqual(normaliserBriques(["crm", "admin-total", 42, null]), ["crm"]);
  assert.deepEqual(normaliserBriques("crm"), []);
  assert.deepEqual(normaliserBriques(undefined), []);
});

test("maître — une variable d'environnement vide n'ouvre rien", () => {
  // Sans cette garde, un OWNER_EMAILS mal rempli donnerait le compte maître
  // à tout le monde. C'est le genre de faute qui ne se voit qu'après.
  const avant = process.env.OWNER_EMAILS;
  try {
    process.env.OWNER_EMAILS = "";
    assert.equal(estMaitre("zakaria@eagleyecorp.fr"), false);
    process.env.OWNER_EMAILS = "@eagleyecorp.fr";
    assert.equal(estMaitre("zakaria@eagleyecorp.fr"), true);
    assert.equal(estMaitre("z@autre.fr"), false);
    assert.equal(estMaitre(""), false);
    assert.equal(estMaitre(null), false);
  } finally {
    process.env.OWNER_EMAILS = avant;
  }
});

// ── LA BARRIÈRE EST BIEN AU BON ENDROIT ────────────────────────────────

test("barrière — le middleware garde les PAGES et les API par la même règle", () => {
  /**
   * Le contrôle d'accès par écran est le trou classique : le menu masque la
   * page, l'API répond quand même. Ce test verrouille le fait que les deux
   * passent par `autorise()`.
   */
  const mw = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
  assert.match(mw, /resoudreDroits\(req\)/);
  assert.match(mw, /autorise\(droits, chemin\)/);
  assert.match(mw, /cheminMetierDeLApi/, "les API sont traduites, pas exemptées");
  assert.match(mw, /code: "brique_absente"/);
});

test("barrière — la route qui expose les droits ne décide de rien", () => {
  // Si un jour on autorise à partir de cette réponse, on aura reconstruit le
  // trou qu'on vient de fermer.
  const src = readFileSync(join(process.cwd(), "app/api/compte/droits/route.ts"), "utf8");
  assert.match(src, /ne décide de RIEN/i);
});
