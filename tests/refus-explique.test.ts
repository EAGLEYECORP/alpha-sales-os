import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { raisonDuRefus } from "../lib/entitlements";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN REFUS DOIT DIRE LEQUEL DES CONTRÔLES A TRANCHÉ.
 *
 * Cas réel du 01/10/2026 : `/moniteur` renvoyait vers `/compte?bloque=…` un
 * compte que `/compte` affichait « Accès propriétaire », et la synchro du pipe
 * disait « l'état du serveur n'est pas connu » à un compte bien connecté.
 * Les deux écrans avaient raison chacun de leur côté ; c'est le silence sur la
 * RAISON qui rendait le diagnostic impossible sans lire le code.
 *
 * ⚠ Ces tests APPELLENT le middleware — un test de source serait satisfait par
 * un commentaire bien écrit (voir CLAUDE.md, « une route peut enfin
 * s'exécuter dans un test »).
 * ─────────────────────────────────────────────────────────────────────
 */

const SECRET = "secret-de-test-hs256-0123456789abcdef";

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function jeton(sub: string, email: string): string {
  const h = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64url(JSON.stringify({ sub, email, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const s = b64url(createHmac("sha256", SECRET).update(`${h}.${p}`).digest());
  return `${h}.${p}.${s}`;
}

function avecEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const avant: Record<string, string | undefined> = {};
    for (const k of Object.keys(vars)) {
      avant[k] = process.env[k];
      if (vars[k] === undefined) delete process.env[k];
      else process.env[k] = vars[k];
    }
    try {
      await fn();
    } finally {
      for (const k of Object.keys(vars)) {
        if (avant[k] === undefined) delete process.env[k];
        else process.env[k] = avant[k];
      }
    }
  };
}

const COMPTES = {
  SUPABASE_JWT_SECRET: SECRET,
  NEXT_PUBLIC_SUPABASE_URL: "https://exemple.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: undefined, // ⇒ droits lus = socle gratuit, sans réseau
  SITE_PASSWORD: undefined,
  REQUIRE_AUTH: undefined,
  OWNER_EMAILS: undefined,
};

test("raisonDuRefus : trois causes, trois mots", () => {
  assert.equal(raisonDuRefus({ tenantId: "u1" }, true), "sans-serrure");
  assert.equal(raisonDuRefus({ tenantId: null }, false), "sans-session");
  assert.equal(raisonDuRefus({ tenantId: "u1" }, false), "brique");
});

test(
  "/moniteur sans cookie de session : la redirection dit « sans-session », pas « pas dans ton offre »",
  avecEnv(COMPTES, async () => {
    const r = await middleware(new NextRequest("https://alpha.exemple/moniteur"));
    const loc = r.headers.get("location") ?? "";
    assert.match(loc, /\/compte\?bloque=%2Fmoniteur&raison=sans-session$/);
  })
);

test(
  "/moniteur avec une session valide mais sans la brique : « brique »",
  avecEnv(COMPTES, async () => {
    const req = new NextRequest("https://alpha.exemple/moniteur", {
      headers: { cookie: `alpha-jwt=${jeton("11111111-1111-4111-8111-111111111111", "client@exemple.fr")}` },
    });
    const r = await middleware(req);
    assert.match(r.headers.get("location") ?? "", /raison=brique$/);
  })
);

test(
  "contre-test : le maître reconnu par le JETON n'est pas redirigé",
  avecEnv({ ...COMPTES, OWNER_EMAILS: "patron@exemple.fr" }, async () => {
    const req = new NextRequest("https://alpha.exemple/moniteur", {
      headers: { cookie: `alpha-jwt=${jeton("22222222-2222-4222-8222-222222222222", "patron@exemple.fr")}` },
    });
    const r = await middleware(req);
    assert.equal(r.headers.get("location"), null);
  })
);

test(
  "/api/sync refusé par le mot de passe du site : le 401 dit POURQUOI (et nomme /gate)",
  avecEnv({ ...COMPTES, SITE_PASSWORD: "mot-de-passe-test" }, async () => {
    const r = await middleware(new NextRequest("https://alpha.exemple/api/sync/prospects"));
    assert.equal(r.status, 401);
    const j = (await r.json()) as { why?: string };
    assert.match(j.why ?? "", /administration/);
    assert.match(j.why ?? "", /\/gate/);
  })
);
