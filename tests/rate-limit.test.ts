import { test } from "node:test";
import assert from "node:assert/strict";
import { AttemptLimiter, callerKey } from "../lib/rate-limit";

test("limiteur — laisse passer tant qu'on n'a pas atteint le seuil", () => {
  const l = new AttemptLimiter(3, 60_000, 1_000);
  assert.equal(l.check("ip").allowed, true);
  assert.equal(l.fail("ip").remaining, 2);
  assert.equal(l.fail("ip").remaining, 1);
  assert.equal(l.check("ip").allowed, true, "au 2e échec on peut encore essayer");
});

test("limiteur — bloque au seuil, et le blocage expire", () => {
  const l = new AttemptLimiter(3, 60_000, 1_000);
  const t0 = 1_000_000;
  l.fail("ip", t0);
  l.fail("ip", t0);
  const v = l.fail("ip", t0);
  assert.equal(v.allowed, false, "3 échecs = bloqué");
  assert.ok(v.retryAfterSec > 0, "on dit COMBIEN de temps attendre");

  assert.equal(l.check("ip", t0 + 500).allowed, false, "toujours bloqué avant l'échéance");
  assert.equal(l.check("ip", t0 + 1_500).allowed, true, "débloqué après");
});

test("limiteur — le blocage double à chaque palier", () => {
  const l = new AttemptLimiter(2, 600_000, 1_000);
  const t0 = 1_000_000;
  l.fail("ip", t0);
  const premier = l.fail("ip", t0).retryAfterSec;
  // Un bot qui insiste après déblocage retombe sur un mur plus haut.
  l.fail("ip", t0 + 2_000);
  const second = l.fail("ip", t0 + 2_000).retryAfterSec;
  assert.ok(second > premier, `le second blocage (${second}s) doit dépasser le premier (${premier}s)`);
});

test("limiteur — un succès efface l'ardoise", () => {
  const l = new AttemptLimiter(3, 60_000, 1_000);
  l.fail("ip");
  l.fail("ip");
  l.succeed("ip");
  // Un opérateur qui finit par entrer le bon mot de passe ne doit pas rester
  // à une frappe du blocage.
  assert.equal(l.check("ip").remaining, 3);
});

test("limiteur — les échecs s'oublient après la fenêtre", () => {
  const l = new AttemptLimiter(3, 10_000, 1_000);
  const t0 = 1_000_000;
  l.fail("ip", t0);
  l.fail("ip", t0);
  // Se tromper deux fois le lundi ne doit pas punir le vendredi.
  assert.equal(l.check("ip", t0 + 20_000).remaining, 3);
});

test("limiteur — les appelants sont comptés séparément", () => {
  const l = new AttemptLimiter(2, 60_000, 1_000);
  l.fail("1.2.3.4");
  l.fail("1.2.3.4");
  assert.equal(l.check("1.2.3.4").allowed, false);
  assert.equal(l.check("5.6.7.8").allowed, true, "bloquer tout le monde pour un attaquant = déni de service");
});

test("clé d'appelant — on prend l'IP vue par le proxy, pas la liste entière", () => {
  const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2" });
  assert.equal(callerKey(h), "203.0.113.9");

  assert.equal(callerKey(new Headers({ "x-real-ip": "203.0.113.10" })), "203.0.113.10");
  // Sans en-tête, la limite devient globale : plus stricte, jamais plus laxiste.
  assert.equal(callerKey(new Headers()), "inconnu");
});
