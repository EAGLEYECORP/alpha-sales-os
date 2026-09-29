import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import {
  CodesUtilises,
  echangerJeton,
  enregistrerClient,
  redirectAutorise,
  secretOAuth,
  validerDemande,
} from "../lib/mcp-oauth";
import { autoriserAppelant } from "../lib/autoriser-appelant";
import { GET as metaRessource } from "../app/api/oauth/metadata/resource/route";
import { GET as metaServeur } from "../app/api/oauth/metadata/serveur/route";
import { POST as register } from "../app/api/oauth/register/route";
import { GET as authorizeGet, POST as authorizePost } from "../app/api/oauth/authorize/route";
import { POST as token } from "../app/api/oauth/token/route";
import { POST as mcp } from "../app/api/mcp/route";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SERVEUR OAUTH DU MCP, JOUÉ DE BOUT EN BOUT — en APPELANT les routes.
 *
 * Le parcours exact que fait Claude : 401 → métadonnées → enregistrement →
 * consentement → échange PKCE → jeton → `tools/list`. Un test par maillon ne
 * suffirait pas : c'est la CHAÎNE qui doit tenir (leçon « j'ai testé les
 * maillons, pas la chaîne »).
 * ─────────────────────────────────────────────────────────────────────
 */

const ORIGINE = "https://alpha.exemple.test";
const RETOUR_CLAUDE = "https://claude.ai/api/mcp/auth_callback";
const SECRET_JWT = "secret-jwt-supabase-de-test-assez-long-pour-hs256";
const MAITRE = "patron@exemple.test";

process.env.SUPABASE_JWT_SECRET = SECRET_JWT;
process.env.OWNER_EMAILS = MAITRE;
delete process.env.OAUTH_SECRET;
delete process.env.ALPHA_API_KEYS;

const b64u = (x: string | Buffer) => Buffer.from(x).toString("base64url");
function sessionSupabase(email: string, secret = SECRET_JWT): string {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify({ sub: "u-1", email, exp: Math.floor(Date.now() / 1000) + 600 }));
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
}
const pkce = () => {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
};
const req = (chemin: string, init?: RequestInit) => new Request(`${ORIGINE}${chemin}`, init);

async function enregistrer(): Promise<string> {
  const r = await register(req("/api/oauth/register", { method: "POST", body: JSON.stringify({ client_name: "Claude", redirect_uris: [RETOUR_CLAUDE] }) }));
  assert.equal(r.status, 201);
  return (await r.json()).client_id;
}

function paramsDemande(clientId: string, challenge: string) {
  return {
    response_type: "code",
    client_id: clientId,
    redirect_uri: RETOUR_CLAUDE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "etat-42",
    resource: `${ORIGINE}/api/mcp`,
  };
}

async function approuver(params: Record<string, string>, session: string | null) {
  return authorizePost(
    req("/api/oauth/authorize", {
      method: "POST",
      headers: { "content-type": "application/json", ...(session ? { authorization: `Bearer ${session}` } : {}) },
      body: JSON.stringify({ params, decision: "approve" }),
    }),
  );
}

async function echanger(corps: Record<string, string>) {
  return token(req("/api/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(corps).toString() }));
}

/** Tout le parcours jusqu'aux jetons. */
async function parcours() {
  const clientId = await enregistrer();
  const { verifier, challenge } = pkce();
  const params = paramsDemande(clientId, challenge);
  const a = await approuver(params, sessionSupabase(MAITRE));
  assert.equal(a.status, 200);
  const retour = new URL((await a.json()).redirect);
  assert.equal(retour.origin + retour.pathname, RETOUR_CLAUDE);
  assert.equal(retour.searchParams.get("state"), "etat-42", "le state revient intact");
  const code = retour.searchParams.get("code") as string;
  return { clientId, verifier, code };
}

// ─────────────────────────────── découverte ───────────────────────────────

test("⚠⚠ MCP sans authentification → 401 + pointeur vers les métadonnées (sinon Claude ne démarre jamais)", async () => {
  const r = await mcp(new NextRequest(`${ORIGINE}/api/mcp`, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }) }));
  assert.equal(r.status, 401);
  assert.equal(r.headers.get("www-authenticate"), `Bearer resource_metadata="${ORIGINE}/.well-known/oauth-protected-resource"`);
});

test("métadonnées : la ressource est EXACTEMENT l'URL saisie, PKCE S256, client public", async () => {
  const res = await (await metaRessource(req("/.well-known/oauth-protected-resource"))).json();
  assert.equal(res.resource, `${ORIGINE}/api/mcp`);
  assert.deepEqual(res.authorization_servers, [ORIGINE]);
  const as = await (await metaServeur(req("/.well-known/oauth-authorization-server"))).json();
  assert.equal(as.issuer, ORIGINE);
  assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(as.token_endpoint_auth_methods_supported, ["none"]);
  assert.equal(as.registration_endpoint, `${ORIGINE}/api/oauth/register`);
});

// ─────────────────────────────── le parcours ───────────────────────────────

test("⚠⚠ LE PARCOURS COMPLET : enregistrement → consentement maître → PKCE → jeton → tools/list", async () => {
  const { clientId, verifier, code } = await parcours();
  const r = await echanger({ grant_type: "authorization_code", code, redirect_uri: RETOUR_CLAUDE, client_id: clientId, code_verifier: verifier });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const j = await r.json();
  assert.equal(j.token_type, "Bearer");
  assert.ok(j.access_token.startsWith("amo_") && j.refresh_token.startsWith("amr_"));

  const liste = await mcp(
    new NextRequest(`${ORIGINE}/api/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${j.access_token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    }),
  );
  assert.equal(liste.status, 200);
  const noms = ((await liste.json()).result.tools as { name: string }[]).map((t) => t.name).sort();
  assert.deepEqual(noms, ["diagnostic", "etat_du_pipe", "lister_propositions", "preparer_campagne", "proposer"]);
});

test("⚠⚠ PKCE : un mauvais vérificateur ne rend RIEN, et ne brûle pas le code", async () => {
  const { clientId, verifier, code } = await parcours();
  const faux = await echanger({ grant_type: "authorization_code", code, redirect_uri: RETOUR_CLAUDE, client_id: clientId, code_verifier: pkce().verifier });
  assert.equal(faux.status, 400);
  assert.equal((await faux.json()).error, "invalid_grant");
  // Le bon vérificateur passe encore : l'échec n'a pas consommé le code.
  const bon = await echanger({ grant_type: "authorization_code", code, redirect_uri: RETOUR_CLAUDE, client_id: clientId, code_verifier: verifier });
  assert.equal(bon.status, 200);
});

test("⚠ un code ne sert qu'une fois (sur une même instance)", async () => {
  const { clientId, verifier, code } = await parcours();
  const corps = { grant_type: "authorization_code", code, redirect_uri: RETOUR_CLAUDE, client_id: clientId, code_verifier: verifier };
  assert.equal((await echanger(corps)).status, 200);
  const rejoue = await echanger(corps);
  assert.equal(rejoue.status, 400);
  assert.match((await rejoue.json()).error_description, /déjà utilisé/);
});

test("refresh : rend une NOUVELLE paire, et meurt dès que l'email quitte OWNER_EMAILS", async () => {
  const { clientId, verifier, code } = await parcours();
  const j = await (await echanger({ grant_type: "authorization_code", code, redirect_uri: RETOUR_CLAUDE, client_id: clientId, code_verifier: verifier })).json();
  const r = await echanger({ grant_type: "refresh_token", refresh_token: j.refresh_token, client_id: clientId });
  assert.equal(r.status, 200);
  const k = await r.json();
  assert.notEqual(k.refresh_token, j.refresh_token, "rotation du refresh");

  process.env.OWNER_EMAILS = "quelquun-dautre@exemple.test";
  try {
    const coupe = await echanger({ grant_type: "refresh_token", refresh_token: k.refresh_token, client_id: clientId });
    assert.equal(coupe.status, 400);
    assert.equal((await coupe.json()).error, "invalid_grant");
    // Et le jeton d'accès déjà émis meurt au prochain appel, sans attendre l'heure.
    assert.equal(autoriserAppelant(`Bearer ${k.access_token}`, "etat.read").ok, false);
  } finally {
    process.env.OWNER_EMAILS = MAITRE;
  }
});

// ─────────────────────────────── consentement ───────────────────────────────

test("⚠⚠ consentement : sans session → 401 ; compte NON maître → 403 ; aucun code émis", async () => {
  const clientId = await enregistrer();
  const params = paramsDemande(clientId, pkce().challenge);
  const sans = await approuver(params, null);
  assert.equal(sans.status, 401);
  assert.equal((await sans.json()).redirect, undefined);
  const intrus = await approuver(params, sessionSupabase("client@exemple.test"));
  assert.equal(intrus.status, 403);
  assert.equal((await intrus.json()).redirect, undefined);
  const forge = await approuver(params, sessionSupabase(MAITRE, "pas-le-bon-secret-pas-le-bon-secret"));
  assert.equal(forge.status, 401, "une session signée avec un autre secret ne vaut rien");
});

test("consentement : refuser renvoie access_denied chez Claude, state compris", async () => {
  const clientId = await enregistrer();
  const r = await authorizePost(
    req("/api/oauth/authorize", { method: "POST", body: JSON.stringify({ params: paramsDemande(clientId, pkce().challenge), decision: "deny" }) }),
  );
  const u = new URL((await r.json()).redirect);
  assert.equal(u.searchParams.get("error"), "access_denied");
  assert.equal(u.searchParams.get("state"), "etat-42");
});

test("⚠⚠ jamais de redirection vers une adresse NON vérifiée (pas de redirection ouverte)", async () => {
  // Client altéré : l'erreur s'affiche chez nous, rien ne part ailleurs.
  const q = new URLSearchParams({ ...paramsDemande("amc_faux.faux", pkce().challenge), redirect_uri: "https://evil.test/cb" });
  const r = await authorizeGet(req(`/api/oauth/authorize?${q}`));
  assert.equal(r.status, 400);
  assert.equal((await r.json()).redirect, undefined);
  // Client valide, mais retour non enregistré : même chose.
  const clientId = await enregistrer();
  const q2 = new URLSearchParams({ ...paramsDemande(clientId, pkce().challenge), redirect_uri: "https://claude.ai/autre" });
  assert.equal((await authorizeGet(req(`/api/oauth/authorize?${q2}`))).status, 400);
});

test("PKCE plain est refusé — l'erreur, elle, peut repartir chez Claude (adresse vérifiée)", async () => {
  const clientId = await enregistrer();
  const q = new URLSearchParams({ ...paramsDemande(clientId, pkce().challenge), code_challenge_method: "plain" });
  const d = await (await authorizeGet(req(`/api/oauth/authorize?${q}`))).json();
  assert.equal(new URL(d.redirect).searchParams.get("error"), "invalid_request");
});

// ─────────────────────────────── enregistrement ───────────────────────────────

test("⚠⚠ enregistrement : seuls les retours de CLAUDE sont acceptés", () => {
  const secret = secretOAuth() as string;
  const maintenant = new Date();
  for (const u of ["https://evil.test/api/mcp/auth_callback", "https://claude.ai.evil.test/api/mcp/auth_callback", "http://claude.ai/api/mcp/auth_callback", "https://claude.ai/api/mcp/auth_callback?x=1"]) {
    const r = enregistrerClient({ redirect_uris: [u] }, secret, maintenant);
    assert.equal(r.ok, false, u);
  }
  assert.equal(redirectAutorise("https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(redirectAutorise("http://localhost:3118/callback"), true);
  assert.equal(redirectAutorise("http://127.0.0.1:52011/callback"), true);
  assert.equal(enregistrerClient({ redirect_uris: [RETOUR_CLAUDE], token_endpoint_auth_method: "client_secret_basic" }, secret, maintenant).ok, false);
});

test("Claude Code : la boucle locale se compare SANS le port (il change à chaque session)", () => {
  const secret = secretOAuth() as string;
  const r = enregistrerClient({ redirect_uris: ["http://localhost/callback"] }, secret, new Date());
  assert.ok(r.ok);
  const v = validerDemande({ ...paramsDemande(r.valeur.client_id, pkce().challenge), redirect_uri: "http://localhost:3118/callback" }, secret);
  assert.ok(v.ok);
});

// ─────────────────────────────── droits ───────────────────────────────

test("⚠⚠ un jeton OAuth ne donne QUE le cerveau : jamais prospects.write, même au maître", async () => {
  const { clientId, verifier, code } = await parcours();
  const j = await (await echanger({ grant_type: "authorization_code", code, redirect_uri: RETOUR_CLAUDE, client_id: clientId, code_verifier: verifier })).json();
  const v = autoriserAppelant(`Bearer ${j.access_token}`, "prospects.write");
  assert.equal(v.ok, false);
  assert.equal(!v.ok && v.statut, 403);
  assert.equal(autoriserAppelant(`Bearer ${j.access_token}`, "propositions.write").ok, true);
});

test("un jeton altéré ou forgé est refusé, et le MCP le dit (invalid_token → Claude rafraîchit)", async () => {
  const { clientId, verifier, code } = await parcours();
  const j = await (await echanger({ grant_type: "authorization_code", code, redirect_uri: RETOUR_CLAUDE, client_id: clientId, code_verifier: verifier })).json();
  const altere = j.access_token.slice(0, -2) + (j.access_token.endsWith("A") ? "BB" : "AA");
  assert.equal(autoriserAppelant(`Bearer ${altere}`, "etat.read").ok, false);
  const r = await mcp(new NextRequest(`${ORIGINE}/api/mcp`, { method: "POST", headers: { authorization: `Bearer ${altere}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }) }));
  assert.equal(r.status, 401);
  assert.match(r.headers.get("www-authenticate") ?? "", /error="invalid_token"/);
});

test("un code expiré ne s'échange plus", async () => {
  const { clientId, verifier, code } = await parcours();
  const secret = secretOAuth() as string;
  const r = echangerJeton(
    { grant_type: "authorization_code", code, redirect_uri: RETOUR_CLAUDE, client_id: clientId, code_verifier: verifier },
    { secret, maintenant: new Date(Date.now() + 61_000), estMaitre: () => true, codes: new CodesUtilises() },
  );
  assert.equal(r.ok, false);
});

// ─────────────────────────────── secret ───────────────────────────────

test("secret : dérivé de SUPABASE_JWT_SECRET (jamais égal), OAUTH_SECRET prioritaire, rien → fermé", () => {
  const derive = secretOAuth({ SUPABASE_JWT_SECRET: "abc" });
  assert.ok(derive && derive !== "abc", "un jeton Supabase ne doit jamais vérifier comme un jeton OAuth");
  const long = "x".repeat(40);
  assert.equal(secretOAuth({ SUPABASE_JWT_SECRET: "abc", OAUTH_SECRET: long }), long);
  assert.equal(secretOAuth({ OAUTH_SECRET: "trop-court" }), null);
  assert.equal(secretOAuth({}), null);
});
