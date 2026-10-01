import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { verifySupabaseJwt } from "../lib/supabase-jwt";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA PANNE DU 01/10/2026 : le projet Supabase signe ses sessions en ES256
 * (clé ECC P-256 « current », l'ancien HS256 en « previously used »), et le
 * serveur n'acceptait que HS256. Mesuré en production : `/api/compte/droits`
 * → 401 « Compte requis » pour un compte propriétaire connecté.
 *
 * Ces tests signent de VRAIS jetons avec une VRAIE paire P-256 et servent la
 * clé publique par un JWKS simulé — exactement le chemin de la production.
 * ─────────────────────────────────────────────────────────────────────
 */

const subtle = webcrypto.subtle;
/** Une URL par test : le cache est indexé par URL, donc aucun test ne voit le JWKS d'un autre. */
let n = 0;
const nouvelleUrl = () => `https://projet-${++n}.exemple/auth/v1/.well-known/jwks.json`;
let JWKS_URL = "";

function b64url(octets: Uint8Array | string): string {
  return Buffer.from(typeof octets === "string" ? Buffer.from(octets) : octets)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function paire() {
  const p = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = (await subtle.exportKey("jwk", p.publicKey)) as Record<string, unknown>;
  return { privee: p.privateKey, jwk: { ...pub, kid: "cle-courante", alg: "ES256", use: "sig" } };
}

async function signerES256(privee: CryptoKey, kid: string, charge: Record<string, unknown>, alg = "ES256") {
  const h = b64url(JSON.stringify({ alg, typ: "JWT", kid }));
  const c = b64url(JSON.stringify(charge));
  const sig = new Uint8Array(
    await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privee, Buffer.from(`${h}.${c}`))
  );
  return `${h}.${c}.${b64url(sig)}`;
}

function fetchJwks(cles: unknown[], compteur?: { n: number }): typeof fetch {
  return (async (url: string | URL | Request) => {
    if (compteur) compteur.n++;
    assert.equal(String(url), JWKS_URL);
    return new Response(JSON.stringify({ keys: cles }), { status: 200 });
  }) as typeof fetch;
}

const dansUneHeure = () => Math.floor(Date.now() / 1000) + 3600;

test("un jeton ES256 signé par la clé courante du projet est accepté", async () => {
  JWKS_URL = nouvelleUrl();
  const { privee, jwk } = await paire();
  const t = await signerES256(privee, "cle-courante", { sub: "u-1", email: "a@b.fr", exp: dansUneHeure() });
  const p = await verifySupabaseJwt(t, "secret-legacy", { jwksUrl: JWKS_URL, fetchImpl: fetchJwks([jwk]) });
  assert.equal(p?.sub, "u-1");
  assert.equal(p?.email, "a@b.fr");
});

test("un jeton ES256 signé par une AUTRE clé est refusé (même kid)", async () => {
  JWKS_URL = nouvelleUrl();
  const vraie = await paire();
  const pirate = await paire();
  const t = await signerES256(pirate.privee, "cle-courante", { sub: "u-1", exp: dansUneHeure() });
  const p = await verifySupabaseJwt(t, "secret-legacy", { jwksUrl: JWKS_URL, fetchImpl: fetchJwks([vraie.jwk]) });
  assert.equal(p, null);
});

test("une charge modifiée après signature est refusée", async () => {
  JWKS_URL = nouvelleUrl();
  const { privee, jwk } = await paire();
  const t = await signerES256(privee, "cle-courante", { sub: "u-1", exp: dansUneHeure() });
  const [h, , s] = t.split(".");
  const falsifiee = `${h}.${b64url(JSON.stringify({ sub: "maitre", exp: dansUneHeure() }))}.${s}`;
  assert.equal(await verifySupabaseJwt(falsifiee, "x", { jwksUrl: JWKS_URL, fetchImpl: fetchJwks([jwk]) }), null);
});

test("expiré, ou sans exp : refusé même bien signé", async () => {
  JWKS_URL = nouvelleUrl();
  const { privee, jwk } = await paire();
  const f = fetchJwks([jwk]);
  const expire = await signerES256(privee, "cle-courante", { sub: "u", exp: Math.floor(Date.now() / 1000) - 3600 });
  const sansExp = await signerES256(privee, "cle-courante", { sub: "u" });
  assert.equal(await verifySupabaseJwt(expire, "x", { jwksUrl: JWKS_URL, fetchImpl: f }), null);
  assert.equal(await verifySupabaseJwt(sansExp, "x", { jwksUrl: JWKS_URL, fetchImpl: f }), null);
});

test("confusion d'algorithme : une clé EC ne valide jamais un en-tête RS256, et « none » est refusé", async () => {
  JWKS_URL = nouvelleUrl();
  const { privee, jwk } = await paire();
  const t = await signerES256(privee, "cle-courante", { sub: "u", exp: dansUneHeure() }, "RS256");
  assert.equal(await verifySupabaseJwt(t, "x", { jwksUrl: JWKS_URL, fetchImpl: fetchJwks([jwk]) }), null);
  const none = `${b64url(JSON.stringify({ alg: "none" }))}.${b64url(JSON.stringify({ sub: "u", exp: dansUneHeure() }))}.`;
  assert.equal(await verifySupabaseJwt(none, "x", { jwksUrl: JWKS_URL, fetchImpl: fetchJwks([jwk]) }), null);
});

test("le jeton ne peut pas apporter sa propre clé (jwk/jku dans l'en-tête ignorés)", async () => {
  JWKS_URL = nouvelleUrl();
  const vraie = await paire();
  const pirate = await paire();
  const h = b64url(JSON.stringify({ alg: "ES256", kid: "cle-courante", jwk: pirate.jwk, jku: "https://pirate.exemple/jwks" }));
  const c = b64url(JSON.stringify({ sub: "maitre", exp: dansUneHeure() }));
  const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pirate.privee, Buffer.from(`${h}.${c}`)));
  const t = `${h}.${c}.${b64url(sig)}`;
  assert.equal(await verifySupabaseJwt(t, "x", { jwksUrl: JWKS_URL, fetchImpl: fetchJwks([vraie.jwk]) }), null);
});

test("JWKS mis en cache : un seul appel réseau pour plusieurs vérifications", async () => {
  JWKS_URL = nouvelleUrl();
  const { privee, jwk } = await paire();
  const compteur = { n: 0 };
  const f = fetchJwks([jwk], compteur);
  const t = await signerES256(privee, "cle-courante", { sub: "u", exp: dansUneHeure() });
  for (let i = 0; i < 5; i++) assert.ok(await verifySupabaseJwt(t, "x", { jwksUrl: JWKS_URL, fetchImpl: f }));
  assert.equal(compteur.n, 1);
});

test("JWKS injoignable : refus (jamais d'ouverture sur une panne)", async () => {
  JWKS_URL = nouvelleUrl();
  const { privee } = await paire();
  const t = await signerES256(privee, "cle-courante", { sub: "u", exp: dansUneHeure() });
  const enPanne = (async () => {
    throw new Error("réseau");
  }) as typeof fetch;
  assert.equal(await verifySupabaseJwt(t, "x", { jwksUrl: JWKS_URL, fetchImpl: enPanne }), null);
});

test("contre-test : le chemin HS256 legacy fonctionne toujours", async () => {
  const secret = "secret-legacy-de-test";
  const h = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const c = b64url(JSON.stringify({ sub: "u-legacy", exp: dansUneHeure() }));
  const cle = await subtle.importKey("raw", Buffer.from(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await subtle.sign("HMAC", cle, Buffer.from(`${h}.${c}`)));
  const p = await verifySupabaseJwt(`${h}.${c}.${b64url(sig)}`, secret);
  assert.equal(p?.sub, "u-legacy");
});
