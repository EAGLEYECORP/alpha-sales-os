import test from "node:test";
import assert from "node:assert/strict";
import {
  LECTURE_RECENTS, MUR_EMAILS_PAR_HEURE_SUPPOSE, etatDuMur, lireComptesCrees,
  type ComptesCrees,
} from "../lib/comptes-crees";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE REPLI DU COMPTEUR — la liste d'administration, quand la fonction SQL
 * d'agrégat (`017-adoption.sql`) n'est pas posée. La route, le tableau et le
 * contrôle d'accès sont dans `tests/adoption.test.ts`.
 *
 * Ce qu'on protège ici : un compteur qui rend 0 quand la base est injoignable
 * (« personne ne s'inscrit », faux) et une adresse d'inscrit qui fuit.
 * ─────────────────────────────────────────────────────────────────────
 */

const ENV = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service-de-test" };
const MAINTENANT = new Date("2026-10-20T20:00:00.000Z");
const il_y_a = (min: number) => new Date(MAINTENANT.getTime() - min * 60_000).toISOString();

function faux(opts: { status?: number; total?: string | null; users?: { created_at: string; email: string }[] | unknown; leve?: boolean }) {
  return async () => {
    if (opts.leve) throw new Error("réseau coupé");
    return {
      ok: (opts.status ?? 200) < 400,
      status: opts.status ?? 200,
      headers: { get: (n: string) => (n.toLowerCase() === "x-total-count" ? (opts.total ?? null) : null) },
      json: async () => ({ users: opts.users ?? [] }),
    };
  };
}
const user = (min: number) => ({ created_at: il_y_a(min), email: `inscrit${min}@prive.exemple` });

test("lit le total et la fenêtre d'une heure", async () => {
  const r = await lireComptesCrees(ENV, faux({ total: "42", users: [user(5), user(20), user(59), user(61), user(300)] }), MAINTENANT);
  assert.equal(r.total, 42);
  assert.equal(r.derniereHeure, 3);
  assert.equal(r.derniereHeureMinimum, false);
  assert.equal(r.raison, null);
});

test("⚠⚠ AUCUNE adresse ne sort — seulement des entiers et une phrase", async () => {
  const r = await lireComptesCrees(ENV, faux({ total: "2", users: [user(1), user(2)] }), MAINTENANT);
  const sortie = JSON.stringify(r);
  assert.doesNotMatch(sortie, /@|prive\.exemple|inscrit/, "l'adresse d'un tiers a fui dans la sortie");
  assert.deepEqual(Object.keys(r).sort(), ["derniereHeure", "derniereHeureMinimum", "raison", "total"]);
});

test("⚠ une base injoignable rend null — JAMAIS 0", async () => {
  for (const [nom, fetchImpl] of [
    ["réseau coupé", faux({ leve: true })],
    ["401", faux({ status: 401 })],
    ["500", faux({ status: 500 })],
  ] as const) {
    const r = await lireComptesCrees(ENV, fetchImpl, MAINTENANT);
    assert.equal(r.total, null, nom);
    assert.equal(r.derniereHeure, null, nom);
    assert.ok(r.raison && r.raison.length > 10, `${nom} : le silence ne se dit pas, la raison oui`);
  }
  const sansBase = await lireComptesCrees({}, faux({ total: "5" }), MAINTENANT);
  assert.equal(sansBase.total, null);
  assert.match(sansBase.raison ?? "", /pas configuré/);
});

test("une erreur ne recopie pas le corps de la réponse (il peut citer la clé envoyée)", async () => {
  const r = await lireComptesCrees(ENV, faux({ status: 401 }), MAINTENANT);
  assert.doesNotMatch(r.raison ?? "", /service-de-test|Bearer/);
  assert.match(r.raison ?? "", /401/);
});

test("⚠ une fenêtre PLEINE est un plancher : « ≥ », pas un résultat", async () => {
  const cent = Array.from({ length: LECTURE_RECENTS }, (_, i) => user(i % 50));
  // trié du plus récent au plus ancien
  cent.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const r = await lireComptesCrees(ENV, faux({ total: "900", users: cent }), MAINTENANT);
  assert.equal(r.derniereHeure, LECTURE_RECENTS);
  assert.equal(r.derniereHeureMinimum, true);
});

test("⚠ une liste du plus ANCIEN au plus récent n'est pas lue : null, pas 0", async () => {
  // Lue telle quelle, la fenêtre rendrait 0 sur une base qui reçoit 40 inscrits à l'heure.
  const r = await lireComptesCrees(ENV, faux({ total: "300", users: [user(900), user(600), user(3), user(1)] }), MAINTENANT);
  assert.equal(r.derniereHeure, null);
  assert.equal(r.total, 300, "le total reste lu");
  assert.match(r.raison ?? "", /ordre/);
});

test("le total sans en-tête : fiable sur une page non pleine, null sur une page pleine", async () => {
  const peu = await lireComptesCrees(ENV, faux({ total: null, users: [user(1), user(2), user(3)] }), MAINTENANT);
  assert.equal(peu.total, 3);
  const pleine = await lireComptesCrees(ENV, faux({ total: null, users: Array.from({ length: LECTURE_RECENTS }, (_, i) => user(i + 1)) }), MAINTENANT);
  assert.equal(pleine.total, null, "une page pleine ne dit rien du reste");
  assert.match(pleine.raison ?? "", /total/);
});

test("le mur : inconnu · loin · proche · atteint", () => {
  const c = (h: number | null): ComptesCrees => ({ total: 10, derniereHeure: h, derniereHeureMinimum: false, raison: null });
  assert.equal(etatDuMur(c(null)), "inconnu");
  assert.equal(etatDuMur(c(3)), "loin");
  assert.equal(etatDuMur(c(Math.ceil(MUR_EMAILS_PAR_HEURE_SUPPOSE * 0.8))), "proche");
  assert.equal(etatDuMur(c(MUR_EMAILS_PAR_HEURE_SUPPOSE)), "atteint");
});
