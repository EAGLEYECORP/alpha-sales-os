import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySupabaseJwt } from "../lib/supabase-jwt";

const SECRET = "super-secret-jwt-du-projet-supabase-0123456789";

const b64url = (buf: Buffer | string) =>
  (typeof buf === "string" ? Buffer.from(buf) : buf).toString("base64url");

/** Forge un JWT HS256 comme le ferait Supabase, avec un secret + une charge donnés. */
function mintJwt(payload: Record<string, unknown>, opts?: { secret?: string; alg?: string }): string {
  const header = { alg: opts?.alg ?? "HS256", typ: "JWT" };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", opts?.secret ?? SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}

const future = () => Math.floor(Date.now() / 1000) + 3600;
const past = () => Math.floor(Date.now() / 1000) - 3600;

test("jwt — un jeton signé et non expiré est accepté, charge utile lue", async () => {
  const token = mintJwt({ sub: "user-A", email: "a@exemple.fr", exp: future() });
  const payload = await verifySupabaseJwt(token, SECRET);
  assert.ok(payload, "doit être accepté");
  assert.equal(payload?.sub, "user-A");
  assert.equal(payload?.email, "a@exemple.fr");
});

test("jwt — mauvaise signature (secret pirate) → refusé", async () => {
  const token = mintJwt({ sub: "user-A", exp: future() }, { secret: "mauvais-secret" });
  assert.equal(await verifySupabaseJwt(token, SECRET), null);
});

test("jwt — charge falsifiée après signature → refusé", async () => {
  const token = mintJwt({ sub: "user-A", exp: future() });
  const [h, , sig] = token.split(".");
  const forged = b64url(JSON.stringify({ sub: "user-B", exp: future() }));
  const tampered = `${h}.${forged}.${sig}`;
  assert.equal(await verifySupabaseJwt(tampered, SECRET), null, "sub usurpé doit échouer");
});

test("jwt — jeton expiré (au-delà de la marge) → refusé", async () => {
  const token = mintJwt({ sub: "user-A", exp: past() });
  assert.equal(await verifySupabaseJwt(token, SECRET), null);
});

test("jwt — attaque « alg: none » → refusé", async () => {
  const h = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const p = b64url(JSON.stringify({ sub: "user-A", exp: future() }));
  assert.equal(await verifySupabaseJwt(`${h}.${p}.`, SECRET), null);
});

test("jwt — algorithme non-HS256 annoncé → refusé", async () => {
  const token = mintJwt({ sub: "user-A", exp: future() }, { alg: "RS256" });
  assert.equal(await verifySupabaseJwt(token, SECRET), null);
});

test("jwt — chaîne malformée → refusé, ne jette pas", async () => {
  assert.equal(await verifySupabaseJwt("pas-un-jwt", SECRET), null);
  assert.equal(await verifySupabaseJwt("", SECRET), null);
  assert.equal(await verifySupabaseJwt("a.b", SECRET), null);
});
