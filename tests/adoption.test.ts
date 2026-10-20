import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { ACCESS_COOKIE, accessToken } from "../lib/access";
import { JWT_COOKIE } from "../lib/supabase-jwt";
import { API_EXPLOITATION, MAITRE_SEULEMENT } from "../lib/api-access";
import { CHEMINS_EXPLOITATION } from "../lib/bricks-access";
import { autorise, BRIQUES_CONNUES, type Entitlement } from "../lib/entitlements";
import {
  PALIERS_ADOPTION, affichageAdoption, jourDeParis, lireAdoption, positionPalier, serie30Jours,
  type Adoption, type AppelRpc,
} from "../lib/adoption";
import type { ComptesCrees } from "../lib/comptes-crees";
import { GET as route } from "../app/api/adoption/route";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ADOPTION D'ALPHA SALES OS — l'écran des propriétaires.
 *
 * Ce qu'on protège :
 *  · un compteur qui dit « 0 » quand la base ne répond pas ;
 *  · une adresse d'inscrit qui fuit vers l'écran ;
 *  · un écran lisible par un client, ou livré avec une installation client ;
 *  · nos propres comptes comptés comme de l'adoption.
 * ─────────────────────────────────────────────────────────────────────
 */

const MAINTENANT = new Date("2026-10-20T20:00:00.000Z");

const ENTIERS = {
  total: 50, confirmes: 41, inscrits_1h: 6, inscrits_24h: 18, inscrits_7j: 33, inscrits_30j: 50,
  connectes_24h: 9, connectes_7j: 20, connectes_30j: 31,
  par_jour: [{ jour: "2026-10-19", n: 12 }, { jour: "2026-10-20", n: 6 }],
};
const rpcQui = (data: unknown, error: { message?: string; code?: string } | null = null) => {
  const appels: { nom: string; args: Record<string, unknown> }[] = [];
  const f: AppelRpc = async (nom, args) => {
    appels.push({ nom, args });
    return { data, error };
  };
  return Object.assign(f, { appels });
};
const repli = (c: Partial<ComptesCrees> = {}): (() => Promise<ComptesCrees>) => async () => ({
  total: 12, derniereHeure: 2, derniereHeureMinimum: false, raison: null, ...c,
});

// ── LA LECTURE ──────────────────────────────────────────────────────────

test("lit l'agrégat de la base, et lui passe les adresses À EXCLURE", async () => {
  const rpc = rpcQui(ENTIERS);
  const a = await lireAdoption({ rpc, repli: repli(), exclure: ["Contact@EagleyeCorp.fr ", "", "autre@nous.test"] });
  assert.equal(a.source, "base");
  assert.equal(a.total, 50);
  assert.equal(a.confirmes, 41);
  assert.equal(a.inscrits1h, 6);
  assert.equal(a.connectes7j, 20);
  assert.equal(a.excluLesNotres, true);
  assert.equal(a.raison, null);
  assert.equal(rpc.appels.length, 1);
  assert.equal(rpc.appels[0].nom, "adoption_stats");
  assert.deepEqual(rpc.appels[0].args.exclure, ["contact@eagleyecorp.fr", "autre@nous.test"], "normalisées, vides retirées");
});

test("⚠⚠ nos propres comptes : sans OWNER_EMAILS l'exclusion n'a pas lieu, ET ON LE DIT", async () => {
  const a = await lireAdoption({ rpc: rpcQui(ENTIERS), repli: repli(), exclure: [] });
  assert.equal(a.excluLesNotres, false);
  assert.match(a.raison ?? "", /OWNER_EMAILS/);
  assert.ok(affichageAdoption(a).reserves.some((r) => /nos propres comptes/i.test(r)));
});

test("⚠ la donnée inattendue n'est pas un chiffre : texte, négatif, décimal → null", async () => {
  const a = await lireAdoption({
    rpc: rpcQui({ ...ENTIERS, confirmes: "41", inscrits_1h: -3, inscrits_24h: 1.5, connectes_24h: null }),
    repli: repli(),
    exclure: ["x@y.z"],
  });
  assert.equal(a.total, 50);
  assert.equal(a.confirmes, null);
  assert.equal(a.inscrits1h, null);
  assert.equal(a.inscrits24h, null);
  assert.equal(a.connectes24h, null);
});

test("⚠ la fonction absente → repli sur la liste d'administration, avec la migration NOMMÉE", async () => {
  const a = await lireAdoption({
    rpc: rpcQui(null, { message: "function public.adoption_stats does not exist", code: "PGRST202" }),
    repli: repli({ total: 12, derniereHeure: 2 }),
    exclure: ["x@y.z"],
  });
  assert.equal(a.source, "api-admin");
  assert.equal(a.total, 12);
  assert.equal(a.inscrits1h, 2);
  assert.equal(a.confirmes, null, "le repli ne sait pas compter les confirmations — et ne fait pas semblant");
  assert.equal(a.connectes7j, null);
  assert.equal(a.parJour, null);
  assert.equal(a.excluLesNotres, false, "le repli ne sait pas exclure les nôtres");
  assert.match(a.raison ?? "", /017-adoption\.sql/);
});

test("⚠⚠ base injoignable PARTOUT : source « aucune », des null — JAMAIS des 0", async () => {
  for (const rpc of [rpcQui(null, { message: "boom" }), null]) {
    const a = await lireAdoption({
      rpc,
      repli: repli({ total: null, derniereHeure: null, raison: "Supabase est injoignable depuis ce serveur." }),
      exclure: ["x@y.z"],
    });
    assert.equal(a.source, "aucune");
    for (const k of ["total", "confirmes", "inscrits1h", "inscrits24h", "inscrits7j", "inscrits30j", "connectes24h", "connectes7j", "connectes30j", "parJour"] as const) {
      assert.equal(a[k], null, `${k} doit être null, pas 0`);
    }
    assert.ok(a.raison);
  }
});

test("un appel qui LÈVE n'écroule pas la lecture : repli", async () => {
  const rpc: AppelRpc = async () => {
    throw new Error("réseau coupé");
  };
  const a = await lireAdoption({ rpc, repli: repli(), exclure: [] });
  assert.equal(a.source, "api-admin");
});

test("un VRAI zéro reste un zéro : la base a répondu, personne ne s'est inscrit", async () => {
  const vide = { total: 0, confirmes: 0, inscrits_1h: 0, inscrits_24h: 0, inscrits_7j: 0, inscrits_30j: 0, connectes_24h: 0, connectes_7j: 0, connectes_30j: 0, par_jour: [] };
  const a = await lireAdoption({ rpc: rpcQui(vide), repli: repli(), exclure: ["x@y.z"] });
  assert.equal(a.total, 0);
  assert.equal(affichageAdoption(a).total, "0");
  const s = serie30Jours(a.parJour, MAINTENANT);
  assert.equal(s?.length, 30);
  assert.ok(s?.every((j) => j.n === 0));
});

// ── LES PALIERS ─────────────────────────────────────────────────────────

test("les paliers : atteint, prochain, et combien il en manque", () => {
  assert.equal(positionPalier(null), null);
  assert.deepEqual(positionPalier(0), { atteint: null, prochain: 10, manque: 10 });
  assert.deepEqual(positionPalier(10), { atteint: 10, prochain: 100, manque: 90 });
  assert.deepEqual(positionPalier(99), { atteint: 10, prochain: 100, manque: 1 });
  assert.deepEqual(positionPalier(10_000_000), { atteint: 10_000_000, prochain: null, manque: null });
  assert.deepEqual([...PALIERS_ADOPTION], [10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000]);
});

// ── LA COURBE ───────────────────────────────────────────────────────────

test("la courbe : 30 jours, les jours creux à zéro, le dernier est aujourd'hui (Paris)", () => {
  const s = serie30Jours([{ jour: "2026-10-19", n: 12 }, { jour: "2026-10-20", n: 6 }], MAINTENANT)!;
  assert.equal(s.length, 30);
  assert.equal(s[29].jour, jourDeParis(MAINTENANT));
  assert.equal(s[29].jour, "2026-10-20");
  assert.equal(s[28].n, 12);
  assert.equal(s[29].n, 6);
  assert.equal(s[0].jour, "2026-09-21");
  assert.equal(new Set(s.map((j) => j.jour)).size, 30, "aucun jour en double, même autour du passage à l'heure d'hiver");
});

test("⚠ sans lecture agrégée, PAS de courbe (null) : remplir de zéros inventerait une semaine creuse", () => {
  assert.equal(serie30Jours(null, MAINTENANT), null);
});

test("la courbe traverse le changement d'heure sans sauter ni répéter un jour", () => {
  // Fin octobre : Paris repasse à l'heure d'hiver (25/10/2026).
  const s = serie30Jours([], new Date("2026-10-27T10:00:00.000Z"))!;
  assert.equal(new Set(s.map((j) => j.jour)).size, 30);
  assert.ok(s.some((j) => j.jour === "2026-10-25"));
  assert.ok(s.some((j) => j.jour === "2026-10-26"));
});

// ── L'AFFICHAGE ─────────────────────────────────────────────────────────

test("⚠⚠ à l'écran, l'inconnu est un TIRET, jamais « 0 »", () => {
  const rien = affichageAdoption(null);
  assert.equal(rien.total, "—");
  assert.deepEqual(rien.inscrits, { h1: "—", j1: "—", j7: "—", j30: "—" });
  assert.deepEqual(rien.connexions, { j1: "—", j7: "—", j30: "—" });
  assert.equal(rien.confirmation, "—");
  assert.equal(rien.etatMur, "inconnu");
  assert.ok(rien.reserves.length > 0);
});

test("⚠ jamais un taux nu : « X confirmés sur Y », pas un pourcentage", async () => {
  const a = await lireAdoption({ rpc: rpcQui(ENTIERS), repli: repli(), exclure: ["x@y.z"] });
  const t = affichageAdoption(a).confirmation;
  assert.match(t, /41 confirmés sur 50/);
  assert.match(t, /9 sans confirmation/);
  assert.doesNotMatch(t, /%/);
});

test("une fenêtre pleine s'affiche « ≥ » et se dit plancher", () => {
  const a: Adoption = {
    source: "api-admin", total: 900, confirmes: null, inscrits1h: 100, inscrits24h: null, inscrits7j: null, inscrits30j: null,
    connectes24h: null, connectes7j: null, connectes30j: null, parJour: null, excluLesNotres: false, heureMinimum: true, raison: null,
  };
  const aff = affichageAdoption(a);
  assert.equal(aff.inscrits.h1, "≥ 100");
  assert.ok(aff.reserves.some((r) => /plancher/i.test(r)));
});

test("le mur : supposé et dit tel, et il suit la dernière heure", async () => {
  const a = await lireAdoption({ rpc: rpcQui({ ...ENTIERS, inscrits_1h: 31 }), repli: repli(), exclure: ["x@y.z"] });
  const aff = affichageAdoption(a);
  assert.equal(aff.etatMur, "atteint");
  assert.match(aff.mur, /supposé/i);
  assert.match(aff.mur, /non lu/i);
});

test("« connectés » se dit sous-compté — la dernière saisie du mot de passe, pas la dernière visite", async () => {
  const a = await lireAdoption({ rpc: rpcQui(ENTIERS), repli: repli(), exclure: ["x@y.z"] });
  assert.ok(affichageAdoption(a).reserves.some((r) => /sous-compte/i.test(r)));
});

test("⚠⚠ AUCUNE adresse ne traverse : la lecture ne rend que des entiers, des dates et du texte écrit ici", async () => {
  const rpc = rpcQui({ ...ENTIERS, email: "fuite@prive.test", users: [{ email: "fuite@prive.test" }] });
  const a = await lireAdoption({ rpc, repli: repli(), exclure: ["nous@eagleyecorp.fr"] });
  const sortie = JSON.stringify(a) + JSON.stringify(affichageAdoption(a));
  assert.doesNotMatch(sortie, /@|prive\.test|eagleyecorp/, "une adresse a traversé");
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
  new NextRequest("https://alpha.exemple.test/api/adoption", { headers: cookie ? { cookie } : {} });

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
const BASE = { SUPABASE_JWT_SECRET: SECRET_JWT, OWNER_EMAILS: MAITRE };

test("⚠⚠ la route : 403 sans session, 403 pour un client, 403 pour un jeton forgé", () =>
  avecEnv(BASE, async () => {
    assert.equal((await route(appel())).status, 403, "sans session");
    assert.equal((await route(appel(`${JWT_COOKIE}=${jwt("client@exemple.test")}`))).status, 403, "un client");
    assert.equal(
      (await route(appel(`${JWT_COOKIE}=${jwt(MAITRE, "pas-le-bon-secret-pas-le-bon-secret")}`))).status,
      403,
      "une session signée avec un autre secret ne vaut rien"
    );
  }));

test("⚠ la route, pour le maître, sans Supabase : 200 avec des null — jamais des zéros", () =>
  avecEnv({ ...BASE, NEXT_PUBLIC_SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    const r = await route(appel(`${JWT_COOKIE}=${jwt(MAITRE)}`));
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.source, "aucune");
    assert.equal(j.total, null);
    assert.ok(j.raison);
    assert.equal(r.headers.get("cache-control"), "no-store");
  }));

test("la route, pour le maître : appelle la fonction d'agrégat avec OWNER_EMAILS à exclure", () =>
  avecEnv({ ...BASE, NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service-de-test" }, async () => {
    const vraiFetch = globalThis.fetch;
    const vus: { url: string; corps: string }[] = [];
    globalThis.fetch = (async (url: unknown, init?: { body?: unknown }) => {
      vus.push({ url: String(url), corps: String(init?.body ?? "") });
      return new Response(JSON.stringify(ENTIERS), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    try {
      const r = await route(appel(`${JWT_COOKIE}=${jwt(MAITRE)}`));
      assert.equal(r.status, 200);
      const j = await r.json();
      assert.equal(j.source, "base");
      assert.equal(j.total, 50);
      assert.equal(j.excluLesNotres, true);
      const rpc = vus.find((v) => v.url.includes("/rest/v1/rpc/adoption_stats"));
      assert.ok(rpc, `la fonction d'agrégat n'a pas été appelée : ${vus.map((v) => v.url).join(", ")}`);
      assert.deepEqual(JSON.parse(rpc.corps), { exclure: [MAITRE] });
      assert.doesNotMatch(JSON.stringify(j), /@/);
    } finally {
      globalThis.fetch = vraiFetch;
    }
  }));

// ── LA PORTE ────────────────────────────────────────────────────────────

test("⚠ le chemin est maître seul, et l'exploitant d'une installation client ne l'ouvre PAS", async () => {
  assert.ok(MAITRE_SEULEMENT.includes("/api/adoption"));
  assert.ok(!API_EXPLOITATION.includes("/api/adoption"), "le total d'un client n'est pas notre tableau d'acquisition");
  assert.ok(!CHEMINS_EXPLOITATION.includes("/adoption"), "l'écran non plus : il ne part pas chez un client");
  const exploitant: Entitlement = { tenantId: null, bricks: [...BRIQUES_CONNUES], statut: "actif", maitre: false, solo: false, exploitant: true };
  assert.equal(autorise(exploitant, "/adoption"), false);
  assert.equal(autorise({ ...exploitant, exploitant: false, maitre: true }, "/adoption"), true, "le maître, lui, y entre");
  await avecEnv(
    { ALPHA_INSTALLATION: "client", SITE_PASSWORD: "mdp-du-client", SUPABASE_JWT_SECRET: undefined, NEXT_PUBLIC_SUPABASE_URL: undefined, REQUIRE_AUTH: undefined, OWNER_EMAILS: undefined, NODE_ENV: "production" },
    async () => {
      const req = new NextRequest("https://alpha.client.exemple/api/adoption", {
        headers: { cookie: `${ACCESS_COOKIE}=${await accessToken("mdp-du-client")}` },
      });
      assert.equal((await middleware(req)).status, 403);
    }
  );
});

test("⚠ le tableau n'est plus dans /ceo (console livrée aux installations) et vit sur /adoption", () => {
  const lire = (f: string) =>
    readFileSync(join(process.cwd(), f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const ceo = lire("app/(app)/ceo/page.tsx");
  assert.doesNotMatch(ceo, /adoption|comptes-crees|CompteurComptes/i, "le tableau d'adoption ne doit pas être dans la console qu'on livre");
  const page = lire("app/(app)/adoption/page.tsx");
  assert.match(page, /\/api\/adoption/);
  assert.match(page, /TableauAdoption/);
  const rail = lire("components/shell/app-shell.tsx");
  assert.match(rail, /href:\s*"\/adoption"/, "un écran que rien n'ouvre est un écran mort");
});
