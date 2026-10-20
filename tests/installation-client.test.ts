import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { ACCESS_COOKIE, accessToken } from "../lib/access";
import { BRIQUES_CONNUES, resoudreDroits } from "../lib/entitlements";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « ALPHA CHEZ VOUS » — l'installation sur le serveur d'un client.
 *
 * Deux défauts, tous deux trouvés en lisant le chemin réel d'une installation :
 *  · sans serrure, le client recevait le SOCLE GRATUIT — il payait le produit
 *    entier, les briques vendues restaient fermées ;
 *  · avec un mot de passe, le mode solo le rendait MAÎTRE — NOTRE économie
 *    (marges, commissions, playbook) ouverte sur SON serveur.
 *
 * ⚠ Ces tests APPELLENT le middleware : une garde de source serait satisfaite
 * par un commentaire bien écrit.
 * ─────────────────────────────────────────────────────────────────────
 */

const MDP = "mot-de-passe-du-client";

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

/** Une installation chez un client : sans comptes, derrière son mot de passe. */
const CHEZ_LE_CLIENT = {
  ALPHA_INSTALLATION: "client",
  SITE_PASSWORD: MDP,
  SUPABASE_JWT_SECRET: undefined,
  NEXT_PUBLIC_SUPABASE_URL: undefined,
  REQUIRE_AUTH: undefined,
  OWNER_EMAILS: undefined,
  NODE_ENV: "production",
};

async function requete(chemin: string): Promise<NextRequest> {
  return new NextRequest(`https://alpha.client.exemple${chemin}`, {
    headers: { cookie: `${ACCESS_COOKIE}=${await accessToken(MDP)}` },
  });
}

test(
  "le droit d'une installation client : TOUTES les briques, et pas maître",
  avecEnv(CHEZ_LE_CLIENT, async () => {
    const d = await resoudreDroits(await requete("/pipeline"));
    assert.deepEqual([...d.bricks].sort(), [...BRIQUES_CONNUES].sort(), "il a payé le produit entier");
    assert.equal(d.maitre, false, "rien de notre économie sur son serveur");
    assert.equal(d.solo, false, "un droit solo ouvre TOUT, /payouts compris");
  })
);

test(
  "⚠ chez le client, nos marges et notre playbook répondent 403",
  avecEnv(CHEZ_LE_CLIENT, async () => {
    for (const api of ["/api/voice-costs", "/api/knowledge", "/api/pipeline", "/api/moniteur"]) {
      const r = await middleware(await requete(api));
      assert.equal(r.status, 403, `${api} doit être refusée chez un client`);
    }
  })
);

test(
  "…et nos pages d'économie ne s'ouvrent pas",
  avecEnv(CHEZ_LE_CLIENT, async () => {
    for (const page of ["/payouts", "/offre"]) {
      const r = await middleware(await requete(page));
      assert.ok(r.headers.get("location"), `${page} doit être refusée (redirection), pas servie`);
    }
  })
);

test(
  "…mais les briques qu'il a payées s'ouvrent",
  avecEnv(CHEZ_LE_CLIENT, async () => {
    for (const page of ["/campaigns", "/voice", "/pipeline"]) {
      const r = await middleware(await requete(page));
      assert.equal(r.headers.get("location"), null, `${page} doit s'ouvrir chez le client`);
      assert.notEqual(r.status, 403);
    }
  })
);

test(
  "⚠ sans serrure, le mode client ne rouvre RIEN : socle gratuit, comme avant",
  avecEnv({ ...CHEZ_LE_CLIENT, SITE_PASSWORD: undefined }, async () => {
    // Joignable sans mot de passe ni comptes, son SMTP enverrait pour n'importe
    // qui depuis SON domaine. Le mode client exige une serrure.
    const r = await middleware(new NextRequest("https://alpha.client.exemple/campaigns"));
    assert.ok(r.headers.get("location"), "une brique qui dépense ne s'ouvre pas sans serrure");
  })
);

test(
  "contre-test : sans ALPHA_INSTALLATION, notre outil interne garde le mode solo",
  avecEnv({ ...CHEZ_LE_CLIENT, ALPHA_INSTALLATION: undefined }, async () => {
    const d = await resoudreDroits(await requete("/pipeline"));
    assert.equal(d.maitre, true, "derrière notre mot de passe, c'est nous");
  })
);

test("l'image Docker n'embarque ni nos fiches réelles, ni nos tests", () => {
  const ignore = readFileSync(join(process.cwd(), ".dockerignore"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  for (const exclu of ["donnees-privees", "tests", "scripts", "site", ".env*"]) {
    assert.ok(ignore.includes(exclu), `.dockerignore doit exclure ${exclu} : l'image part chez un client`);
  }
});

test("la pile Docker transmet la serrure et le mode, et n'expose rien à internet", () => {
  const compose = readFileSync(join(process.cwd(), "docker-compose.yml"), "utf8");
  // Compose ne transmet que ce qui est déclaré : un .env qui contient
  // SITE_PASSWORD sans cette ligne laisserait l'app sans serrure.
  assert.match(compose, /SITE_PASSWORD: \$\{SITE_PASSWORD/);
  assert.match(compose, /ALPHA_INSTALLATION: \$\{ALPHA_INSTALLATION/);
  // Ollama n'a aucune authentification : publié, n'importe qui s'en sert.
  const ports = [...compose.matchAll(/^\s*-\s*"([^"]+:\d+:\d+|\d+:\d+)"\s*$/gm)].map((m) => m[1]);
  assert.ok(ports.length >= 3, "les trois services publient un port");
  for (const p of ports) assert.ok(p.startsWith("127.0.0.1:"), `port ${p} exposé à toutes les interfaces`);
});

test("la procédure d'installation existe et nomme la serrure et le mode", () => {
  const doc = readFileSync(join(process.cwd(), "docs/INSTALLATION-CHEZ-VOUS.md"), "utf8");
  assert.match(doc, /ALPHA_INSTALLATION=client/);
  assert.match(doc, /SITE_PASSWORD/);
  assert.match(doc, /\/api\/voice-costs[^\n]*403/, "la vérification de nos marges refusées doit être dans la checklist");
});
