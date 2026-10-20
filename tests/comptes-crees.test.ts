import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { ACCESS_COOKIE, accessToken } from "../lib/access";
import { JWT_COOKIE } from "../lib/supabase-jwt";
import { API_EXPLOITATION, MAITRE_SEULEMENT } from "../lib/api-access";
import {
  LECTURE_RECENTS, MUR_EMAILS_PAR_HEURE_SUPPOSE, affichageComptes, etatDuMur, lireComptesCrees,
  type ComptesCrees,
} from "../lib/comptes-crees";
import { GET as route } from "../app/api/comptes-crees/route";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE COMPTEUR DE COMPTES — deux entiers, au maître seul.
 *
 * Ce qu'on protège : un compteur qui rend 0 quand la base est injoignable
 * (« personne ne s'inscrit », faux), une adresse d'inscrit qui fuit vers un
 * écran, et une route lisible par n'importe quel client.
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
  assert.equal(affichageComptes(r).heure, `≥ ${LECTURE_RECENTS}`);
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

test("le mur : inconnu · loin · proche · atteint — et il se dit SUPPOSÉ", () => {
  const c = (h: number | null): ComptesCrees => ({ total: 10, derniereHeure: h, derniereHeureMinimum: false, raison: null });
  assert.equal(etatDuMur(c(null)), "inconnu");
  assert.equal(etatDuMur(c(3)), "loin");
  assert.equal(etatDuMur(c(Math.ceil(MUR_EMAILS_PAR_HEURE_SUPPOSE * 0.8))), "proche");
  assert.equal(etatDuMur(c(MUR_EMAILS_PAR_HEURE_SUPPOSE)), "atteint");
  assert.match(affichageComptes(c(3)).mur, /supposé/i);
  assert.match(affichageComptes(c(3)).mur, /non lu/i, "un seuil qui a l'air mesuré est le défaut que ce dépôt refuse");
});

test("⚠⚠ à l'écran, l'inconnu est un TIRET, jamais « 0 »", () => {
  const rien = affichageComptes(null);
  assert.equal(rien.total, "—");
  assert.equal(rien.heure, "—");
  assert.equal(rien.etat, "inconnu");
  assert.ok(rien.reserve);
  const lacune = affichageComptes({ total: null, derniereHeure: null, derniereHeureMinimum: false, raison: "x" });
  assert.equal(lacune.total, "—");
  assert.notEqual(lacune.total, "0");
  // Et un VRAI zéro reste un zéro : 0 compte, c'est une information.
  assert.equal(affichageComptes({ total: 0, derniereHeure: 0, derniereHeureMinimum: false, raison: null }).total, "0");
});

// ── LA ROUTE, APPELÉE ───────────────────────────────────────────────────

const SECRET_JWT = "secret-jwt-supabase-de-test-assez-long-pour-hs256";
const MAITRE = "patron@exemple.test";
const b64u = (x: string | Buffer) => Buffer.from(x).toString("base64url");
function jwt(email: string, secret = SECRET_JWT): string {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify({ sub: "u-1", email, exp: Math.floor(Date.now() / 1000) + 600 }));
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
}
const appel = (cookie?: string) =>
  new NextRequest("https://alpha.exemple.test/api/comptes-crees", { headers: cookie ? { cookie } : {} });

function avecEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const avant: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    avant[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  return fn().finally(() => {
    for (const k of Object.keys(vars)) {
      if (avant[k] === undefined) delete process.env[k];
      else process.env[k] = avant[k];
    }
  });
}

test("⚠⚠ la route : 403 sans session, 403 pour un client, 403 pour un jeton forgé", () =>
  avecEnv({ SUPABASE_JWT_SECRET: SECRET_JWT, OWNER_EMAILS: MAITRE, ...ENV }, async () => {
    assert.equal((await route(appel())).status, 403, "sans session");
    assert.equal((await route(appel(`${JWT_COOKIE}=${jwt("client@exemple.test")}`))).status, 403, "un client");
    assert.equal(
      (await route(appel(`${JWT_COOKIE}=${jwt(MAITRE, "pas-le-bon-secret-pas-le-bon-secret")}`))).status,
      403,
      "une session signée avec un autre secret ne vaut rien"
    );
  }));

test("la route, pour le maître : lit Supabase et ne rend que des entiers", () =>
  avecEnv({ SUPABASE_JWT_SECRET: SECRET_JWT, OWNER_EMAILS: MAITRE, ...ENV }, async () => {
    const vraiFetch = globalThis.fetch;
    let urlLue = "";
    globalThis.fetch = (async (url: string) => {
      urlLue = String(url);
      // La route lit l'HORLOGE RÉELLE : les dates sont donc relatives à maintenant.
      const reel = (min: number) => ({ created_at: new Date(Date.now() - min * 60_000).toISOString(), email: `x${min}@prive.exemple` });
      return faux({ total: "17", users: [reel(4), reel(30), reel(200)] })();
    }) as unknown as typeof fetch;
    try {
      const r = await route(appel(`${JWT_COOKIE}=${jwt(MAITRE)}`));
      assert.equal(r.status, 200);
      const j = await r.json();
      assert.equal(j.total, 17);
      assert.equal(j.derniereHeure, 2);
      assert.doesNotMatch(JSON.stringify(j), /@/);
      assert.match(urlLue, /\/auth\/v1\/admin\/users\?page=1&per_page=100$/);
      assert.equal(r.headers.get("cache-control"), "no-store");
    } finally {
      globalThis.fetch = vraiFetch;
    }
  }));

test("⚠ la route du maître, base absente : 200 avec des null — jamais des zéros", () =>
  avecEnv({ SUPABASE_JWT_SECRET: SECRET_JWT, OWNER_EMAILS: MAITRE, NEXT_PUBLIC_SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    const r = await route(appel(`${JWT_COOKIE}=${jwt(MAITRE)}`));
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.total, null);
    assert.equal(j.derniereHeure, null);
    assert.ok(j.raison);
  }));

// ── LA PORTE DU MIDDLEWARE ──────────────────────────────────────────────

test("⚠ le chemin est maître seul, et l'exploitant d'une installation client ne l'ouvre pas", async () => {
  assert.ok(MAITRE_SEULEMENT.includes("/api/comptes-crees"));
  assert.ok(!API_EXPLOITATION.includes("/api/comptes-crees"), "le total d'un client n'est pas notre tableau d'acquisition");
  // Joué pour de vrai : sur une installation chez un client (exploitant), la route est refusée.
  await avecEnv(
    { ALPHA_INSTALLATION: "client", SITE_PASSWORD: "mdp-du-client", SUPABASE_JWT_SECRET: undefined, NEXT_PUBLIC_SUPABASE_URL: undefined, REQUIRE_AUTH: undefined, OWNER_EMAILS: undefined, NODE_ENV: "production" },
    async () => {
      const req = new NextRequest("https://alpha.client.exemple/api/comptes-crees", {
        headers: { cookie: `${ACCESS_COOKIE}=${await accessToken("mdp-du-client")}` },
      });
      assert.equal((await middleware(req)).status, 403);
    }
  );
});
